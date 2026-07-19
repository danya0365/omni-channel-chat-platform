import { and, eq } from 'drizzle-orm';
import type { ChannelId, WorkspaceId } from '@omni/domain';
import type { Database } from '../client';
import { decryptSecret, encryptSecret } from '../crypto';
import { channelCredentials } from '../schema';

/**
 * ChannelCredentialRepository — อ่าน/เขียน secret ต่อ channel แบบ encrypted at rest
 *
 * คืน/รับ **decrypted JSON blob** เป็น `Record<string, unknown>` แบบ generic โดยตั้งใจ —
 * db ไม่ผูก shape ของ credential แต่ละช่องทาง (LINE มี channelAccessToken/channelSecret,
 * ช่องทางอื่นอาจต่างออกไป) · adapter (`@omni/channel-line`) เป็นคน validate shape ด้วย zod เอง
 * → boundary สะอาด: db รู้แค่ "encrypt blob แล้วเก็บ / อ่านแล้ว decrypt", ไม่รู้ business ของ credential
 *
 * scope ด้วย workspaceId เสมอ (กัน cross-tenant) แม้ channelId จะ unique ทั้งระบบก็ตาม
 */
export interface ChannelCredentialRepository {
  /** อ่าน + decrypt credential ของ channel — null ถ้ายังไม่เคยตั้ง · throw ถ้า decrypt ไม่ผ่าน (key ผิด/ข้อมูลเสีย) */
  get(workspaceId: WorkspaceId, channelId: ChannelId): Promise<Record<string, unknown> | null>;
  /** encrypt + upsert credential ของ channel (ตั้งครั้งแรก/อัปเดต) */
  upsert(
    workspaceId: WorkspaceId,
    channelId: ChannelId,
    secrets: Record<string, unknown>,
  ): Promise<void>;
}

export function createChannelCredentialRepository(
  db: Database,
  encryptionKey: Buffer,
): ChannelCredentialRepository {
  return {
    get: async (workspaceId, channelId) => {
      const rows = await db
        .select({ secretCipher: channelCredentials.secretCipher })
        .from(channelCredentials)
        .where(
          and(
            eq(channelCredentials.workspaceId, workspaceId),
            eq(channelCredentials.channelId, channelId),
          ),
        )
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      // decrypt ที่ boundary นี้เท่านั้น — caller ได้ plaintext blob ไปใช้ (ห้าม log)
      return JSON.parse(decryptSecret(row.secretCipher, encryptionKey)) as Record<string, unknown>;
    },

    upsert: async (workspaceId, channelId, secrets) => {
      const secretCipher = encryptSecret(JSON.stringify(secrets), encryptionKey);
      await db
        .insert(channelCredentials)
        .values({ channelId, workspaceId, secretCipher })
        .onConflictDoUpdate({
          target: channelCredentials.channelId,
          set: { secretCipher, updatedAt: new Date() },
        });
    },
  };
}
