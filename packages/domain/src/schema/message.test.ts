import { describe, expect, it } from 'vitest';
import { deliveryStatusSchema, messageContentSchema, messageSenderSchema } from './message';

describe('messageContent (discriminated union)', () => {
  it('text ที่มีเนื้อหา → ผ่าน', () => {
    expect(messageContentSchema.safeParse({ type: 'text', text: 'สวัสดี' }).success).toBe(true);
  });

  it('text ว่าง → ไม่ผ่าน (min 1)', () => {
    expect(messageContentSchema.safeParse({ type: 'text', text: '' }).success).toBe(false);
  });

  it('type ที่ยังไม่รองรับ → ไม่ผ่าน (core ไม่รับ payload มั่ว)', () => {
    expect(messageContentSchema.safeParse({ type: 'image', url: 'x' }).success).toBe(false);
  });
});

describe('deliveryStatus', () => {
  it('ครอบทุกค่าที่กำหนด + ปฏิเสธค่านอกชุด', () => {
    for (const s of ['received', 'pending', 'sent', 'delivered', 'read', 'failed']) {
      expect(deliveryStatusSchema.safeParse(s).success).toBe(true);
    }
    expect(deliveryStatusSchema.safeParse('unknown').success).toBe(false);
  });
});

describe('messageSender (discriminated union)', () => {
  it('contact ต้องมี contactId ที่ถูก prefix', () => {
    expect(messageSenderSchema.safeParse({ kind: 'contact', contactId: 'ctc_1' }).success).toBe(
      true,
    );
    expect(messageSenderSchema.safeParse({ kind: 'contact', contactId: 'msg_1' }).success).toBe(
      false,
    );
  });

  it('bot ไม่ต้องมี id', () => {
    expect(messageSenderSchema.safeParse({ kind: 'bot' }).success).toBe(true);
  });
});
