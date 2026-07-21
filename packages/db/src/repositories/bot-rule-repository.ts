import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { botRuleSchema } from '@omni/domain';
import type { BotRuleRepository } from '@omni/domain';
import type { Database } from '../client';
import { botRules } from '../schema';

/**
 * BotRuleRepository (Postgres · Phase 5 อ่าน · Phase 6 เพิ่ม CRUD ให้จอจัดการ)
 * `listEnabled` = rules ที่ bot ใช้จริง (enabled · channel นั้น + global) เรียง priority (น้อยก่อน)
 * **ทุก query scope workspace ใน where เสมอ** — ลืม = อ่าน/แก้/ลบข้าม tenant ได้
 * domain zod (botRuleSchema) validate row → typed BotRule (strip column ส่วนเกินอย่าง updatedAt)
 */
export function createBotRuleRepository(db: Database): BotRuleRepository {
  /** where ที่ระบุ rule เดียวแบบผูก workspace (ใช้ซ้ำทุก op ที่อ้าง id) */
  const byId = (workspaceId: string, ruleId: string) =>
    and(eq(botRules.workspaceId, workspaceId), eq(botRules.id, ruleId));

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

    listAll: async (workspaceId) => {
      const rows = await db
        .select()
        .from(botRules)
        .where(eq(botRules.workspaceId, workspaceId))
        .orderBy(asc(botRules.priority));
      return rows.map((r) => botRuleSchema.parse(r));
    },

    findById: async (workspaceId, ruleId) => {
      const rows = await db.select().from(botRules).where(byId(workspaceId, ruleId)).limit(1);
      const row = rows[0];
      return row ? botRuleSchema.parse(row) : null;
    },

    insert: async (rule) => {
      await db.insert(botRules).values(rule);
    },

    update: async (workspaceId, ruleId, patch) => {
      // patch ที่ไม่มี field ไหนเลย → อ่านค่าเดิมคืน (drizzle `set({})` throw)
      const hasChange = Object.values(patch).some((v) => v !== undefined);
      const rows = hasChange
        ? await db
            .update(botRules)
            .set({ ...patch, updatedAt: new Date() })
            .where(byId(workspaceId, ruleId))
            .returning()
        : await db.select().from(botRules).where(byId(workspaceId, ruleId)).limit(1);
      const row = rows[0];
      return row ? botRuleSchema.parse(row) : null;
    },

    remove: async (workspaceId, ruleId) => {
      const rows = await db
        .delete(botRules)
        .where(byId(workspaceId, ruleId))
        .returning({ id: botRules.id });
      return rows.length > 0;
    },
  };
}
