import { z } from 'zod';
import { idSchema } from '../ids';

/**
 * Agent = ทีมงานที่ตอบแชทใน workspace หนึ่ง (login เข้า agent inbox — Phase 3)
 * ⚠️ credential (password hash) **ไม่อยู่ใน entity นี้** — เป็นเรื่อง auth (infra) เก็บ/verify ที่ชั้น adapter/api
 * entity นี้คือ "ตัวตนเชิง business" ของ agent เท่านั้น (ใช้เป็น sender/assignee ของ message/conversation)
 */
export const agentSchema = z.object({
  id: idSchema('agt'),
  workspaceId: idSchema('ws'),
  email: z.string().email(),
  displayName: z.string().min(1),
  createdAt: z.date(),
});
export type Agent = z.infer<typeof agentSchema>;
