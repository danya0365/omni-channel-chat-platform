import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { botRuleSchema } from '@omni/domain';
import type { BotRuleRepository } from '@omni/domain';
import type { Database } from '../client';
import { botRules } from '../schema';

/**
 * BotRuleRepository (Postgres · Phase 5) — โหลด rules ที่ enabled ของ workspace ที่ใช้กับ channel นี้
 * = rule ผูก channel นั้น + rule global (channelId = null) · เรียง priority (น้อยก่อน) · scope workspace เสมอ
 * domain zod (botRuleSchema) validate row → typed BotRule (strip column ส่วนเกินอย่าง updatedAt)
 */
export function createBotRuleRepository(db: Database): BotRuleRepository {
  return {
    listEnabled: async (workspaceId, channelId) => {
      const rows = await db
        .select()
        .from(botRules)
        .where(
          and(
            eq(botRules.workspaceId, workspaceId),
            eq(botRules.enabled, true),
            or(eq(botRules.channelId, channelId), isNull(botRules.channelId)),
          ),
        )
        .orderBy(asc(botRules.priority));
      return rows.map((r) => botRuleSchema.parse(r));
    },
  };
}
