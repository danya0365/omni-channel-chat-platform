---
name: phase-6-progress
description: สถานะ Phase 6 (entitlement — เปิดฟีเจอร์ต่อ tenant) — Increment 1 (domain) + 2 (DB) เขียว+commit แล้ว บน branch feature/phase-6-entitlements (gate 227 + integration 47) · เหลือ Increment 3 (บังคับใช้ที่ server) + 4 (UI/seed) · ยังไม่ push. อ่านตอนทำ Phase 6 ต่อ / แตะ entitlement / เพิ่มฟีเจอร์ที่ขายแยก
metadata:
  node_type: memory
  type: log
  status: active
  scope: global
  updated: 2026-07-21
  originSessionId: 3be9577c-b819-462f-a61d-267f34fc9eb5
  modified: 2026-07-21T04:26:30.722Z
---

# Handoff — Phase 6: Entitlements (เปิดฟีเจอร์ต่อ tenant)

> อ่านคู่: [[product-direction-per-tenant]] (แนวทางหลัก) + [[adr-0007-phase-6-entitlements]] (การตัดสินใจ)
> Phase 5 ค้างที่ PR-ready ยังไม่ merge — ดู [[phase-5-progress]]

## สถานะ (2026-07-21) — Increment 1-2 เขียว + commit ครบ

- 🌿 **branch `feature/phase-6-entitlements`** (แตกจาก `feature/phase-5-bot-automation` @ `73a9525`)
  — แตกใหม่เพื่อไม่ให้ PR ของ Phase 5 บวม · **ยังไม่ push · ยังไม่มี PR**
- ✅ **ADR-0007** + **core memory** [[product-direction-per-tenant]] (priority สูงสุดใน MEMORY.md)
- ✅ **Increment 1 (domain pure)** + ✅ **Increment 2 (DB)** — เขียวครบ:
  `pnpm gate` **227 unit** (เดิม 217 · +10) · `pnpm test:integration` **47** (เดิม 41 · +6) ·
  boundaries 194 modules · check:app-routing ผ่าน
- working tree สะอาด · commit ในนี้: `f18d948` chore(repo) แยก billing · `6ad6226` feat(billing) ·
  `124363e` feat(domain) inc.1 · `64acb13` docs(memory) · + inc.2 (ดูล่างสุด)

### ⚠️ ค้างจาก Phase 5 (ยังไม่หาย)

branch `feature/phase-5-bot-automation` push แล้วแต่ **PR ยังไม่ถูกสร้าง** (gh ไม่ auth) ·
PR base ที่ถูกต้อง = **`main`** ไม่ใช่ `feature/phase-1-stack-skeleton` — ดู [[phase-5-progress]]
· Phase 6 stack อยู่บน Phase 5 → merge Phase 5 ก่อน แล้วค่อย PR Phase 6

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

## ✅ Increment 2 — DB (integration 47, +6)

- `schema.ts` — ตาราง **`workspace_entitlements`**: `workspace_id` PK → workspaces (**cascade**) ·
  `modules` **jsonb** `$type<EntitlementModule[]>` default `'[]'::jsonb` · createdAt/updatedAt
  - ⭐ เก็บเป็น **array ของ module id ไม่ใช่คอลัมน์ boolean ต่อโมดูล** → เพิ่มโมดูลใหม่ **ไม่ต้อง migration**
- `repositories/workspace-entitlements-repository.ts` — `createWorkspaceEntitlementsRepository(db)`
  · parse ผ่าน `workspaceEntitlementsSchema` (strip createdAt/updatedAt + ตัดโมดูลที่ไม่รู้จัก)
- migration **`0007_blushing_micromacro.sql`** (+ meta snapshot/journal) — apply แล้วบน dev DB
- integration `entitlements-phase6.integration.test.ts` (**6 tests**): ไม่มี row → null (fail-closed
  ทะลุถึง `hasEntitlement`) · row เปล่า → `[]` · อ่านโมดูลครบ · **ไม่รั่วข้าม tenant** ·
  โมดูลแปลกใน DB (`["bot","teleporter","reports"]`) → คืน `["bot","reports"]` ไม่ throw · cascade ลบตาม workspace

## ถัดไป (ยังไม่เริ่ม)

- **Increment 3 — บังคับใช้ที่ server**: wire repo เข้า `apps/api` (`deps.ts` / `wiring.ts`) +
  helper เช็คสิทธิ์ที่ route/service ·
  ผูก `bot`/`ai` ให้ต้องผ่าน **ทั้ง** entitlement (ซื้อไหม) และ `workspace_bot_config` (เปิดใช้ไหม)
- **Increment 4 — UI + seed**: `apps/inbox` ซ่อนเมนูที่ไม่ได้ซื้อ (UX ไม่ใช่ security) ·
  `seed-dev.ts` เปิดครบทุกโมดูล (ไม่งั้น dev เจอฟีเจอร์หายแล้วงง)

## Gotchas

- **`workspace_bot_config` ไม่ถูกรื้อ** — Phase 6 additive · สิทธิ์ (entitlement) กับสวิตช์ใช้งาน (bot config) เป็นคนละเรื่อง
- ทุกจุดที่ gate ต้องมี test **ทั้งสองทาง** (มีสิทธิ์ / ไม่มีสิทธิ์)
- flag คือหนี้ — ฟีเจอร์ไหนกลายเป็น core (ทุกคนได้) ให้ **ลบโมดูลออกจาก union** อย่าปล่อยค้าง
- เพิ่มโมดูลใหม่ = แก้ `entitlementModuleSchema` อย่างเดียว **ไม่ต้อง migration** (jsonb array)
- `apps/billing` (ใบเสนอราคา) อยู่ **นอก** pnpm workspace/gate — แก้แล้ว `pnpm gate` ไม่กวาด ·
  รันด้วย `cd apps/billing && npm run dev` · ราคา/ฟีเจอร์ใน `src/data/mock/mockFeatures.ts`

## วิธีรัน / verify

- gate: `pnpm gate` (lint + typecheck + test 227 + boundaries 194 + app-routing)
- integration: `pnpm db:up` แล้ว `pnpm test:integration` (47)
- migration ใหม่: `pnpm --filter @omni/db db:generate` · dev DB apply อัตโนมัติผ่าน `runMigrations` ใน integration test
