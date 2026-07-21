import { eq } from 'drizzle-orm';
import { workspaceBotConfigSchema } from '@omni/domain';
import type { WorkspaceBotConfigRepository } from '@omni/domain';
import type { Executor } from '../client';
import { workspaceBotConfig } from '../schema';

/**
 * WorkspaceBotConfigRepository (Postgres · Phase 5) — อ่านสวิตช์ automation ของ workspace
 * `get` คืน null ถ้าไม่มี row → bot consumer ตีความว่า bot ปิด (คง behavior เดิม · ดู ADR-0006)
 * domain zod (workspaceBotConfigSchema) strip column ส่วนเกิน (createdAt/updatedAt) → typed entity
 */
export function createWorkspaceBotConfigRepository(db: Executor): WorkspaceBotConfigRepository {
  return {
    get: async (workspaceId) => {
      const rows = await db
        .select()
        .from(workspaceBotConfig)
        .where(eq(workspaceBotConfig.workspaceId, workspaceId))
        .limit(1);
      const row = rows[0];
      return row ? workspaceBotConfigSchema.parse(row) : null;
    },

    upsert: async (config) => {
      const [row] = await db
        .insert(workspaceBotConfig)
        .values(config)
        .onConflictDoUpdate({
          target: workspaceBotConfig.workspaceId,
          set: {
            botEnabled: config.botEnabled,
            aiEnabled: config.aiEnabled,
            updatedAt: new Date(),
          },
        })
        .returning();
      return workspaceBotConfigSchema.parse(row);
    },
  };
}
