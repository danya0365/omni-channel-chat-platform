import type { ChannelId, WorkspaceId } from '@omni/domain';

/**
 * คีย์ registry ของ WS: หนึ่ง key = หนึ่ง session (identity ของ visitor บนช่องทาง web)
 * ใช้ทั้งฝั่ง **register** (api ตอน widget ต่อ WS ด้วย sessionId) และฝั่ง **route** (outbound gateway)
 * — ทั้งสองฝั่งต้องคิดคีย์เดียวกันจาก (workspaceId, channelId, externalId)
 *
 * externalId = sessionId ของ widget (PII-ish — เป็นแค่ token สุ่ม ไม่ใช่ข้อมูลลูกค้าจริง)
 */
export function webSessionKey(
  workspaceId: WorkspaceId,
  channelId: ChannelId,
  externalId: string,
): string {
  return `${workspaceId}:${channelId}:${externalId}`;
}
