import { eq } from 'drizzle-orm';
import { channelSchema } from '@omni/domain';
import type { ChannelRepository } from '@omni/domain';
import type { Database } from '../client';
import { channels } from '../schema';

/**
 * ChannelRepository (Postgres)
 *
 * ⚠️ `findPublicById` เป็น query เดียวที่ **ไม่ scope ด้วย workspaceId** โดยตั้งใจ —
 * เป็นจุดเข้าจาก channelId (public identifier ใน URL widget) เพื่อ resolve ว่า channel นี้อยู่ workspace ไหน
 * (channel ผูก 1 workspace). caller ต้องใช้ `channel.workspaceId` scope ทุก query ต่อจากนี้.
 */
export function createChannelRepository(db: Database): ChannelRepository {
  return {
    findPublicById: async (channelId) => {
      const rows = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
      const row = rows[0];
      return row ? channelSchema.parse(row) : null;
    },
  };
}
