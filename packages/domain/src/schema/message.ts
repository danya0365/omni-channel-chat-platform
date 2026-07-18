import { z } from 'zod';
import { idSchema } from '../ids';

/**
 * MessageContent — เนื้อหาข้อความแบบ discriminated union (key = `type`)
 * เริ่มที่ text · image/file/location/... ต่อยอดได้โดยเพิ่ม member (core ไม่ผูก payload ดิบของช่องทาง)
 */
export const messageContentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().min(1) }),
]);
export type MessageContent = z.infer<typeof messageContentSchema>;

export const messageDirectionSchema = z.enum(['inbound', 'outbound']);
export type MessageDirection = z.infer<typeof messageDirectionSchema>;

/** สถานะ delivery ตลอด lifecycle ของ message */
export const deliveryStatusSchema = z.enum([
  'received', // inbound ที่เพิ่งรับเข้า core
  'pending', // outbound รอส่ง
  'sent', // ส่งเข้า provider แล้ว
  'delivered', // provider ยืนยันถึงปลายทาง
  'read', // ปลายทางอ่านแล้ว
  'failed', // ส่งไม่สำเร็จ
]);
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;

/** ผู้ส่ง message — contact (inbound), agent หรือ bot (outbound) */
export const messageSenderSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('contact'), contactId: idSchema('ctc') }),
  z.object({ kind: z.literal('agent'), agentId: idSchema('agt') }),
  z.object({ kind: z.literal('bot') }),
]);
export type MessageSender = z.infer<typeof messageSenderSchema>;

/** Message = หน่วยข้อความกลาง (unified) — ทุกช่องทาง map เข้า/ออกผ่าน shape นี้ */
export const messageSchema = z.object({
  id: idSchema('msg'),
  workspaceId: idSchema('ws'),
  conversationId: idSchema('conv'),
  channelId: idSchema('chn'),
  direction: messageDirectionSchema,
  sender: messageSenderSchema,
  content: messageContentSchema,
  status: deliveryStatusSchema,
  /** id ของ message ฝั่ง provider (idempotency/trace) — null ได้ถ้าช่องทางไม่ส่งมา */
  externalId: z.string().min(1).nullable(),
  createdAt: z.date(),
});
export type Message = z.infer<typeof messageSchema>;
