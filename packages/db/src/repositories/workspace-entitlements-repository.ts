import { eq } from 'drizzle-orm';
import { workspaceEntitlementsSchema } from '@omni/domain';
import type { WorkspaceEntitlementsRepository } from '@omni/domain';
import type { Executor } from '../client';
import { workspaceEntitlements } from '../schema';

/**
 * WorkspaceEntitlementsRepository (Postgres · Phase 6) — อ่านโมดูลที่ workspace ซื้อไว้
 *
 * `get` คืน null ถ้าไม่มี row → caller (`hasEntitlement`) ตีความว่า **ไม่มีสิทธิ์อะไรเลย** (fail-closed · ADR-0007)
 * domain zod strip column ส่วนเกิน (createdAt/updatedAt) + **ตัดโมดูลที่ไม่รู้จักทิ้ง** (ไม่ throw)
 * → deploy เวอร์ชันเก่าเจอโมดูลใหม่ใน DB แล้วไม่เสียสิทธิ์ทั้งใบ
 */
export function createWorkspaceEntitlementsRepository(
  db: Executor,
): WorkspaceEntitlementsRepository {
  return {
    get: async (workspaceId) => {
      const rows = await db
        .select()
        .from(workspaceEntitlements)
        .where(eq(workspaceEntitlements.workspaceId, workspaceId))
        .limit(1);
      const row = rows[0];
      return row ? workspaceEntitlementsSchema.parse(row) : null;
    },
  };
}
