import { and, eq } from 'drizzle-orm';
import { agentSchema } from '@omni/domain';
import type { AgentRepository } from '@omni/domain';
import type { Executor } from '../client';
import { agents } from '../schema';

/**
 * AgentRepository (Postgres)
 * `agentSchema.parse(row)` strip `passwordHash` ออกเอง (zod ตัด key ที่ไม่มีใน schema) — entity ไม่พก secret
 * `findCredentialByEmail` = จุดเข้า login: ไม่ scope workspace (resolve จาก email ก่อน) แล้วคืน hash แยกให้ auth verify
 */
export function createAgentRepository(db: Executor): AgentRepository {
  return {
    findById: async (workspaceId, agentId) => {
      const rows = await db
        .select()
        .from(agents)
        .where(and(eq(agents.workspaceId, workspaceId), eq(agents.id, agentId)))
        .limit(1);
      const row = rows[0];
      return row ? agentSchema.parse(row) : null;
    },

    findCredentialByEmail: async (email) => {
      const rows = await db.select().from(agents).where(eq(agents.email, email)).limit(1);
      const row = rows[0];
      if (!row) return null;
      return { agent: agentSchema.parse(row), passwordHash: row.passwordHash };
    },
  };
}
