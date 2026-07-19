---
name: adr-0004-phase-4-routing-and-line-channel
description: 'ADR-0004 — Phase 4: routing/assignment (manual assign + status + filter) + LINE channel (adapter mirror channel-web, HMAC verify, credential เก็บ DB ต่อ channel แบบ encrypted). อ่านเมื่อทำ Phase 4 หรือสงสัยเรื่อง assignment / LINE / channel credential'
metadata:
  node_type: memory
  type: decision
  status: active
  scope: global
  updated: 2026-07-19
  originSessionId: c95243e8-0ef0-4fc2-b3aa-cfd6f5dd01c6
---

# ADR-0004 — Phase 4: Routing/Assignment + LINE Channel

## บริบท

Phase 1-3 มี web channel end-to-end + agent inbox realtime แล้ว (single channel) Phase 4 = พิสูจน์
**"omni-channel" จริง**: เพิ่มช่องทางที่ 2 (**LINE**) เข้า inbox เดียวกัน + ให้ทีมงาน **assign/route** สายได้

ทุนเดิม: `conversation.assignee` (agent/bot/null) + `conversationStatus` (open/closed) + `messages.raw_payload`
jsonb (seam payload ดิบ) + `channel-web` เป็นแม่แบบ adapter + pipeline (ingest/sendOutbound/outbox realtime)

## การตัดสินใจ

### 1. Routing/Assignment = manual (MVP) — ทำก่อน (verify ได้เต็ม)

- **manual assignment**: agent กด "รับเรื่อง" → assign conversation ให้ตัวเอง (`assignee = {kind:'agent', agentId}`)
  · unassign · **close/reopen** (`status` open↔closed)
- operation เป็น domain service (assign/unassign/close) + **publish event** → agent inbox คนอื่นเห็น sync (ผ่าน outbox→drain เดิม)
- inbox UI: ปุ่มรับเรื่อง/ปิดสาย + **filter** (mine / unassigned / all) + badge assignee
- **auto-routing (round-robin / rules) เลื่อนออก** — MVP ใช้ manual + unassigned queue ก่อน (โครง assignee รองรับ auto ทีหลังไม่ต้อง migrate)

### 2. LINE channel = adapter mirror channel-web — ทำทีหลัง (contract-tested)

- `@omni/channel-line` โครงเหมือน `channel-web`: **signature verify** (x-line-signature = HMAC-SHA256 ของ raw body ด้วย channel secret) · **inbound** (LINE event → `IngestInboundCommand`) · **outbound gateway** (unified message → LINE Messaging API)
- **inbound**: `POST /channels/line/:channelId/webhook` — ต้องอ่าน **raw body** ก่อน parse (Fastify content-type parser) เพื่อ verify HMAC · reply ทันที 200 · map event → ingest (เข้า pipeline เดิม)
- **outbound**: ใช้ **LINE push API** (ไม่ใช่ reply token) — agent อาจตอบช้ากว่า reply token หมดอายุ (~30s) · push ด้วย LINE userId (= externalId ของ identity)
- provider payload ดิบ → เก็บ `messages.raw_payload` (seam มีแล้ว) · `channelType` enum เพิ่ม `'line'`

### 3. LINE credential = DB ต่อ channel + **encrypted at rest**

- ตาราง `channel_credentials` (หรือ jsonb column) เก็บ **channel access token + channel secret ต่อ channel** — รองรับ multi-tenant หลาย LINE channel
- **encrypt at rest**: AES-256-GCM · key จาก env `CHANNEL_ENCRYPTION_KEY` (32 byte) · decrypt เฉพาะตอน verify/send ใน adapter · **ห้าม log plaintext**
- domain ไม่รู้จัก credential (เป็น infra) — adapter/db จัดการ encrypt/decrypt

## เหตุผล

- **routing ก่อน** — verify ได้จริง 100% (logic ภายใน) ต่างจาก LINE ที่ผูก external (ตัดสินใจของพี่)
- **manual assign MVP** — คุ้มค่า+เร็ว, โครง assignee เดิมรองรับ auto ทีหลัง (ไม่ rewrite)
- **LINE creds เข้ารหัสใน DB** (ตัดสินใจของพี่) — มาตรฐาน SaaS multi-tenant · env ไม่ scale กับหลาย channel · เข้ารหัสกัน DB dump รั่ว
- **push แทน reply token** — ยืดหยุ่นกว่าสำหรับ agent inbox (ตอบเมื่อไรก็ได้)

## ผลที่ตามมา / ข้อควรระวัง

- ⚠️ **LINE e2e verify จริงในนี้ไม่ได้** (ไม่มี public webhook URL / LINE bot จริง / มือถือยิงเข้า) — ทำได้แค่
  **contract test ด้วย fixture payload จาก LINE docs** + unit test · **จะไม่เคลมว่า verify จริง** (ตาม DoD ข้อ 3)
- ⚠️ Fastify ต้องเก็บ **raw body** ของ webhook route (custom content-type parser) — HMAC ต้องใช้ byte ดิบ
- ⚠️ `CHANNEL_ENCRYPTION_KEY` = secret จริง → env เท่านั้น · dev มี default (warn) เหมือน AUTH_SESSION_SECRET · **rotate = ต้อง re-encrypt** (ยังไม่ทำ MVP)
- ⚠️ LINE reply/push มี rate limit + quota — MVP ไม่ทำ retry/backoff (log fail ไว้ก่อน)
- assign/close event ใช้ outbox pipeline เดิม → agent sync realtime ฟรี

## ขอบเขต (ไม่รวม Phase 4)

auto-routing (round-robin/skill-based) · LINE rich message (sticker/image/flex — text ก่อน) · credential rotation/KMS ·
reply-token optimization · channel อื่น (Messenger/IG/WhatsApp) — Phase 5+
