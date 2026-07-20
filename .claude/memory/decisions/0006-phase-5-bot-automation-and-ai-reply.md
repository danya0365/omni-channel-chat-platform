---
name: adr-0006-phase-5-bot-automation-and-ai-reply
description: 'ADR-0006 — Phase 5: bot/automation engine (keyword→canned reply→escalate) + AI reply (Claude API). bot ตื่นผ่าน consumer แยก (additive multi-subscriber outbox, cursor ต่อ subscriber) · bot เป็นเจ้าของสายใหม่ก่อน (assignee=bot → escalate=null queue) · rules ต่อ workspace (plaintext) · AI = adapter @omni/bot-anthropic (inject fetch seam) + ANTHROPIC_API_KEY env + per-workspace enable · ปม PII. อ่านเมื่อทำ Phase 5 / แตะ bot / outbox multi-subscriber / ต่อ Claude API'
metadata:
  node_type: memory
  type: decision
  status: active
  scope: global
  updated: 2026-07-20
  originSessionId: 9c11ffe5-d555-468b-8678-432ff977c6c2
  modified: 2026-07-20T08:38:46.756Z
---

# ADR-0006 — Phase 5: Bot / Automation + AI Reply

## บริบท

Phase 1-4 มี omni-channel จริงแล้ว (web + LINE เข้า inbox เดียว · routing/assignment · realtime ผ่าน
transactional outbox). Phase 5 = เพิ่ม **ชั้น automation** — ให้ระบบ **ตอบลูกค้าเองก่อน** แล้ว **escalate หา human**
เมื่อบอทเอาไม่อยู่ · roadmap เขียนไว้ = `keyword → canned reply → escalate` + `AI reply (Claude API)`

**ทุนเดิมที่ reuse ได้ (จากผลสำรวจ):**

- `sendOutbound({..., sender:{kind:'bot'}})` — persist→dispatch(web/LINE)→retry→realtime ครบ channel-agnostic
  (`sender` default = `{kind:'bot'}` อยู่แล้ว · `send-outbound-message.ts`)
- `messageSender` มี `{kind:'bot'}` · `assignee` = `agent|bot|null` (ADR-0004 เตรียมไว้ · `conversation.ts`)
- **ทุกช่องทาง inbound ลอด choke point เดียว** = `ingest` wrapper (`wiring.ts`) + publish `inbound_message.received`
- outbox pattern (transactional) + `manageConversation.assign/unassign/close/reopen`
- crypto AES-256-GCM + credential-repo pattern + env dev-default/warn pattern

**Greenfield:** ยังไม่มี bot/canned/template ในโค้ดเลย

## การตัดสินใจ

### 1. Bot ตื่นผ่าน **consumer แยก** — ขยาย outbox เป็น multi-subscriber แบบ **additive**

- bot = **event consumer ตัวใหม่** subscribe `inbound_message.received` (decoupled จาก request path · LINE/web ได้ 200 เร็ว · เคารพ persist-before-deliver — bot ยิง reply หลัง commit)
- ⚠️ outbox ปัจจุบัน = **single-cursor** (`processedAt` + consumer เดียว fan-out agent WS). เพิ่ม consumer ที่ 2 บนตารางเดียวกันไม่ได้ (ตัวไหน `markProcessed` ก่อน อีกตัวไม่เห็น row)
- **เลือก additive (ไม่รื้อของเดิม):** เพิ่มตาราง `outbox_cursors (subscriber text PK, last_created_at, last_id)` · bot อ่าน outbox ด้วย **cursor ของตัวเอง** (`WHERE (created_at,id) > cursor ORDER BY created_at,id LIMIT n` + lock cursor row กันหลาย instance) · **agent WS consumer เดิมไม่แตะเลย** (ยังใช้ `processedAt`)
- เพิ่ม subscriber อนาคต = insert cursor row (generic, ไม่ต้อง migration schema outbox)

### 2. Bot ownership = **bot รับสายใหม่ก่อน → escalate = คืน queue**

- สายใหม่ (`created.conversation`) + **bot เปิดใช้กับ channel นั้น** → set `assignee = {kind:'bot'}` อัตโนมัติ
- inbound ถัดมาถ้า `assignee.kind === 'bot'` → bot ประมวลผลตอบ · ถ้า `kind === 'agent'` → **bot เงียบ** (คนดูแลแล้ว)
- **escalate** (keyword ขอคนจริง / ไม่ match rule / (5B) AI ยอมแพ้) → `assignee = null` (เข้า unassigned queue) + reply แจ้งลูกค้า ("กำลังโอนหาทีมงาน") → agent กด "รับเรื่อง" (`assign`) → bot เงียบถาวร
- funnel: `new → bot → (escalate) → unassigned queue → agent` · state เห็นจาก assignee badge ใน inbox (ไม่ต้องเพิ่ม `conversationStatus` ใหม่ — ใช้ assignee ล้วน)

### 3. Bot rules = ตาราง `bot_rules` ต่อ workspace (plaintext, ไม่ใช่ secret)

- `bot_rules`: `id, workspaceId(FK), channelId(nullable = ใช้ทุกช่องทาง), matchType, pattern, reply(jsonb MessageContent), enabled, priority, createdAt/updatedAt`
- **match = `contains` (case-insensitive) + เรียงตาม `priority`** (MVP) — regex เลื่อนออก (injection + ยาก verify)
- pure domain service `applyBotRules(text, rules) → decision: {kind:'reply', content} | {kind:'escalate'} | {kind:'noop'}` — deterministic, unit test ได้ไม่ต้อง network
- **plaintext table แยกจาก `channel_credentials`** (rules ไม่ใช่ secret — อย่ายัดใน cipher blob)

### 4. AI reply (5B) = adapter `@omni/bot-anthropic` + policy rule-first → AI fallback

- ทำ **5A + 5B รวดเดียว** (ตัดสินใจของพี่) · decision policy: **rule match ก่อน** → ไม่ match + AI เปิด → **ถาม Claude API** → AI ตอบได้ = reply · AI บอก "ตอบไม่ได้/ต้องใช้คน" = escalate
- adapter package ใหม่ `@omni/bot-anthropic` (เลียนแบบ `@omni/channel-line`): **inject `fetch` seam** (เหมือน `ContainerConfig.lineFetch`) → test hermetic ไม่ยิง api.anthropic.com จริง
- ⭐ **ใช้ RAW FETCH ไม่ใช่ `@anthropic-ai/sdk`** (เคาะ 2026-07-20 · claude-api skill แนะนำ SDK แต่ Iris ฟันธง raw fetch) — เหตุผล: use case แคบ (1 POST non-streaming, ไม่ใช้ streaming/tool-runner/retry/pagination ของ SDK) · zero-dep philosophy ของโปรเจค (uuidv7/scrypt/crypto เขียนเอง) · pattern channel-line พิสูจน์ hermetic แล้ว · **ปิดความเสี่ยง "เดา API ผิด"**: freeze `anthropic-version: 2023-06-01` header + hardcode `model: 'claude-opus-4-8'` + ครอบ response ด้วย zod (`{content:[{type:'text',text}], stop_reason}`) · POST `https://api.anthropic.com/v1/messages` header `x-api-key`+`anthropic-version` · **ถ้าอนาคตต่อ agent เต็ม (tool use/streaming) ค่อยพิจารณา SDK**
- **API key**: `ANTHROPIC_API_KEY` ผ่าน env (global, dev-default/warn pattern เหมือน AUTH secret) · **per-workspace เปิด/ปิด AI** ผ่าน flag ใน bot config (ตาราง/column) — key เดียวทั้งระบบก่อน (per-workspace key = เลื่อนออก, ใช้ `workspace_secrets` encrypted ทีหลังถ้าต้อง)

### 5. Escalate command ใน `manage-conversation`

- เพิ่ม command wrapper (เช่น `assignBot` / `escalate`) เรียก private `setAssignee` ด้วย `{kind:'bot'}` / `null` (helper รองรับ type แล้ว แค่ยังไม่ exposed) + publish `conversation.updated` (agent เห็น realtime ฟรี)

## เหตุผล

- **consumer แยก (พี่เลือก)** — decoupled, scale หลาย instance ได้, bot ล้มไม่กระทบ inbound 200 · **additive cursor** = ได้ประโยชน์นั้นโดย**ไม่รื้อ agent realtime ที่ verify แล้ว** (ลด regression risk — จุดที่ Iris ยืนยัน)
- **bot เป็นเจ้าของสายก่อน (พี่เลือก)** — state ชัดใน inbox, กัน bot ตอบชนสายที่ agent จับแล้ว, ใช้ assignee model ที่ ADR-0004 เตรียมไว้ (ไม่ migrate)
- **rule-first แล้วค่อย AI** — deterministic ก่อน, ประหยัด cost/latency (ไม่เรียก Claude ทุกข้อความ), fallback เฉพาะที่ rule เอาไม่อยู่
- **inject fetch seam** — pattern เดิมของโปรเจค (lineFetch) พิสูจน์แล้วว่า test ได้ hermetic

## ผลที่ตามมา / ข้อควรระวัง

- ⚠️ **PII เข้า Claude API (5B)** — ข้อความลูกค้าจริงวิ่งออกนอกระบบไป Anthropic: (ก) **per-workspace ต้อง opt-in** ก่อนเปิด AI (default ปิด) · (ข) **ไม่ log prompt/response เต็มเป็น plaintext** (ตาม PII guideline) · (ค) ส่งเฉพาะข้อความที่จำเป็น (ไม่แนบ PII เกิน เช่น เบอร์/อีเมล contact) · (ง) บันทึกใน ADR ว่าเป็น external data flow — ต้องมี consent/นโยบายตอน production
- ⚠️ **2 กลไก tracking บน outbox** (agent = `processedAt`, bot = cursor table) — ไม่ uniform แต่ additive/เสี่ยงน้อย · retention/cleanup outbox ต้องดูทั้งสอง (ยังไม่ทำ MVP)
- ⚠️ **loop ระวัง** — bot reply เป็น `outbound_message.sent` (ไม่ trigger bot ซ้ำ เพราะ bot subscribe แค่ `inbound_message.received`) · แต่ต้องกัน bot ตอบ inbound ของ **สายที่ assignee=agent แล้ว**
- ⚠️ **AI cost/latency/rate-limit** — เรียก Claude เป็น network นอก tx (หลัง commit, fire-and-forget ใน consumer) · timeout + fallback escalate ถ้า API ล่ม
- bot reply/escalate reuse `sendOutbound`/`manageConversation` เดิม → dispatch ถูกช่องทาง (web/LINE) + realtime ฟรี
- **LINE verify จริงยังทำไม่ได้** (เหมือน ADR-0004) — bot flow ฝั่ง LINE พิสูจน์ด้วย integration (signed webhook → bot reply persisted + escalate) ไม่เคลมยิง LINE จริง

## ขอบเขต (ไม่รวม Phase 5)

multi-bot/persona ต่อ workspace (`botId` identity) · regex/NLP intent matching · conversation flow/state machine หลายสเต็ป ·
per-workspace Claude key (encrypted) · streaming AI reply · AI ครอบ context ประวัติยาว/RAG · bot analytics ·
rich message (flex/quick-reply) — Phase 6+
