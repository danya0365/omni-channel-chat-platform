import { createHash } from 'node:crypto';

/**
 * X-Line-Retry-Key (idempotency key ของ LINE push API) — derive UUID จาก message.id แบบ deterministic
 *
 * retry ของ message เดิม → key เดิม → LINE dedupe (ไม่ push ซ้ำภายใน 24 ชม.) กัน **double-send**
 * ตอน retry/backoff เมื่อ 5xx/timeout (request อาจถึง LINE แล้วแต่ response หาย)
 * message.id ของเราไม่ใช่ UUID → hash (sha256) แล้วจัดรูป + ตั้ง version/variant ให้เป็น UUID ถูก format
 */
export function lineRetryKey(messageId: string): string {
  const bytes = createHash('sha256').update(messageId).digest();
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x40, 6); // version 4
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8); // variant 10xx
  const hex = bytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
