---
name: phase-4-progress
description: 'สถานะ Phase 4 (routing + LINE) — จบแล้ว + merged เข้า main (PR #2–#6). sub-phase A+B + hardening pass (dedup/tx-split/retry) + tech debt B (failed-status realtime, LINE profile name, auth httpOnly cookie ADR-0005) ครบ verify. ถัดไป = Phase 5 (bot/AI reply). อ่านตอนเริ่ม Phase 5 / ทบ deferred tech debt / แตะ auth-cookie'
metadata:
  node_type: memory
  type: log
  status: active
  scope: global
  updated: 2026-07-20
  originSessionId: c95243e8-0ef0-4fc2-b3aa-cfd6f5dd01c6
---

# Handoff — Phase 4 จบแล้ว (routing + LINE channel) · merged เข้า main

> อ่านไฟล์นี้ + [[project-overview]] + [[adr-0004-phase-4-routing-and-line-channel]] แล้วเริ่ม Phase 5 ต่อได้ทันที
> phase-2/3-progress ถูก archive แล้ว (Phase จบ merged main) — ดู `_archive/`

## สถานะ (อัปเดต 2026-07-20 — ยืนยันจาก origin)

- ✅ **Phase 4 merge เข้า `main` ครบแล้ว** ผ่าน **PR #2–#6** (ตัวปิดท้าย **PR #6 = `0180af4`** รวม hardening + tech debt B)
  - trunk จริง = **`main`** (PR base = main · Phase 1–3 อยู่ใน main แล้วผ่าน **PR #1**) — ไม่ใช่ stack บน `feature/phase-1-stack-skeleton`
  - branch **`feature/phase-4-routing-line`** ถูก **ลบทิ้ง**บน remote หลัง merge · local ยังปักที่ branch นี้และตามหลัง `main` 1 merge commit (พี่ค่อย `git checkout main && git pull` ทีหลัง)
  - remote: `git@github.com:danya0365/omni-channel-chat-platform.git`
- **sub-phase A (routing/assignment) เสร็จ + verify ครบ** · **sub-phase B (LINE channel) เสร็จ + verify (gate+integration+e2e)**
- ⭐ **ถัดไป**: ขยับ **Phase 5** (bot/automation keyword→canned→escalate + AI reply Claude API, ADR แยก, ปม PII)
- gate เขียว **165 unit** + integration **34** · inbox build ผ่าน · **Playwright e2e 2 ผ่าน** (browser จริง)
- ✅ เคลียร์แล้ว: verify browser inbox (Playwright e2e) · `/new-channel line` ([[line]] spec) · seed LINE demo channel (`chn_line_demo`)

## 🔧 Hardening pass + เก็บ tech debt B (2026-07-20) — เสร็จ + verify ครบ

> ทำหลัง Phase 4 core · commit+push บน `feature/phase-4-routing-line` แล้ว · gate เขียว + integration **34** + Playwright e2e **2/2** (browser จริง)

**Hardening (3 commit):**

- **(a) LINE dedup** `f04d9d4` — partial unique index `ux_messages_external (workspace_id, external_id) WHERE external_id IS NOT NULL` + `onConflictDoNothing` → webhook redelivery ไม่สร้าง message/event ซ้ำ · `MessageRepository.insert` คืน `{inserted}` · ingest early-return + `deduped` flag · migration **0003**
- **(d) tx-split** `fb4bbfa` — แยก domain service เป็น `createPersistOutboundMessage` (ใน tx) + `createDeliverOutboundMessage` (นอก tx) → **เลิกถือ Postgres tx ค้างข้ามการยิง LINE push** · `MessageRepository.updateStatus` · wiring `buildSendOutbound` · export type `SendOutboundMessage`
- **(c) retry idempotent** `9d3e9f5` — `createRetryingOutboundGateway` (3 attempts, backoff [200,600]ms, inject sleep) ครอบ dispatch · `X-Line-Retry-Key` = `lineRetryKey(message.id)` (UUID จาก hash) → LINE dedupe 24ชม. กัน double-send

**เก็บ tech debt B (4 commit):**

- **(6) failed-status realtime** `a5eab10` — event ใหม่ `outbound_message.failed` (deliver service publish ตอนล้ม) → consumer re-fetch → agent WS · inbox `append` เป็น **upsert-by-id** · `MessageBubble` แสดง "⚠️ ส่งไม่สำเร็จ" (`text-error`)
- **(b) LINE contact name** `c9c2064` — `createLineHttpProfileClient` (GET `/v2/bot/profile/{userId}`) + resolver · route เรียก **เฉพาะตอน contact ใหม่** → `updateContactName` (update + publish `conversation.updated` → inbox refresh ชื่อ realtime) · `ContactRepository.updateDisplayName`
- **(e) auth httpOnly cookie** `57aa6ac` (e1 backend) + `1b3c3a3` (e2 frontend) — ดู [[adr-0005-auth-transport-httponly-cookie]] · `@fastify/cookie` · SameSite=Strict + CSRF Origin check · frontend ตัด token ออกจาก localStorage (`credentials:'include'`)

**🧪 capability ใหม่ (durable):** `ContainerConfig.lineFetch` = seam inject LINE fetch (push+profile) → integration test ทำ deliver ล้ม / profile ตอบ แบบ hermetic ไม่ยิง api.line.me จริง (ดู `*-realtime.integration.test.ts`, `line-profile-name.integration.test.ts`, `auth-cookie.integration.test.ts`)

**ยังเปิดค้าง (deferred ถัดไป):** ปิด Bearer/body-token fallback ของ auth (ตอนนี้เปิดไว้ migrate) · `/auth/me` bootstrap (กัน flash ตอน cookie หมดอายุ) · credential rotation/KMS · LINE rich message · queue = pg-boss จริง

> **หมายเหตุ (2026-07-19): refactor inbox UI ทั้งชุด** — พี่ติงว่าโค้ด Next เละ (God component `Inbox.tsx` 419 บรรทัด +
> react-hooks error ค้างที่ gate มองไม่เห็น). แตกเป็น `app/{lib,hooks,components/{ui,auth,inbox}}` (kebab-case) +
> ui primitive (Button/TextInput) · wire inbox lint เข้า gate + eslint architecture rules (max-lines ฯลฯ).
> path เก่าใน sub-phase A ด้านล่าง (`Inbox.tsx`) = stale — logic เดิมยังอยู่ครบ แค่ย้ายที่. ดู `.claude/rules/frontend-next.md` +
> [[frontend-architecture-standard]]. **verify browser แล้ว** ด้วย Playwright e2e headless (`apps/inbox/e2e/inbox.spec.ts`:
> login→เห็นสาย→รับเรื่อง→ตอบ + realtime 2 แท็บ · `pnpm --filter @omni/inbox e2e` · ต้อง db:up + port 4001/4002 ว่าง)

## ✅ Sub-phase A — Routing/Assignment (เสร็จ)

**domain**: `services/manage-conversation.ts` = `createManageConversation` (assign/unassign/close/reopen)
→ หา conversation (scope ws) → repo update → publish `conversation.updated` event · คืน Result
· ports: `ConversationRepository.setAssignee/setStatus` + `InboxReadRepository.getConversationListItem`
· event `conversation.updated` เพิ่มใน domainEventSchema

**db**: conversation-repo `setAssignee`/`setStatus` · inbox-read-repo `getConversationListItem`

**api**: routes `POST /inbox/conversations/:id/{assign,unassign,close,reopen}` (authed, agentId จาก token)
คืน patch `{conversation:{id,status,assignee}}` · wiring `manageConversation` (tx + outbox + triggerDrain)
· **outbox-consumer branch ตาม event type**: `conversation.updated` → getConversation → push
`{type:'conversation', conversation}` เข้า agent WS (ต่างจาก message event ที่ push `{type:'message'}`)
· `realtime/agent-events.ts` เพิ่ม `AgentConversationEvent` + `toAgentConversationEvent`

**inbox UI**: Inbox.tsx เพิ่ม — WS handler branch message/conversation · **filter tabs** (all/mine/unassigned, client-side)
· **assignee badge** (ของฉัน/มอบหมายแล้ว/ยังไม่รับ/ปิดแล้ว) · **ปุ่ม header** รับเรื่อง/คืนสาย + ปิดสาย/เปิดใหม่ (optimistic + WS sync)
· api.ts เพิ่ม assign/unassign/close/reopenConversation · types เพิ่ม Assignee/ConversationPatch/AgentConversationEvent

**verify**: gate 102 + integration `inbox-realtime` (+1: assign→agent WS conversation event · close→DB) +
`phase4-routing.integration` (setAssignee/setStatus/getConversationListItem) · **browser: ปุ่ม+badge+filter+2-tab realtime sync** (พี่คลิกยืนยัน)

## ✅ Sub-phase B — LINE channel (เสร็จ)

**ตัดสินใจไว้ (ADR-0004):** LINE creds เก็บ DB ต่อ channel แบบ encrypted (AES-256-GCM, key `CHANNEL_ENCRYPTION_KEY`) ·
outbound = LINE push API · ⚠️ **LINE e2e จริงทำไม่ได้** (ไม่มี public URL/bot) → พิสูจน์ด้วย contract + integration ที่เซ็น signature เอง (ไม่เคลม LINE ยิงจริง)

**B1 db** (`@omni/db`): `channelType` enum +`'line'` · `channelTypeSchema` domain +`'line'` · ตาราง `channel_credentials`
(channelId PK, `secret_cipher` = ciphertext ของ JSON blob) · `crypto.ts` = `encryptSecret`/`decryptSecret` (AES-256-GCM,
format `v1.<iv>.<tag>.<ct>`) + `loadEncryptionKey` · `channel-credential-repository.ts` (get decrypt / upsert encrypt,
คืน blob generic — db ไม่ผูก LINE shape) · migration **0002_shiny_xavin** (ADD VALUE 'line' + ตาราง)

**B2 `@omni/channel-line`** (adapter ใหม่ · pkg + tsconfig, boundary auto ตาม `channel-[^/]+`):
`signature.ts` (verifyLineSignature = HMAC-SHA256 raw body, timing-safe) · `inbound.ts` (`toIngestCommands`: LINE event→
IngestInboundCommand เฉพาะ text จาก user, userId→externalId, message.id→externalMessageId, contactName=null) ·
`outbound-gateway.ts` (`createLineOutboundGateway`: resolveRoute→userId + resolveCredentials + push) · `push-client.ts`
(`createLineHttpPushClient` = POST /v2/bot/message/push, inject fetch) · `credentials.ts` (`lineCredentialsSchema` +
`createLineCredentialResolver` = validate blob→typed)

**B3 api**: `routes/line.ts` = `POST /channels/line/:channelId/webhook` — register ใน **plugin ย่อย encapsulated** ที่มี
content-type parser `parseAs:'buffer'` (เก็บ raw body, ไม่กระทบ JSON parser route อื่น) → resolve line channel → decrypt cred →
verify signature → parse → ingest ทีละ event (best-effort, ตอบ 200) · `outbound-dispatch.ts` = `createDispatchOutboundGateway`
(เลือก web/line gateway ตาม channel type ของ message — **agent reply สาย LINE จึง push ถูกช่องทาง**) · wiring.ts แยก
`buildChannelIo()` (กัน God function >120) ประกอบ cred+gateway+dispatch · deps เพิ่ม `lineCredentials` · env +`CHANNEL_ENCRYPTION_KEY`
(dev default+warn เหมือน AUTH secret)

**verify**: gate เขียว (165 unit) — crypto 10 · channel-line contract 20 (fixture LINE docs) · line-webhook contract 8 (app.inject
raw body+signature) · dispatch unit 3 · integration **28** — **line-webhook.integration** ขับ inbound e2e ผ่าน HTTP+Postgres จริง
(signed POST→raw parser→decrypt cred จริง→ingest→DB: message+identity=LINE userId · bad sig→401 ไม่ลง DB · msg2 เข้า conv เดิม) +
credential repo 5 (encrypted-at-rest จริง) · web-flow เดิมยังผ่าน dispatch ได้

**ยังไม่ได้ทำ / ทำไม่ได้:** ❌ LINE ยิง webhook จริง + push ไป user จริง (ไม่มี bot/public URL — ตาม ADR) ·
⏳ `/new-channel line` (memory spec doc) · ⏳ seed LINE demo channel · ⏳ verify browser inbox refactor (ค้างจาก sub-phase A)

## วิธีรัน (routing demo — verify แล้ว)

```bash
pnpm db:up && pnpm --filter @omni/api seed:dev   # agent@demo.local / demo1234
pnpm --filter @omni/api dev                       # :3001
pnpm --filter @omni/inbox exec next dev -p 3002   # :3002 (⚠️ ถ้า dev เจอ 404 ให้ลบ apps/inbox/.next ก่อน — stale prod build ชน)
pnpm --filter @omni/widget dev                    # :5173 หรือ 5174 (vite เลือกเอง)
```

widget พิมพ์ → inbox เห็นสาย → คลิก → รับเรื่อง/ปิดสาย · เปิด inbox 2 แท็บ = เห็น sync realtime

## Gotchas Phase 4

- **inbox next dev 404 ที่ /** = `.next` เดิมจาก `next build` (prod) ชน dev → `rm -rf apps/inbox/.next` แล้ว restart
- มี stale `next-server` บน :3000 (ไม่ใช่ของ session นี้ — ไม่แตะ) · ใช้ 3002 สำหรับ inbox
- outbox-consumer แยก 2 event: message (getMessage) vs conversation.updated (getConversation) — เพิ่ม event ใหม่ต้องอัปเดต consumer
- reply ยังคง route เดิม `/inbox/conversations/:id/reply` (sender=agent) — assign/close เป็น routes แยก
