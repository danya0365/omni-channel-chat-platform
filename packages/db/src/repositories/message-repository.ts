import { and, eq, sql } from 'drizzle-orm';
import type { MessageRepository } from '@omni/domain';
import type { Executor } from '../client';
import { messages } from '../schema';

/**
 * MessageRepository (Postgres)
 * หมายเหตุ: rawPayload (payload ดิบ provider) เป็น seam ไว้สำหรับ channel ที่มี payload จริง (Phase 4)
 * — web channel ไม่มี payload ดิบให้เก็บ จึงยังไม่ set (column nullable)
 */
export function createMessageRepository(db: Executor): MessageRepository {
  return {
    insert: async (_workspaceId, message) => {
      // onConflictDoNothing ตรง partial unique (workspace_id, external_id) — redelivery ซ้ำ = no-op
      // returning ว่างเมื่อชน conflict → inserted=false ให้ ingest ข้าม publish/touch
      const inserted = await db
        .insert(messages)
        .values(message)
        .onConflictDoNothing({
          target: [messages.workspaceId, messages.externalId],
          where: sql`external_id is not null`,
        })
        .returning({ id: messages.id });
      return { inserted: inserted.length > 0 };
    },
    updateStatus: async (workspaceId, messageId, status) => {
      await db
        .update(messages)
        .set({ status })
        .where(and(eq(messages.workspaceId, workspaceId), eq(messages.id, messageId)));
    },
  };
}
