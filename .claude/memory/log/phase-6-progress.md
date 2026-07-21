---
name: phase-6-progress
description: สถานะ Phase 6 (entitlement — เปิดฟีเจอร์ต่อ tenant) — Increment 1-2 commit แล้ว · Increment 3 (บังคับใช้ที่ server + route + seed) เขียวแต่ยังไม่ commit (gate 235 + integration 49) · Phase 5 merged main แล้ว · เหลือ Increment 4 (UI ซ่อนเมนู). อ่านตอนทำ Phase 6 ต่อ / แตะ entitlement / เพิ่มฟีเจอร์ที่ขายแยก
metadata:
  node_type: memory
  type: log
  status: active
  scope: global
  updated: 2026-07-21
  originSessionId: 3be9577c-b819-462f-a61d-267f34fc9eb5
  modified: 2026-07-21T04:45:44.309Z
---

# Handoff — Phase 6: Entitlements (เปิดฟีเจอร์ต่อ tenant)

> อ่านคู่: [[product-direction-per-tenant]] (แนวทางหลัก) + [[adr-0007-phase-6-entitlements]] (การตัดสินใจ)
> Phase 5 ค้างที่ PR-ready ยังไม่ merge — ดู [[phase-5-progress]]

## สถานะ (2026-07-21) — Increment 1-2 commit แล้ว · **Increment 3 เขียวแต่ยังไม่ commit**

- 🌿 **branch `feature/phase-6-entitlements`** (แตกจาก `feature/phase-5-bot-automation` @ `73a9525`)
- ✅ **Phase 5 ปิดแล้ว** — `origin/main` มี PR #8 (Phase 5) + PR #9 (Phase 6 inc.1) merge แล้ว ·
  branch นี้ = superset ของ main (มี inc.2 เพิ่ม) → **ไม่ต้อง merge/rebase ก่อนทำงานต่อ** ·
  ตอนจะเปิด PR รอบหน้า base = **`main`**
- ✅ **ADR-0007** + **core memory** [[product-direction-per-tenant]] (priority สูงสุดใน MEMORY.md)
- ✅ **Increment 1 (domain pure)** + ✅ **Increment 2 (DB)** — เขียวครบ:
  `pnpm gate` **227 unit** (เดิม 217 · +10) · `pnpm test:integration` **47** (เดิม 41 · +6) ·
  boundaries 194 modules · check:app-routing ผ่าน
- working tree สะอาด · commit ในนี้: `f18d948` chore(repo) แยก billing · `6ad6226` feat(billing) ·
  `124363e` feat(domain) inc.1 · `64acb13` docs(memory) · + inc.2 (ดูล่างสุด)

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

## ✅ Increment 3 — บังคับใช้ที่ server (gate 235 · integration 49) — ยังไม่ commit

- **bot consumer** (`realtime/bot-consumer.ts`) — dep ใหม่ `getEntitlements(ws)` ·
  `bot`: `config.botEnabled && hasEntitlement(ent,'bot')` (อ่าน config+ent แบบ `Promise.all`) ·
  `ai`: `config.aiEnabled && hasEntitlement(ent,'ai')` → **ไม่ซื้อ = ไม่ยิง Anthropic เลย** (ไม่เสียเงินเรา)
  · +5 unit (ไม่มี row / ซื้อโมดูลอื่น / ซื้อ bot / ซื้อ bot ไม่ซื้อ ai / ซื้อครบ)
- **wire** — `createWorkspaceEntitlementsRepository` สร้างที่ `wiring.ts` **ตัวเดียว** ใช้ร่วม route+bot ·
  `AppDeps.entitlements` · `buildBotConsumer` refactor **positional 6 ตัว → object param** (`BotConsumerWiring`)
- **route `GET /inbox/entitlements`** — auth-scoped (workspace จาก token) คืน `{modules}` · ไม่มี row = `[]` ไม่ใช่ 404
  · +3 test (401 / 200 ตรง / fail-closed) — UI (inc 4) เอาไปซ่อนเมนู
- **seed-dev** — `seedDemoEntitlements()` เปิดครบทุกโมดูลจาก `entitlementModuleSchema.options`
  (ไม่ hardcode) · **upsert** ไม่ใช่ doNothing → re-seed หลังเพิ่มโมดูลใหม่ได้ครบ · แตก helper กัน `main()` เกิน 120 บรรทัด
- integration +2 (`bot-flow`): botEnabled=true แต่ไม่มี entitlement row → **ไม่ตอบ** (fail-closed ทะลุ pipeline จริง) ·
  ซื้อ bot ไม่ซื้อ ai + aiEnabled → escalate + `aiCalled === false`
- **verify จริง** (DoD ข้อ 3): `seed:dev` รันจริง → ws_demo ได้ 8 โมดูลใน DB · start api :3099 →
  `GET /inbox/entitlements` ไม่ auth = **401** · login แล้ว = **200 + 8 โมดูล**

## ถัดไป (ยังไม่เริ่ม)

- **Increment 4 — UI**: `apps/inbox` เรียก `GET /inbox/entitlements` แล้วซ่อนเมนูที่ไม่ได้ซื้อ (UX ไม่ใช่ security)
- ยังไม่มี **route guard** (`requireEntitlement` preHandler) — **ตั้งใจ**: ตอนนี้ยังไม่มี endpoint ที่ขายแยกจริง
  (inbox/routing ปัจจุบัน = core · ช่องทางแชท gate ด้วยข้อมูล) → สร้างตอนมีฟีเจอร์แรกที่ต้องใช้ ไม่สร้าง dead code ทิ้งไว้
- admin UI แก้ entitlement ต่อ workspace (ตอนนี้ต้อง update row เอง)

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
