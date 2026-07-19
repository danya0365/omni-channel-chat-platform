import { z } from 'zod';
import type { ChannelId, WorkspaceId } from '@omni/domain';

/**
 * credential ของ LINE channel (decrypt แล้ว) — shape ที่ adapter รู้จัก
 * (db เก็บเป็น encrypted blob แบบ generic — adapter เป็นเจ้าของ shape + validation นี้)
 */
export const lineCredentialsSchema = z.object({
  /** channel access token (long-lived) — ใช้ Bearer ตอน push */
  channelAccessToken: z.string().min(1),
  /** channel secret — ใช้ verify x-line-signature ของ inbound webhook */
  channelSecret: z.string().min(1),
});
export type LineCredentials = z.infer<typeof lineCredentialsSchema>;

/**
 * LineCredentialResolver — (workspace, channel) → decrypted LINE credentials | null
 * impl จริง bridge จาก `@omni/db` (createChannelCredentialRepository.get) ที่ composition root
 * (adapter ไม่พึ่ง adapter: type นี้ผูกแค่ domain id + shape ของตัวเอง — db คืน blob ที่ compatible)
 */
export type LineCredentialResolver = (
  workspaceId: WorkspaceId,
  channelId: ChannelId,
) => Promise<LineCredentials | null>;

/**
 * ประกอบ resolver จาก raw getter (db repo คืน decrypted blob แบบ generic) — validate เป็น LineCredentials
 * blob ไม่ครบ/ผิด shape → zod throw (config พัง ควรรู้ตอน verify/send) · ไม่มี row → null
 */
export function createLineCredentialResolver(
  getRawCredentials: (
    workspaceId: WorkspaceId,
    channelId: ChannelId,
  ) => Promise<Record<string, unknown> | null>,
): LineCredentialResolver {
  return async (workspaceId, channelId) => {
    const raw = await getRawCredentials(workspaceId, channelId);
    if (!raw) return null;
    return lineCredentialsSchema.parse(raw);
  };
}
