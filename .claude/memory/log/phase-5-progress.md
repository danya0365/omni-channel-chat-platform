---
name: phase-5-progress
description: สถานะ Phase 5 (bot/automation + AI reply) — Increment 1 (domain) + 2 (db) + 3a (bot consumer rule-only) เขียวครบ (gate 203 + integration 40) · ถัดไป = 3b (AI adapter). ยังไม่ commit (working tree บน feature/phase-5-bot-automation). อ่านตอนทำ Phase 5 ต่อ / แตะ bot / outbox cursor / bot-anthropic
metadata:
  node_type: memory
  type: log
  status: active
  scope: global
  updated: 2026-07-20
  originSessionId: 9c11ffe5-d555-468b-8678-432ff977c6c2
  modified: 2026-07-20T09:07:53.998Z
---

# Handoff — Phase 5 กำลังทำ (bot/automation + AI reply)

> อ่านไฟล์นี้ + [[adr-0006-phase-5-bot-automation-and-ai-reply]] แล้วทำต่อได้ทันที
> Phase 4 จบ/merged main แล้ว ([[phase-4-progress]])

## สถานะ (2026-07-20)

- branch **`feature/phase-5-bot-automation`** (แตกจาก `main` ที่ทันแล้ว) · **ยังไม่ commit อะไรเลย** — ทุกอย่างอยู่ใน working tree (รอพี่สั่ง commit ตามกฎเหล็ก)
- **ADR-0006 เขียนแล้ว** + pointer ใน MEMORY.md · decisions หลัก: consumer แยก (additive multi-subscriber outbox) · bot รับสายใหม่ก่อน (escalate=null queue) · rules ต่อ workspace · AI = adapter inject fetch · 5A+5B รวด
- ⭐ **ถัดไป: Increment 3b** (AI adapter `@omni/bot-anthropic` raw-fetch) — 3a เขียวครบแล้ว ดูล่าง

## ✅ Increment 1 — Domain (pure) — เขียว (gate 194 unit)

- `schema/bot-rule.ts` — `BotRule` (id `botr`, workspaceId, channelId nullable, matchType `contains`, pattern, `action`=reply(content)|escalate, enabled, priority) + `botRuleMatchTypeSchema`/`botRuleActionSchema`
- `services/apply-bot-rules.ts` — pure `applyBotRules(text, rules) → BotDecision` (`reply` | `escalate` | `no_match`) · match contains(ci) + เรียง priority · filter disabled · **7 unit ครบ branch**
- `ports.ts` — `BotRuleRepository.listEnabled(workspaceId, channelId)`
- `services/manage-conversation.ts` — เพิ่ม command **`assignBot`** (assignee={kind:'bot'}) + **`escalate`** (assignee=null) · +2 unit
- `ids.ts` — prefix `botRule:'botr'` + `BotRuleId`
- **refactor** `wiring.ts` — แตก **`buildManageConversation(handle, triggerDrain)`** helper (มี `run` combinator) กัน God function (createContainer เกิน 120 บรรทัดตอนเพิ่ม 2 command) · แก้ mock ใน `app.test.ts` ให้มี assignBot/escalate

## ✅ Increment 2 — DB — เขียว (gate + integration 37, +3 ใหม่)

- `schema.ts` — ตาราง **`bot_rules`** (action jsonb `$type<BotRuleAction>`, index `ix_bot_rules_lookup`) + **`outbox_cursors`** (subscriber PK, last_created_at, last_id) · import `boolean`/`integer`/`BotRuleAction`
- `repositories/bot-rule-repository.ts` — `createBotRuleRepository` (listEnabled: channel + global channelId=null, เรียง priority, parse ด้วย botRuleSchema)
- `repositories/outbox.ts` — **`createOutboxCursorStore.claimBatch(subscriber, limit)`** — tx เดียว: lock cursor row (FOR UPDATE) → read rows หลัง (created_at,id) → advance cursor → คืน rows ให้ประมวลผล**นอก tx** · at-most-once · **ไม่แตะ processed_at** ของ agent consumer เดิม
- migration **`0004_chilly_blindfold.sql`** (+ meta snapshot/journal) — apply แล้วบน dev DB
- integration `bot-phase5.integration.test.ts` (3 tests) — listEnabled scope/priority/disabled · claimBatch cursor advance + subscriber แยก cursor + ไม่แตะ processed_at + limit
  - ⚠️ **บทเรียน**: `outbox_cursors` เป็น global (ไม่มี FK→workspaces) → `truncate workspaces cascade` ไม่ล้าง ต้อง truncate เองใน beforeEach (test isolation)

## ✅ Increment 3a — bot consumer (rule-only) — เขียว (gate 203 unit +9 · integration 40, +3 ใหม่)

- **ตาราง `workspace_bot_config`** (migration **0005**) — `workspaceId` PK, `botEnabled`/`aiEnabled` bool (default false) + domain `WorkspaceBotConfigRepository.get` + db repo · **ไม่มี row = bot ปิด** (verify: test "bot ปิด → ไม่ตอบ")
- **event `inbound_message.received` เพิ่ม field `conversationCreated: boolean`** (ingest publish) — bot ใช้แยก "สายใหม่ (auto-own)" ออกจาก "สาย escalate ค้าง (เงียบ รอ human)" · แก้ test เดิม 2 จุด (phase3-repos publish manual, ใช้ `toMatchObject` เลยไม่พังตัวอื่น)
- **`apps/api/src/realtime/bot-consumer.ts`** — `createBotConsumer` → `drainBot()`: `claimBatch('bot')` → loop เฉพาะ `inbound_message.received` → `ownershipFor(assignee, isNew)`: bot→handle · agent→skip · null+new→own · null+ไม่ new→skip (กัน re-grab สาย escalate) · `applyBotRules` → reply(sendOutbound sender bot) / escalate+notice / no_match→escalate+notice · **escalate branch ไม่ assignBot** (กัน assignee flap null→bot→null) · 9 unit ครบ branch
- **wire** (`wiring.ts`) — `buildBotConsumer` helper (กัน God function <120) · reorder ให้ sendOutbound/manageConversation มาก่อน ingest · `triggerBotDrain()` fire-and-forget ใน ingest คู่กับ `triggerDrain` (cursor แยก) · `inFlightBotDrain` รอใน close()
- **seed** `seed-dev.ts` — เปิด bot config ws_demo (aiEnabled=false) + 4 rules (id คงที่): "สวัสดี"→ทักทาย(10), "ราคา"→ข้อมูล(20), "แอดมิน"/"คุยกับคน"→escalate(5) · verify: seed รันจริง + query DB เจอครบ
- integration `bot-flow.integration.test.ts` (2) — inbound "สวัสดี" (web จริง) → bot assignBot + reply canned persisted → "แอดมิน" → escalate (assignee=null) + notice · + "bot ปิด → ไม่ตอบ"

### 🐞 บทเรียนใหญ่: outbox cursor µs/ms precision bug (fix migration 0006)

- **bug ใน Increment 2** (OutboxCursorStore) โผล่ตอน real flow: `outbox.created_at` = `now()` = **µs precision** แต่ drizzle อ่านผ่าน **JS Date (ms)** → cursor เก็บ `last_created_at` ที่ **ต่ำกว่าค่าจริง** → `created_at > cursor` เป็น true ของ row ที่เพิ่ง process → **row เดิมโผล่ซ้ำทุกครั้ง** (bot ตอบซ้ำ)
- test Increment 2 ไม่เจอเพราะใช้ explicit `new Date(Date.UTC(...))` (ms ตรงอยู่แล้ว ไม่มี µs)
- **fix**: `outbox.created_at` + `outbox_cursors.last_created_at` → `timestamp(3)` (ms) · migration **0006** · round-trip JS Date ตรงเป๊ะ → cursor (created_at, id) เทียบถูก
- ⚠️ เหลือ edge เชิงทฤษฎี (2 row ใน ms เดียว + id random uuidv7 sort สลับ + คั่น batch) = อาจ skip — ยอมรับได้ (bot best-effort/at-most-once ตาม ADR) · ถ้าต้อง exactly-once จริง ต้องใช้ monotonic seq

**3b — AI reply (ถัดไป):**

- adapter package **`@omni/bot-anthropic`** (เลียนแบบ channel-line) · **RAW FETCH + inject seam** (ไม่ใช่ `@anthropic-ai/sdk` — ดู ADR-0006 decision 4 + เหตุผลด้านล่าง) · `POST /v1/messages` · header `anthropic-version: 2023-06-01` + `x-api-key` · body `{model:'claude-opus-4-8', max_tokens, system, messages}` · **effort/max_tokens ต่ำ** (ตอบสั้น) · parse response ด้วย zod (`{content:[{type:'text',text}], stop_reason}`)
- env `ANTHROPIC_API_KEY` (optional + warn pattern เหมือน AUTH secret · ดู server.ts/env.ts/wiring.ts ContainerConfig) · inject `anthropicFetch` seam (test hermetic)
- policy: rule no_match + `aiEnabled` → ถาม Claude → ตอบได้=reply / ยอมแพ้=escalate · AI ล้ม/timeout → escalate
- ⚠️ **PII**: per-workspace opt-in (aiEnabled default false) · ห้าม log prompt/response เต็ม · ส่งเฉพาะข้อความจำเป็น

## Decision: bot-anthropic = raw fetch (ไม่ใช่ @anthropic-ai/sdk) — เคาะ 2026-07-20

พี่เครียดเลือกไม่ถูก · **Iris ฟันธง: raw fetch + inject seam** เพราะ (1) use case แคบ = 1 POST non-streaming, ของที่ SDK เก่ง (streaming/tool-runner/retry/pagination) ไม่ได้ใช้ (2) pattern channel-line พิสูจน์แล้ว hermetic test ได้ (3) zero-dep เป็นตัวตนโปรเจค (uuidv7/scrypt/crypto เขียนเอง) (4) ADR-0006 เคาะไว้แล้ว · **ปิดความเสี่ยง "เดา API ผิด"** (ที่ claude-api skill ห่วง) ด้วย: freeze `anthropic-version: 2023-06-01` + hardcode `model:'claude-opus-4-8'` + zod response schema · **ถ้าอนาคตต่อ Claude แบบ agent เต็ม (tool use/streaming) ค่อยพิจารณา SDK**

## วิธีรัน / verify

- gate: `pnpm gate` (lint+typecheck+test 203+boundaries) · integration: `pnpm db:up` แล้ว `pnpm test:integration` (40)
- migration ใหม่: `pnpm --filter @omni/db db:generate` (drizzle diff) · dev DB apply อัตโนมัติผ่าน `runMigrations` ใน integration test
- ก่อน commit ต้องผ่าน gate + integration + (แตะ flow → verify จริง ตาม DoD ข้อ 3)

## Gotchas

- โหลด `claude-api` skill ก่อนเขียนโค้ด Claude (5B) — แต่เราเลือก raw fetch จึงใช้แค่ wire shape (`/v1/messages`, model id, version header)
- outbox มี 2 กลไก tracking: agent=`processed_at` (เดิม) · bot=cursor table (ใหม่) — additive, อย่าให้ bot ไปแตะ processed_at
- bot reply → `outbound_message.sent` (ไม่ trigger bot ซ้ำ เพราะ bot subscribe แค่ inbound_message.received) · แต่ต้องกัน bot ตอบสายที่ assignee=agent
