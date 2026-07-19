import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * verify `x-line-signature` — LINE เซ็น **raw body** ด้วย HMAC-SHA256(channelSecret) แล้ว base64
 *
 * ⚠️ ต้องใช้ byte ดิบของ body (ก่อน parse JSON) — ถ้า re-serialize จาก object แล้ว hash จะไม่ตรง
 *    (Fastify ต้องเก็บ raw body ด้วย custom content-type parser — ดู route ฝั่ง api)
 * เทียบแบบ timing-safe (กัน timing attack) · signature หาย/ยาวไม่เท่า = false ทันที
 */
export function verifyLineSignature(
  rawBody: string | Buffer,
  signature: string | undefined,
  channelSecret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', channelSecret).update(rawBody).digest('base64');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  // timingSafeEqual ต้องขนาดเท่ากัน — ต่างขนาด = ไม่ตรงอยู่แล้ว
  if (signatureBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(signatureBuffer, expectedBuffer);
}
