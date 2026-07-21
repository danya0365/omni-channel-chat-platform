---
name: phase-6-progress
description: Phase 6 (entitlement — เปิดฟีเจอร์ต่อ tenant) **จบแล้ว merged main (PR #10)** — กลไกครบ (domain/DB/บังคับที่ server/route guard) + ฟีเจอร์แรกที่ใช้กลไก = จอจัดการบอท · gate 260 + integration 54 + e2e 3/3. อ่านเมื่อจะเพิ่มฟีเจอร์ที่ขายแยก / แตะ entitlement / ทำ admin เปิดปิดโมดูล
metadata:
  node_type: memory
  type: log
  status: active
  scope: global
  updated: 2026-07-21
  originSessionId: 3be9577c-b819-462f-a61d-267f34fc9eb5
  modified: 2026-07-21T05:27:06.811Z
---

# Phase 6: Entitlements (เปิดฟีเจอร์ต่อ tenant) — ✅ จบแล้ว

> อ่านคู่: [[product-direction-per-tenant]] (แนวทางหลัก) + [[adr-0007-phase-6-entitlements]] (การตัดสินใจ)

## สถานะ (2026-07-21) — **merged เข้า `main` แล้ว (PR #10 · `49814c7`)**

- ✅ Increment **1-4 ครบ** · working tree สะอาด · branch `feature/phase-6-entitlements` merge แล้ว (ลบทิ้งได้)
- ✅ verify ล่าสุด: `pnpm gate` **260 unit** · `pnpm test:integration` **54** ·
  **e2e browser 3/3** · boundaries 208 modules · check:app-routing ผ่าน
- ✅ Phase 4 (PR #2–6) · Phase 5 (PR #8) · Phase 6 (PR #9, #10) อยู่ใน `main` หมดแล้ว —
  **ไม่มี branch ค้างที่ยังไม่ merge**

### 🎯 สิ่งที่ Phase 6 ให้ (สรุปให้ session ใหม่)

| ต้องการ                       | ใช้อะไร                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| เช็คสิทธิ์ใน service/consumer | `hasEntitlement(ent, 'module')` จาก `@omni/domain` + repo `entitlements.get(ws)`                               |
| gate route ที่ขายแยก          | `requireEntitlement(req, reply, deps, 'module', {stateChanging})` — `apps/api/src/routes/entitlement-guard.ts` |
| ให้ UI ซ่อนเมนู               | `GET /inbox/entitlements` → hook `useEntitlements().has('module')`                                             |
| เพิ่มโมดูลใหม่                | แก้ `entitlementModuleSchema` (union) อย่างเดียว — **ไม่ต้อง migration** (jsonb array)                         |
| ตัวอย่างครบวง                 | โมดูล `bot`: consumer gate + routes `/inbox/bot/*` + drawer ใน inbox + e2e                                     |

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

## 🔜 ถัดไป — ตัวเลือกที่เปิดอยู่ (ยังไม่เลือก · พี่เคาะเอง)

> ไม่มีงานค้างกลางคัน ทุกอย่าง merged — session ใหม่เริ่มจากศูนย์ได้ทันที เลือกได้อิสระ

| ตัวเลือก                                                                                                            | ทำไมน่าทำ                                                       | ต้นทุน/ข้อควรระวัง                                                              |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **A. Admin UI จัดการ entitlement**                                                                                  | ลูกค้าจ่ายเพิ่ม = ต้องเข้า DB `UPDATE` เอง (คอขวดตอนขายจริง)    | **ต้องทำ role/owner ใน `agents` ก่อน** (ยังไม่มี) → งานบานกว่าที่คิด            |
| **B. Marketing / go-to-market** ([[marketing-page-brief]])                                                          | มีของขายจริงแล้ว (inbox+LINE+bot+AI) แต่ยังไม่มีหน้าขาย         | ต้องเคาะ **ICP + positioning ก่อน** (เป็น input ของทุกอย่าง) · pricing เคาะแล้ว |
| **C. follow-up Phase 5** — ยิง Anthropic จริง 1 ครั้ง · hardening (AI timeout/rate-limit, outbox retention/cleanup) | AI ยัง **ไม่เคยยิง API จริง** เลย (เคลมได้แค่ beta)             | ต้องมี `ANTHROPIC_API_KEY` จริง · hardening ไม่มี user เห็นทันที                |
| **D. ช่องทางใหม่** (Messenger / IG / WhatsApp)                                                                      | ขยายของที่ขายได้ · adapter pattern พิสูจน์แล้ว 2 รอบ (web/LINE) | ต้องมี dev account ของแต่ละเจ้า · ใช้ `/new-channel` + mirror `channel-line`    |
| **E. ฟีเจอร์ที่ขายแยกตัวถัดไป**                                                                                     | กลไก entitlement พร้อมแล้ว — เขียน + ผูก 1 โมดูล + guard        | **ควรรอ demand จริง** (ADR-0007: สร้างกลไกก่อน เขียนฟีเจอร์ตอนมีคนจ่าย)         |

**ความเห็น Iris:** ถ้าเป้าคือ "หาเงิน" → **B** (ของพร้อมขายแล้ว แต่ไม่มีหน้าขาย = ขายไม่ได้) ·
ถ้าเป้าคือ "ทำของให้พร้อมส่งมอบ" → **C** (AI ที่ไม่เคยยิงจริงคือความเสี่ยงที่ค้างอยู่) ·
**A** รอจนมีลูกค้าจ่ายจริงคนที่ 2-3 ค่อยทำ (ก่อนหน้านั้น UPDATE row เองเร็วกว่า)

## Gotchas

- **`workspace_bot_config` ไม่ถูกรื้อ** — Phase 6 additive · สิทธิ์ (entitlement) กับสวิตช์ใช้งาน (bot config) เป็นคนละเรื่อง
- ทุกจุดที่ gate ต้องมี test **ทั้งสองทาง** (มีสิทธิ์ / ไม่มีสิทธิ์)
- flag คือหนี้ — ฟีเจอร์ไหนกลายเป็น core (ทุกคนได้) ให้ **ลบโมดูลออกจาก union** อย่าปล่อยค้าง
- เพิ่มโมดูลใหม่ = แก้ `entitlementModuleSchema` อย่างเดียว **ไม่ต้อง migration** (jsonb array)
- `apps/billing` (ใบเสนอราคา) อยู่ **นอก** pnpm workspace/gate — แก้แล้ว `pnpm gate` ไม่กวาด ·
  รันด้วย `cd apps/billing && npm run dev` · ราคา/ฟีเจอร์ใน `src/data/mock/mockFeatures.ts`

## วิธีรัน / verify

- gate: `pnpm gate` (lint + typecheck + **test 260** + boundaries 208 + app-routing)
- integration: `pnpm db:up` แล้ว `pnpm test:integration` (**54**)
- e2e browser: `pnpm --filter @omni/inbox e2e` (**3 เคส** · ต้อง db:up · ดู [[inbox-e2e-harness]])
- migration ใหม่: `pnpm --filter @omni/db db:generate` · dev DB apply อัตโนมัติผ่าน `runMigrations` ใน integration test
