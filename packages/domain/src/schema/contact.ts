import { z } from 'zod';
import { idSchema } from '../ids';

/** Contact = ตัวตนลูกค้า "แบบรวม" ข้ามช่องทาง (คนเดียวอาจมีหลาย identity) */
export const contactSchema = z.object({
  id: idSchema('ctc'),
  workspaceId: idSchema('ws'),
  displayName: z.string().min(1).nullable(),
  createdAt: z.date(),
});
export type Contact = z.infer<typeof contactSchema>;

/**
 * ContactIdentity = ตัวตนของ contact "บนช่องทางหนึ่ง" (เช่น visitor id ของ web, userId ของ LINE)
 * unique ต่อ (workspaceId, channelId, externalId) — ใช้ resolve inbound message → contact
 */
export const contactIdentitySchema = z.object({
  id: idSchema('idn'),
  workspaceId: idSchema('ws'),
  contactId: idSchema('ctc'),
  channelId: idSchema('chn'),
  /** id ผู้ใช้ฝั่ง provider (ไม่ log เป็น plaintext ใน log ทั่วไป — เป็น PII) */
  externalId: z.string().min(1),
  createdAt: z.date(),
});
export type ContactIdentity = z.infer<typeof contactIdentitySchema>;
