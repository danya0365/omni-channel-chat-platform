import { z } from 'zod';
import { idSchema } from '../ids';

/** สถานะ conversation — Phase 2 เริ่ม open/closed · (snoozed/pending ค่อยเติมตอนทำ routing) */
export const conversationStatusSchema = z.enum(['open', 'closed']);
export type ConversationStatus = z.infer<typeof conversationStatusSchema>;

/** ผู้รับผิดชอบ conversation — agent หรือ bot · null = ยังไม่ assign */
export const assigneeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('agent'), agentId: idSchema('agt') }),
  z.object({ kind: z.literal('bot') }),
]);
export type Assignee = z.infer<typeof assigneeSchema>;

/** Conversation = สายสนทนาของ contact หนึ่ง บนช่องทางหนึ่ง (รวม message หลายอัน) */
export const conversationSchema = z.object({
  id: idSchema('conv'),
  workspaceId: idSchema('ws'),
  contactId: idSchema('ctc'),
  channelId: idSchema('chn'),
  status: conversationStatusSchema,
  assignee: assigneeSchema.nullable(),
  createdAt: z.date(),
  lastMessageAt: z.date(),
});
export type Conversation = z.infer<typeof conversationSchema>;
