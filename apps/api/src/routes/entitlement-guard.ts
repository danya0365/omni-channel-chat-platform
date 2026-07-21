import { hasEntitlement } from '@omni/domain';
import type { EntitlementModule } from '@omni/domain';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppDeps } from '../deps';
import type { AuthContext } from '../auth/service';
import { authFromRequest, isOriginAllowed } from '../auth/require-agent';

type GuardDeps = Pick<AppDeps, 'auth' | 'session' | 'entitlements'>;

/**
 * ด่านเดียวของ route ที่ขายแยก (Phase 6 · ADR-0007 ข้อ 4) — เรียงตามความ "ถูก" ของการปฏิเสธ:
 *   1. auth (401) → 2. CSRF Origin ถ้าเป็น state-changing (403) → 3. ซื้อโมดูลนี้ไหม (403)
 *
 * คืน `AuthContext` เมื่อผ่าน · **คืน null พร้อมส่ง response แล้ว** เมื่อไม่ผ่าน (caller แค่ return)
 * ⚠️ นี่คือจุดบังคับสิทธิ์จริง — UI ที่ซ่อนเมนูเป็นแค่ UX ยิง API ตรงต้องมาตายที่นี่
 * workspaceId มาจาก token เท่านั้น (ไม่รับจาก body/query) — กันขอสิทธิ์ในนาม workspace อื่น
 */
export async function requireEntitlement(
  req: FastifyRequest,
  reply: FastifyReply,
  deps: GuardDeps,
  entitlementModule: EntitlementModule,
  opts: { stateChanging?: boolean } = {},
): Promise<AuthContext | null> {
  const ctx = authFromRequest(req, deps.auth, deps.session.cookieName);
  if (!ctx) {
    await reply.code(401).send({ error: 'unauthorized' });
    return null;
  }
  if (opts.stateChanging && !isOriginAllowed(req, deps.session.allowedOrigins)) {
    await reply.code(403).send({ error: 'forbidden_origin' });
    return null;
  }
  const entitlements = await deps.entitlements.get(ctx.workspaceId);
  if (!hasEntitlement(entitlements, entitlementModule)) {
    // 403 + บอกโมดูลตรงๆ — ลูกค้า/ทีมขายอ่านออกว่า "ยังไม่ได้ซื้อ" ไม่ใช่ "ระบบพัง"
    await reply.code(403).send({ error: 'entitlement_required', module: entitlementModule });
    return null;
  }
  return ctx;
}
