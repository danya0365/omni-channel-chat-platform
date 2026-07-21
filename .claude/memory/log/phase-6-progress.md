---
name: phase-6-progress
description: สถานะ Phase 6 (entitlement — เปิดฟีเจอร์ต่อ tenant) — Increment 1 (domain pure) เขียวแล้ว gate 227 · เหลือ DB / บังคับใช้ที่ server / UI · ยังไม่ commit. อ่านตอนทำ Phase 6 ต่อ / แตะ entitlement / เพิ่มฟีเจอร์ที่ขายแยก
metadata:
  node_type: memory
  type: log
  status: active
  scope: global
  updated: 2026-07-21
  originSessionId: 3be9577c-b819-462f-a61d-267f34fc9eb5
  modified: 2026-07-21T04:02:22.858Z
---

# Handoff — Phase 6: Entitlements (เปิดฟีเจอร์ต่อ tenant)

> อ่านคู่: [[product-direction-per-tenant]] (แนวทางหลัก) + [[adr-0007-phase-6-entitlements]] (การตัดสินใจ)
> Phase 5 ค้างที่ PR-ready ยังไม่ merge — ดู [[phase-5-progress]]

## สถานะ (2026-07-21)

- ✅ **ADR-0007** เขียนแล้ว · ✅ **core memory** [[product-direction-per-tenant]] (priority หลัก)
- ✅ **Increment 1 — domain (pure) เขียว** · `pnpm gate` = **227 tests** (เดิม 217 · +10) ·
  boundaries 192 modules · check:app-routing ผ่าน
- ⚠️ **ยังไม่ commit** — working tree มี Phase 6 inc.1 + `apps/billing` ทั้งก้อน + config ที่แก้ตอนแยก billing ออกจาก gate

## ✅ Increment 1 — Domain (pure)

- `schema/workspace-entitlements.ts` — `entitlementModuleSchema` **8 โมดูล**:
  `inbox_advanced` · `routing_advanced` · `bot` · `ai` · `crm_advanced` · `reports` · `integrations` · `security_advanced`
  - `WorkspaceEntitlements { workspaceId, modules[] }`
- `services/check-entitlement.ts` — pure `hasEntitlement(entitlements|null, module)` + `hasAllEntitlements(..., modules[])`
- `ports.ts` — `WorkspaceEntitlementsRepository.get(workspaceId) → WorkspaceEntitlements | null`
- export ครบใน `schema/index.ts` + `index.ts` · **10 unit test** ครบ branch

### 2 จุดที่ตัดสินใจระหว่างทาง (Iris เคาะ พี่รับทราบแล้ว)

1. **`null` = ไม่มีสิทธิ์เลย (fail-closed)** — pattern เดียวกับ `workspace_bot_config`
2. **โมดูลที่ไม่รู้จัก = ตัดทิ้ง ไม่ throw** — ถ้า throw แล้ว deploy เวอร์ชันเก่าเจอโมดูลใหม่ใน DB
   ลูกค้าจะเสียสิทธิ์**ทั้งใบ** · ใช้ `z.preprocess` filter (มี test คุม)

## ถัดไป (ยังไม่เริ่ม)

- **Increment 2 — DB**: ตาราง `workspace_entitlements` (`workspace_id` PK → workspaces cascade ·
  `modules` jsonb `$type<EntitlementModule[]>`) + repo ใน `@omni/db` + migration + integration test
- **Increment 3 — บังคับใช้ที่ server**: helper ที่ route/service ฝั่ง api ·
  ผูก `bot`/`ai` ให้ต้องผ่าน **ทั้ง** entitlement (ซื้อไหม) และ `workspace_bot_config` (เปิดใช้ไหม)
- **Increment 4 — UI + seed**: `apps/inbox` ซ่อนเมนูที่ไม่ได้ซื้อ (UX ไม่ใช่ security) ·
  `seed-dev.ts` เปิดครบทุกโมดูล (ไม่งั้น dev เจอฟีเจอร์หายแล้วงง)

## Gotchas

- **`workspace_bot_config` ไม่ถูกรื้อ** — Phase 6 additive · สิทธิ์ (entitlement) กับสวิตช์ใช้งาน (bot config) เป็นคนละเรื่อง
- ทุกจุดที่ gate ต้องมี test **ทั้งสองทาง** (มีสิทธิ์ / ไม่มีสิทธิ์)
- flag คือหนี้ — ฟีเจอร์ไหนกลายเป็น core (ทุกคนได้) ให้ **ลบโมดูลออกจาก union** อย่าปล่อยค้าง
