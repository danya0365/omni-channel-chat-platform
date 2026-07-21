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
  modified: 2026-07-21T05:18:03.983Z
---

# Handoff — Phase 6: Entitlements (เปิดฟีเจอร์ต่อ tenant)

> อ่านคู่: [[product-direction-per-tenant]] (แนวทางหลัก) + [[adr-0007-phase-6-entitlements]] (การตัดสินใจ)
> Phase 5 ค้างที่ PR-ready ยังไม่ merge — ดู [[phase-5-progress]]

## สถานะ (2026-07-21) — Increment 1-3 commit+push แล้ว · **Increment 4 (bot admin UI) เขียวแต่ยังไม่ commit**

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

## ✅ Increment 4 — Bot admin UI (ฟีเจอร์แรกที่ gate ด้วย entitlement จริง) — ยังไม่ commit

> พี่เคาะ: แผนเดิม "ซ่อนเมนูที่ไม่ได้ซื้อ" **ไม่มีอะไรให้ซ่อนจริง** (sidebar มีแต่ของ core) →
> เปลี่ยนเป็นทำ **จอจัดการบอท** ซึ่งได้ทั้ง route guard ของจริง + เมนูที่ซ่อนจริง + ปิด follow-up Phase 5 (admin UI)

- **4a domain** `services/manage-bot-rules.ts` — `createManageBotRules` (list/create/update/remove +
  getConfig/setConfig) · verify channel เป็นของ workspace (กันผูก rule ข้าม tenant) · **10 unit** ·
  ports: `BotRuleRepository` +listAll/findById/insert/update/remove + `BotRulePatch` · `WorkspaceBotConfigRepository.upsert`
- **4a db** — repo CRUD (`byId` helper บังคับ scope workspace ทุก op) + config upsert · **5 integration**
  (ครบวง CRUD · ไม่รั่วข้าม tenant · channel ข้าม workspace · upsert ไม่ duplicate · cascade)
- **4b api** `routes/bot-admin.ts` — `GET/PUT /inbox/bot/config` · `GET/POST /inbox/bot/rules` ·
  `PATCH/DELETE /inbox/bot/rules/:ruleId` · **ทุก route ผ่าน `requireEntitlement(...'bot')`**
  (`routes/entitlement-guard.ts`: 401 auth → 403 origin → 403 `entitlement_required`) · **10 route test**
- **4c inbox UI** — `use-entitlements` (โหลดตอน WS connect · default ว่าง = ซ่อนไว้ก่อน) ·
  `use-bot-admin` (โหลดตอนเปิดจอ = interaction-driven) · `lib/bot-view.ts` pure +**5 unit** ·
  components `bot/{bot-panel,bot-rule-form,bot-rule-row,bot-switches}` (แยกไฟล์กัน God component) ·
  sidebar โชว์ปุ่ม "ตั้งค่าบอท" **เฉพาะเมื่อ `has('bot')`** · สวิตช์ AI disabled ถ้าไม่ได้ซื้อ `ai`
- **verify**: gate **260 unit** · integration **54** · **e2e browser 3/3** (เพิ่มเคส bot admin: เปิดจอ →
  สลับสวิตช์ → เพิ่ม/ปิด/ลบกติกา ผ่าน API จริง)

### 🐞 บทเรียน: seed เปิด bot ทำให้ e2e เดิมพัง (มาก่อน Phase 6)

`seed-dev` เปิด `botEnabled=true` ตั้งแต่ Phase 5 → bot escalate สายที่ไม่ match rule แล้ว **ส่ง notice**
→ `lastMessage` ของสายกลายเป็นข้อความบอท → e2e เดิมที่หา row ด้วยข้อความลูกค้า **หาไม่เจอ (พังทั้ง 2 เคส)**
· แก้ที่ e2e: `beforeEach` ปิดบอทผ่าน `PUT /inbox/bot/config` (endpoint ใหม่ของ Phase 6 เอง) แล้วเทสต์บอทเปิด/ปิดเอง

## ถัดไป (ยังไม่เริ่ม)

- admin UI แก้ **entitlement** ต่อ workspace (ตอนนี้ต้อง UPDATE row เอง) — ติดที่ `agents` ยังไม่มี role/owner
- ฟีเจอร์ถัดไปที่ขายแยก = เขียนแล้วผูก 1 โมดูล + ครอบด้วย `requireEntitlement` (pattern พร้อมแล้ว)

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
