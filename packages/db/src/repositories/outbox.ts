import { and, asc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import type { EventBus } from '@omni/domain';
import type { Database, Executor } from '../client';
import { uuidv7 } from '../id';
import { outbox, outboxCursors } from '../schema';

/**
 * OutboxEventBus — EventBus impl ที่เขียน domain event ลงตาราง `outbox`
 * เรียกใน `db.transaction()` เดียวกับ business write (message insert) → transactional outbox
 * payload เก็บ JSON-safe (occurredAt → ISO string) + เป็น ids ล้วน (ไม่มี PII เต็ม)
 */
export function createOutboxEventBus(exec: Executor, newId: () => string = uuidv7): EventBus {
  return {
    publish: async (event) => {
      const { occurredAt, ...rest } = event;
      await exec.insert(outbox).values({
        id: newId(),
        workspaceId: event.workspaceId,
        type: event.type,
        payload: { ...rest, occurredAt: occurredAt.toISOString() },
        occurredAt,
      });
    },
  };
}

/** แถว outbox ที่ยังไม่ประมวลผล (ป้อนให้ relay/consumer) */
export interface OutboxRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

/**
 * OutboxStore — read/mark สำหรับ relay (background worker · ระบบ ไม่ scope workspace เพราะประมวลผลทุก tenant)
 * การ fan-out จริงเกิดที่ consumer ซึ่ง scope ด้วย workspaceId ใน payload อีกชั้น
 */
export interface OutboxStore {
  fetchUnprocessed(limit: number): Promise<OutboxRow[]>;
  markProcessed(ids: string[], at: Date): Promise<void>;
}

export function createOutboxStore(db: Executor): OutboxStore {
  return {
    fetchUnprocessed: async (limit) => {
      // FOR UPDATE SKIP LOCKED — drain หลายตัว (immediate + pg-boss) หยิบคนละ row ไม่ชนกัน
      // (ทำงานใน tx: fetch → fan-out → markProcessed แล้ว commit จึงปล่อย lock)
      return db
        .select({
          id: outbox.id,
          type: outbox.type,
          payload: outbox.payload,
          occurredAt: outbox.occurredAt,
        })
        .from(outbox)
        .where(isNull(outbox.processedAt))
        .orderBy(asc(outbox.createdAt))
        .limit(limit)
        .for('update', { skipLocked: true });
    },

    markProcessed: async (ids, at) => {
      if (ids.length === 0) return;
      await db.update(outbox).set({ processedAt: at }).where(inArray(outbox.id, ids));
    },
  };
}

/**
 * OutboxCursorStore (Phase 5) — multi-subscriber outbox: subscriber ใหม่ (เช่น 'bot') อ่าน event ด้วย cursor
 * ของตัวเอง **ไม่แตะ `processed_at`** ของ agent WS consumer เดิม (additive · ADR-0006)
 *
 * `claimBatch` = tx เดียว (lock cursor row → read rows หลัง cursor → advance cursor) แล้วคืน rows ให้ประมวลผล
 * **นอก tx** (bot logic = network ห้ามถือ tx) · lock (FOR UPDATE) กันหลาย instance claim ทับ
 * ⚠️ at-most-once: crash หลัง claim ก่อนประมวลผล = ข้าม batch นั้น (bot reply ไม่ critical — ยอมรับได้ MVP)
 */
export interface OutboxCursorStore {
  claimBatch(subscriber: string, limit: number): Promise<OutboxRow[]>;
}

export function createOutboxCursorStore(db: Database): OutboxCursorStore {
  return {
    claimBatch: async (subscriber, limit) =>
      db.transaction(async (tx) => {
        // ensure cursor row มีอยู่ แล้ว lock (กันหลาย instance claim batch เดียวกัน)
        await tx.insert(outboxCursors).values({ subscriber }).onConflictDoNothing();
        const locked = await tx
          .select()
          .from(outboxCursors)
          .where(eq(outboxCursors.subscriber, subscriber))
          .limit(1)
          .for('update');
        const cursor = locked[0];
        // cursor = (createdAt, id) — อ่าน rows ที่ "ใหม่กว่า" cursor (tie-break ด้วย id) · ว่าง = ตั้งแต่ต้น
        const after =
          cursor?.lastCreatedAt != null && cursor.lastId != null
            ? or(
                gt(outbox.createdAt, cursor.lastCreatedAt),
                and(eq(outbox.createdAt, cursor.lastCreatedAt), gt(outbox.id, cursor.lastId)),
              )
            : undefined;
        const rows = await tx
          .select({
            id: outbox.id,
            type: outbox.type,
            payload: outbox.payload,
            occurredAt: outbox.occurredAt,
            createdAt: outbox.createdAt,
          })
          .from(outbox)
          .where(after)
          .orderBy(asc(outbox.createdAt), asc(outbox.id))
          .limit(limit);
        const last = rows[rows.length - 1];
        if (!last) return [];
        await tx
          .update(outboxCursors)
          .set({ lastCreatedAt: last.createdAt, lastId: last.id, updatedAt: new Date() })
          .where(eq(outboxCursors.subscriber, subscriber));
        return rows.map((r) => ({
          id: r.id,
          type: r.type,
          payload: r.payload,
          occurredAt: r.occurredAt,
        }));
      }),
  };
}
