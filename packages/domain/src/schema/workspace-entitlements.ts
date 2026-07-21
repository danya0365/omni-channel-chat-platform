import { z } from 'zod';
import { idSchema } from '../ids';

/**
 * โมดูลที่ **ขายแยกได้** — gate ระดับโมดูล ไม่ใช่รายฟีเจอร์ (ดู ADR-0007)
 *
 * ⚠️ สิ่งที่ **ไม่อยู่** ในนี้โดยตั้งใจ:
 *   - **ช่องทางแชท** (LINE/Messenger/…) — gate ด้วยข้อมูลอยู่แล้ว: ไม่ได้ซื้อ = ไม่มี row ใน `channels`
 *     + ไม่มี credential → ใช้ไม่ได้เอง (ตั้งแต่ Phase 4)
 *   - **บริการ** (training, ย้ายข้อมูล, ดูแลระบบ, self-host) — งานคน ไม่ใช่โค้ด
 *
 * เพิ่มสมาชิกใหม่ได้แบบ additive (แตกโมดูลให้ละเอียดขึ้นเมื่อมีคนอยากซื้อเป็นชิ้นจริงๆ)
 */
export const entitlementModuleSchema = z.enum([
  /** ค้นหา, ข้อความสำเร็จรูป, สื่อ, โน้ตภายใน, typing/read, แอปมือถือ, หลายภาษา */
  'inbox_advanced',
  /** ทีม/แผนก, มอบหมายอัตโนมัติ, แท็ก, SLA timer, เวลาทำการ, โอนสาย */
  'routing_advanced',
  /** บอท keyword rule + admin UI + escalate + เมนู + flow + lead form + FAQ */
  'bot',
  /** AI ช่วยตอบ/แนะนำ/สรุป/sentiment/RAG/แปลภาษา */
  'ai',
  /** รวมลูกค้าข้ามช่องทาง, ฟิลด์กำหนดเอง, แบ่งกลุ่ม, broadcast */
  'crm_advanced',
  /** รายงานทุกชนิด + dashboard + export */
  'reports',
  /** webhook, REST API, เชื่อม CRM/ออเดอร์/ชำระเงิน/ticket */
  'integrations',
  /** RBAC, audit log, SSO, PDPA tools, 2FA */
  'security_advanced',
]);
export type EntitlementModule = z.infer<typeof entitlementModuleSchema>;

/**
 * WorkspaceEntitlements — โมดูลที่ workspace นี้ "ซื้อไว้" (Phase 6)
 *
 * ⚠️ **ไม่มี row = ไม่มีสิทธิ์อะไรเลย** (fail-closed เหมือน workspace_bot_config) —
 *    ตั้งใจให้ลืมแล้วปิด ดีกว่าลืมแล้วเปิดฟรี
 * ⚠️ สิทธิ์ ≠ สวิตช์ใช้งาน: `bot`/`ai` ต้องผ่านทั้ง entitlement (ซื้อไหม) และ
 *    `workspace_bot_config` (เปิดใช้ไหม) — ดู ADR-0007 ข้อ 5
 */
export const workspaceEntitlementsSchema = z.object({
  workspaceId: idSchema('ws'),
  /**
   * โมดูลที่ซื้อไว้ — **ค่าที่ไม่รู้จักถูกตัดทิ้ง** ไม่ throw
   * (ถ้า throw: deploy เวอร์ชันเก่าเจอโมดูลใหม่ใน DB → workspace เสียสิทธิ์ทั้งใบ · ตัดทิ้งคือ fail-closed
   *  เฉพาะตัวที่ไม่รู้จัก ซึ่งถูกต้องอยู่แล้ว — เราให้สิทธิ์สิ่งที่ไม่รู้จักไม่ได้)
   */
  modules: z.preprocess(
    (raw) =>
      Array.isArray(raw) ? raw.filter((m) => entitlementModuleSchema.safeParse(m).success) : raw,
    z.array(entitlementModuleSchema),
  ),
});
export type WorkspaceEntitlements = z.infer<typeof workspaceEntitlementsSchema>;
