import type { Message, OutboundGateway } from '@omni/domain';

export interface RetryOptions {
  /** จำนวนครั้งที่ยิงทั้งหมด (รวมครั้งแรก) — เช่น 3 = ลองแรก + retry 2 */
  attempts: number;
  /** backoff (ms) ก่อน retry ครั้งที่ i (index 0 = ก่อน retry แรก) — array สั้นกว่าใช้ค่าท้าย */
  backoffMs: number[];
  /** inject เพื่อ test (ไม่รอจริง) — default = setTimeout */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * ครอบ OutboundGateway ให้ retry เมื่อ send ล้ม (receipt.ok === false) แบบ bounded backoff
 *
 * ⚠️ ต้องใช้ตอน deliver **นอก DB tx** เท่านั้น (sleep ระหว่าง backoff ห้ามถือ lock) — ดู buildSendOutbound
 * - web gateway คืน ok เสมอ (offline = delivered:false ไม่ใช่ error) → ไม่ retry
 * - เป้าหมาย = LINE push ที่ล้มชั่วคราว (5xx/timeout/rate-limit) · idempotent ด้วย X-Line-Retry-Key
 *   (push-client derive จาก message.id) → retry ไม่ double-send
 */
export function createRetryingOutboundGateway(
  inner: OutboundGateway,
  options: RetryOptions,
): OutboundGateway {
  const { attempts, backoffMs, sleep = defaultSleep } = options;
  return {
    send: async (message: Message) => {
      let result = await inner.send(message);
      for (let attempt = 1; attempt < attempts && !result.ok; attempt += 1) {
        const wait = backoffMs[attempt - 1] ?? backoffMs.at(-1) ?? 0;
        await sleep(wait);
        result = await inner.send(message);
      }
      return result;
    },
  };
}
