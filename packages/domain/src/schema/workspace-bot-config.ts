import { z } from 'zod';
import { idSchema } from '../ids';

/**
 * WorkspaceBotConfig (Phase 5) — สวิตช์ automation ต่อ workspace
 *   botEnabled = เปิดให้ bot รับสายใหม่ + ตอบตาม rules · **ไม่มี row = ปิด** (คง behavior เดิม ไม่ auto-own ทุก workspace)
 *   aiEnabled  = (Phase 5B) อนุญาต fallback ถาม Claude เมื่อ rule ไม่ match · default ปิด (PII opt-in — ดู ADR-0006)
 * ไม่ใช่ secret → plaintext (แยกจาก channel_credentials)
 */
export const workspaceBotConfigSchema = z.object({
  workspaceId: idSchema('ws'),
  botEnabled: z.boolean(),
  aiEnabled: z.boolean(),
});
export type WorkspaceBotConfig = z.infer<typeof workspaceBotConfigSchema>;
