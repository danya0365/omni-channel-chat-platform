import { z } from 'zod';
import { idSchema } from '../ids';
import { messageContentSchema } from './message';

/** วิธี match ข้อความลูกค้ากับ rule — MVP: contains (case-insensitive) · regex/intent เลื่อนออก (ADR-0006) */
export const botRuleMatchTypeSchema = z.enum(['contains']);
export type BotRuleMatchType = z.infer<typeof botRuleMatchTypeSchema>;

/** สิ่งที่ bot ทำเมื่อ rule match — reply (ตอบ canned) หรือ escalate (โอนหา human) */
export const botRuleActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('reply'), content: messageContentSchema }),
  z.object({ kind: z.literal('escalate') }),
]);
export type BotRuleAction = z.infer<typeof botRuleActionSchema>;

/**
 * BotRule = กติกา automation ต่อ workspace — "ถ้าข้อความ contains pattern → ทำ action"
 * channelId = null → ใช้กับทุกช่องทางใน workspace · priority น้อย = ตรวจก่อน (rule แรกที่ match ชนะ)
 * ไม่ใช่ secret → เก็บ plaintext (แยกจาก channel_credentials) · ดู ADR-0006
 */
export const botRuleSchema = z.object({
  id: idSchema('botr'),
  workspaceId: idSchema('ws'),
  /** จำกัดเฉพาะช่องทาง — null = ทุกช่องทางใน workspace */
  channelId: idSchema('chn').nullable(),
  matchType: botRuleMatchTypeSchema,
  /** ข้อความที่ใช้ match (contains, case-insensitive) */
  pattern: z.string().min(1),
  action: botRuleActionSchema,
  enabled: z.boolean(),
  /** ลำดับตรวจ — น้อยก่อน */
  priority: z.number().int(),
  createdAt: z.date(),
});
export type BotRule = z.infer<typeof botRuleSchema>;
