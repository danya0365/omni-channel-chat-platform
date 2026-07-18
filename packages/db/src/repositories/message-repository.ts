import type { MessageRepository } from '@omni/domain';
import type { Database } from '../client';
import { messages } from '../schema';

/**
 * MessageRepository (Postgres)
 * หมายเหตุ: rawPayload (payload ดิบ provider) เป็น seam ไว้สำหรับ channel ที่มี payload จริง (Phase 4)
 * — web channel ไม่มี payload ดิบให้เก็บ จึงยังไม่ set (column nullable)
 */
export function createMessageRepository(db: Database): MessageRepository {
  return {
    insert: async (_workspaceId, message) => {
      await db.insert(messages).values(message);
    },
  };
}
