import type { EntitlementModule, WorkspaceEntitlements } from '../schema/workspace-entitlements';

/**
 * hasEntitlement — pure: workspace นี้ซื้อโมดูลนี้ไว้ไหม
 *
 * **fail-closed**: `null` (ไม่มี row) = ไม่มีสิทธิ์ — ลืมตั้งค่าแล้วปิด ดีกว่าลืมแล้วเปิดฟรี
 * deterministic ไม่พึ่ง io → unit test ครบ branch ได้
 */
export function hasEntitlement(
  entitlements: WorkspaceEntitlements | null,
  module: EntitlementModule,
): boolean {
  if (!entitlements) return false;
  return entitlements.modules.includes(module);
}

/** ต้องมีครบทุกโมดูลที่ระบุ (ฟีเจอร์ที่คร่อม 2 โมดูล เช่น รายงาน SLA = reports + routing_advanced) */
export function hasAllEntitlements(
  entitlements: WorkspaceEntitlements | null,
  modules: readonly EntitlementModule[],
): boolean {
  return modules.every((m) => hasEntitlement(entitlements, m));
}
