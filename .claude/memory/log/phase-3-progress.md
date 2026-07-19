---
name: phase-3-progress
description: 'สถานะ Phase 3 (agent inbox realtime + auth) — เสร็จครบ item 1-7 + verify browser loop เต็ม. อ่านตอนเปิด session เพื่อทำ Phase 4 (routing + LINE channel) ต่อ'
metadata:
  node_type: memory
  type: log
  status: active
  scope: global
  updated: 2026-07-19
  originSessionId: c95243e8-0ef0-4fc2-b3aa-cfd6f5dd01c6
---

# Handoff — Phase 3 เสร็จ (agent inbox realtime + auth ขั้นต่ำ)

> อ่านไฟล์นี้ + [[project-overview]] + [[adr-0003-phase-3-inbox-realtime-auth]] แล้วทำ Phase 4 ต่อได้ทันที
> (phase-2-progress = Phase 2 จบแล้ว archive ได้)

## สถานะ (2026-07-19)

- branch `feature/phase-1-stack-skeleton` — **ยังไม่ merge main, ยังไม่ push** (รอพี่สั่ง)
- **Phase 3 เสร็จครบ item 1-7 + verify browser loop เต็มด้วยตาจริง** (widget→inbox realtime + inbox→widget realtime สองทาง)
- commit ที่ลงแล้ว: `9be4b4f` (ปิด Phase 2 item7) · `99c09ec` (domain+db data layer) · `fa779d9` (api backend)
- ⚠️ **item 6 (inbox UI) ยังไม่ commit** ตอนเขียนไฟล์นี้ — ถ้ายังค้างให้ commit เป็น `feat(inbox): agent inbox UI`

## ทำอะไรไปแล้ว (Phase 3 = agent inbox ขั้นต่ำ + auth)

**domain** (`@omni/domain`):

- `Agent` schema (business identity ไม่พก passwordHash) + `AgentRepository` port (findById + findCredentialByEmail — จุด login เป็น exception ไม่ scope workspace)
- `InboxReadRepository` (listConversations / listMessages / getMessageById) = read-model
- event `outbound_message.sent` เพิ่มใน `domainEventSchema` · send-outbound service publish event ด้วย

**db** (`@omni/db`):

- ตาราง `agents` (email unique ทั้งระบบ — MVP) + `outbox` (transactional outbox) · migration `0001`
- `Executor` type (pool | tx) → repo รับ tx ได้ = business write + outbox insert atomic
- `createOutboxEventBus` (write) + `createOutboxStore` (fetchUnprocessed FOR UPDATE SKIP LOCKED + markProcessed)
- `createAgentRepository`, `createInboxReadRepository`

**apps/api**:

- **auth (zero-dep)**: `auth/password.ts` (scrypt), `auth/session-token.ts` (HMAC-SHA256 signed token ฝัง workspaceId/agentId+exp), `auth/service.ts` (login+authenticate), `auth/require-agent.ts` (guard header/query)
- routes: `routes/auth.ts` (POST /auth/login, GET /auth/me) · `routes/inbox.ts` (GET conversations/messages, POST reply authed, GET /inbox/ws) · `routes/inbox-wire.ts` (DTO mapper)
- **realtime**: `realtime/outbox-consumer.ts` (drain: fetch→fan-out agent WS→mark), `realtime/pg-boss-relay.ts` (safety net schedule), `realtime/agent-events.ts`
- wiring: ingest/sendOutbound รันใน `db.transaction` + outbox eventbus (atomic) → **immediate drain หลัง commit** (realtime) · pg-boss relay = durability
- `agentRegistry` (key=workspaceId) แยกจาก web `registry` (key=session) · env `AUTH_SESSION_SECRET`
- seed-dev เพิ่ม demo agent: **agent@demo.local / demo1234**

**apps/inbox** (Next 16 + Tailwind v4, client-side):

- `app/lib/api.ts` (login/list/reply + WS url · คุย api ผ่าน HTTP+WS เท่านั้น) · `app/lib/types.ts` (wire DTO, union แชร์จาก @omni/domain ด้วย import type) · `app/lib/session-store.ts` (useSyncExternalStore — SSR-safe, เลี่ยง setState-in-effect)
- `app/components/LoginForm.tsx` + `app/components/Inbox.tsx` (2-pane list+view+reply+realtime WS reconnect, dedupe by id) · `app/page.tsx` (login↔inbox)

## วิธีรัน demo loop เต็ม (verify แล้ว)

```bash
pnpm db:up                                # postgres
pnpm --filter @omni/api seed:dev          # ws_demo + chn_web_demo + agent@demo.local/demo1234
pnpm --filter @omni/api dev               # api :3001 (pg-boss relay start)
pnpm --filter @omni/inbox dev             # inbox :3000  (agent)
pnpm --filter @omni/widget dev            # widget :5174/demo/  (ลูกค้า)
```

loop: widget พิมพ์ → inbox เด้ง realtime → inbox ตอบ → widget เด้ง realtime (ทั้งหมด verify ตาจริงแล้ว)

## verify ที่ทำจริง

- gate เขียว **92 unit** + boundaries 179 modules · inbox **build ผ่าน** (Next 16 turbopack)
- integration **16** (รวม `inbox-realtime.integration.test.ts`: inbound→outbox→drain→agent WS · reply→sender agent→widget WS)
- **browser loop เต็ม** ด้วยตาจริง (พี่ยืนยัน) + drive โค้ด client จริงของ inbox ผ่าน live api ครบ (login/WS/list/reply)

## Decision ที่ล็อก Phase 3 (ดู [[adr-0003-phase-3-inbox-realtime-auth]])

- **realtime = transactional outbox + immediate drain (สด) + pg-boss relay (safety net)** — pg-boss เป็น work-queue ไม่ใช่ pub/sub → multi-instance WS fan-out ต้องเพิ่ม pg NOTIFY/Redis ทีหลัง (Phase 3 = single instance)
- **auth = signed-session (zero-dep scrypt+HMAC)** ฝัง workspaceId ใน token → route/WS ได้ tenant context จาก token ไม่ใช่ client (กัน cross-tenant) · OIDC/Auth.js เลื่อน Phase 4+
- **gateway.send รันใน outbox tx (MVP)** — web push local โอเค · provider ช่องทางไกล (Phase 4) ต้องแยก persist/deliver
- email agent **unique ทั้งระบบ** (MVP) — multi-workspace email ซ้ำ = ต้อง workspace selector ทีหลัง

## ⭐ ต่อไป — Phase 4 (routing/assignment + LINE channel)

- routing/assignment: conversation → assign agent (มี `assignee` field + `conversationStatus` อยู่แล้ว) · `/new-channel line`
- LINE adapter: `@omni/channel-line` (HMAC verify webhook, reply/push API) — provider payload เก็บ `raw_payload` jsonb (seam มีแล้ว)
- ค้างจาก Phase 3 (ทำเมื่อจำเป็น): multi-instance WS fan-out (pg NOTIFY) · OIDC จริง · prod build/bundle api (tsup) · media/attachment storage
- push + เปิด PR (รอพี่สั่ง — branch ยังไม่เคย push)
