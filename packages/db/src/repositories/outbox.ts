import { asc, inArray, isNull } from 'drizzle-orm';
import type { EventBus } from '@omni/domain';
import type { Executor } from '../client';
import { uuidv7 } from '../id';
import { outbox } from '../schema';

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
