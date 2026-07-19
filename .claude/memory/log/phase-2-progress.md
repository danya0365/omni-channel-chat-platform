---
name: phase-2-progress
description: 'สถานะ Phase 2 (unified model + web channel end-to-end) — เสร็จครบ item 1-7 + verify browser จริง. Phase 2 ปิดสมบูรณ์ · ต่อไป = push/PR หรือ Phase 3 (agent inbox realtime)'
metadata:
  node_type: memory
  type: log
  status: active
  scope: global
  updated: 2026-07-19
  originSessionId: c95243e8-0ef0-4fc2-b3aa-cfd6f5dd01c6
---

# Handoff — Phase 2 กำลังทำ (unified model + web channel end-to-end)

> อ่านไฟล์นี้ + [[project-overview]] + [[adr-0002-stack-and-repo-layout]] แล้วทำต่อได้ทันที
> (phase-1-handoff ถูก archive แล้ว — Phase 1 จบไปนานแล้ว)

## สถานะ (2026-07-19)

- branch `feature/phase-1-stack-skeleton` — **ยังไม่ merge main, ยังไม่ push** (รอพี่สั่ง)
- **Phase 2 เสร็จครบ item 1-7 แล้ว + commit ครบ** (domain + db + channel-web + api/WS + widget UI end-to-end) — **item 7 verify browser จริงแล้ว** (พี่พิมพ์ในหน้า demo → เข้า DB · ยิง reply → bubble เด้งเข้า widget realtime `delivered:true`)
- commit ล่าสุด: `6140853` widget (item 6) · `8234667` web channel backend (item 5) · `6616101` memory · `96d896a` db · `accee70` domain
- ✅ working tree สะอาด (นอกจากไฟล์นี้) · gate เขียว 56 tests + boundaries 150 modules

## Progress Phase 2 (7 items)

| #   | งาน                                                                                                  | สถานะ                  |
| --- | ---------------------------------------------------------------------------------------------------- | ---------------------- |
| 1-2 | `@omni/domain` schema + ports                                                                        | ✅ `accee70`           |
| 3   | `ingestInboundMessage` service + unit test ทุก branch                                                | ✅ `accee70`           |
| 4   | `@omni/db` Drizzle schema/migration/repos/connection + integration test                              | ✅ `96d896a`           |
| 5   | `@omni/channel-web` + routes ใน api (POST sessions/messages + **WS** delivery + connection registry) | ✅ `8234667`           |
| 6   | `apps/widget` แชท UI จริง (ส่ง inbound + WS รับ outbound + reconnect) + CORS + seed:dev              | ✅ `6140853`           |
| 7   | demo end-to-end (พิมพ์→DB→outbound curl→เด้ง widget realtime) + contract test                        | ✅ verify browser จริง |

## วิธีรัน (เครื่องนี้ deps ติดตั้งแล้ว)

```bash
pnpm install            # ถ้า clone ใหม่/lockfile เปลี่ยน
pnpm db:up              # docker-compose Postgres 16 → container omni-postgres :5432 (ต้องมี Docker)
pnpm dev                # api :3001 · inbox :3000 · widget (--if-present)
pnpm gate               # lint + typecheck + test(unit) + boundaries — ต้องเขียวก่อนบอกเสร็จ
pnpm test:integration   # integration test (ต่อ Postgres จริง — ต้อง pnpm db:up ก่อน)
pnpm build              # next build + vite build
```

DB creds (dev only, ใน docker-compose): `postgresql://omni:omni_dev_only@localhost:5432/omni`
generate migration ใหม่: `pnpm --filter @omni/db db:generate`

## Item 6 — `apps/widget` แชท UI จริง (ทำเสร็จแล้ว)

โครง 2 ชั้น (แยกเพื่อ test): **`client.ts` = transport core** (inject fetch/WebSocket/storage ได้) + **`main.ts` = DOM view บางๆ**

- `apps/widget/src/client.ts`: `createWidgetClient({apiOrigin, channelId, onMessage, onStatus, fetchFn?, WebSocketCtor?, storage?, reconnectBaseMs?})`
  → `start()` (bootstrap session จาก storage/POST sessions + connect WS) · `sendText(text)` (POST messages) ·
  `stop()` · reconnect แบบ exponential backoff (cap 15s) · parse `WebMessageEvent` (import type จาก `@omni/channel-web`)
- `apps/widget/src/main.ts`: `mountWidget(target, {apiOrigin, channelId, title?})` → vanilla DOM (message list + input +
  status pill) · ข้อความใส่ผ่าน `textContent` (กัน XSS) · optimistic append ข้อความตัวเอง (inbound ไม่ echo กลับ WS) ·
  คืน `{destroy()}`
- `apps/widget/src/client.test.ts`: **8 unit test** (bootstrap fresh/cached, sendText, auto-bootstrap, parse+malformed, status transition, reconnect, stop) — fake fetch/WS/storage, เข้า gate
- **api CORS**: เพิ่ม `@fastify/cors@^10.1.0` · register `{origin: true}` (dev สะท้อน origin · prod ต้องจำกัด allowlist Phase 3)
- **seed demo**: `apps/api/src/seed-dev.ts` (`pnpm --filter @omni/api seed:dev`) upsert `ws_demo` + `chn_web_demo` (idempotent) — id อ่านง่าย (idSchema ตรวจแค่ prefix)
- **demo/index.html**: mount widget จริงชี้ `http://localhost:3001` + `chn_web_demo`

**วิธีรัน demo บน browser**: `pnpm db:up` → `pnpm --filter @omni/api seed:dev` → `pnpm --filter @omni/api dev` (api :3001) →
`pnpm --filter @omni/widget dev` (vite) → เปิด browser พิมพ์ · outbound ทดสอบด้วย `POST /channels/web/chn_web_demo/reply {conversationId, text}`

⚠️ **verify ที่ทำจริงแล้ว**: รัน `createWidgetClient` ตัวจริง (โค้ดเดียวกับที่ browser รัน) ยิงเข้า **live api + Postgres** →
start→online, sendText→persist (inbound contact), POST reply→delivered:true, widget รับ outbound ทาง WS จริง +
ยืนยัน 2 แถวใน DB (inbound+outbound) · **item 7 เปิด browser DOM จริงแล้ว** (2026-07-19): พี่พิมพ์ในหน้า demo (vite :5174) →
เข้า DB (`inbound/contact`) · ผมยิง reply helper → bubble ขาวเด้งเข้า widget realtime `delivered:true` (WS ของ browser ต่ออยู่จริง)
✅ **commit แล้ว** (`8234667` backend · `6140853` widget) — working tree สะอาด

## ⭐ ต่อไป (Phase 2 ปิดครบแล้ว — เลือก 1)

1. **Phase 3**: agent inbox realtime — ต่อ **EventBus seam ที่ยัง no-op** (`apps/api/src/wiring.ts` →
   outbox/pg-boss + consumer push เข้า inbox ผ่าน WS) · + WS auth (session→Auth.js/OIDC) · reply endpoint ใส่ auth + agentId จริง
   → เริ่มด้วยเสนอ breakdown + default decisions ให้พี่ veto ก่อนลงมือ (งานใหญ่ ควร `/new-adr`)
2. **push + เปิด PR** เข้า main (รอพี่สั่ง — ยังไม่เคย push branch นี้)

**helper รอบทดสอบ browser** (ถ้าจะเปิด demo อีก): `scratchpad/reply.sh "ข้อความ"` — หา conversation ล่าสุดของ ws_demo แล้วยิง outbound reply (ดู DB: `select ... from messages join conversations where workspace_id='ws_demo'`)

## ทำอะไรไปแล้ว (รายละเอียด)

**`@omni/domain`** (pure core — มีแค่ zod + logic, ห้าม import framework):

- `ids.ts`: `Id<prefix>` branded (ws/chn/ctc/idn/conv/msg/agt) + `idSchema` + `IdGenerator`/`Clock` = **port** (domain ไม่พึ่ง crypto — impl จริง inject)
- `schema/`: Workspace, Channel(+type web), Contact+ContactIdentity, Conversation(+status open/closed, Assignee), Message(+MessageContent/Sender union, DeliveryStatus received|pending|sent|delivered|read|failed)
- `ports.ts`: Contact/Conversation/Message repo (รับ `workspaceId` บังคับ) + OutboundGateway + EventBus + DomainEvent(zod)
- `services/ingest-inbound-message.ts`: `createIngestInboundMessage(deps)` → resolve identity→contact→conversation→persist→publish · คืน `Result`

**`@omni/db`** (adapter — พึ่ง domain ทางเดียว):

- `schema.ts`: 6 ตาราง + enums + FK cascade + index (findLatestOpen/inbox/history) + unique(workspace,channel,external) · union เก็บ jsonb typed ด้วย domain · `raw_payload` jsonb = seam (ยังไม่ใช้ใน web)
- `migrations/0000_*.sql` (drizzle-kit) + `migrate.ts` (`runMigrations`)
- `client.ts` (`createDb` = pg Pool + drizzle) · `id.ts` (`uuidv7` + `createIdGenerator` + `systemClock`)
- `repositories/`: implement ports, scope workspaceId ทุก query, DB→domain ผ่าน zod parse, contact+identity atomic (tx)

**`@omni/channel-web`** (adapter — พึ่ง domain ทางเดียว, ไม่พึ่ง framework/db):

- `session.ts` (`webSessionKey(ws,chn,external)` = คีย์ registry), `inbound.ts` (`toIngestCommand` map payload widget→command), `wire.ts` (`toWirePayload` Message→event JSON-safe), `outbound-gateway.ts` (`createWebOutboundGateway` impl `OutboundGateway`: resolve→push WS)
- ประกาศ interface `WebConnectionRegistry` (impl อยู่ api) + type `WebRouteResolver` (impl อยู่ db) — inject ที่ composition root

**`apps/api`** (composition root):

- `registry.ts` (`createConnectionRegistry` in-memory map key→sockets, guard readyState), `deps.ts` (`AppDeps` แยกไฟล์กัน circular), `app.ts` (`buildApp(deps)` async + register `@fastify/websocket`), `routes/web.ts`, `wiring.ts` (`createContainer` ต่อ db+repos+services+gateway), `server.ts`
- routes: `POST .../sessions` (mint sessionId), `POST .../messages` (inbound→ingest), `GET .../ws?sessionId` (register socket), `POST .../reply` (outbound→sendOutbound; = "curl outbound" ของ demo)

**`apps/widget`** (frontend — คุย api ผ่าน HTTP+WS เท่านั้น, ไม่ต่อ DB):

- `client.ts` (transport core: session/POST inbound/WS+reconnect/parse event — inject transport ได้), `main.ts` (`mountWidget` DOM view), `client.test.ts` (8 unit test), demo/index.html
- แชร์ type `WebMessageEvent` จาก `@omni/channel-web` ด้วย `import type` (erased ตอน build IIFE) — ไม่ redefine

**verify แล้ว**: gate เขียว (**56 unit/contract** — +8 widget) + boundaries ✓ (150 modules) · `test:integration` **8/8** กับ Postgres 16 จริง ·
**browser-path e2e**: `createWidgetClient` ตัวจริง ↔ live api :3001 ↔ Postgres → start/sendText/reply/รับ outbound ทาง WS ครบ + ยืนยัน 2 แถวใน DB

## Decision ที่ล็อกแล้วใน Phase 2 (อย่ารื้อ)

- **ID generation = injected port** (`IdGenerator`/`Clock`) → domain pure · uuidv7 จริงอยู่ `@omni/db/id.ts` · composition root (api) เป็นคน wire
- **union (content/sender/assignee) เก็บ jsonb** typed ด้วย domain type — เพิ่มชนิดไม่ต้อง migrate
- **repo รับ `workspaceId` param บังคับ** + scope ทุก query · **DB→domain map ผ่าน zod parse** (validate+brand ที่ boundary)
- **ContactIdentity key = (workspaceId, channelId, externalId)** = resolve inbound→contact
- **integration test แยก**: `*.integration.test.ts` ไม่รันใน gate (vitest.config exclude) → รันด้วย `pnpm test:integration` (vitest.integration.config.ts) · gate/CI เขียวโดยไม่ต้องมี DB
- inbox = **Next 16 + Tailwind v4** (reconcile เข้า monorepo แล้ว) · typecheck = `next typegen && tsc`

### Item 5 — decision ที่เลือก/ล็อก (ทำเสร็จแล้ว)

- **registry key = session (identity) ไม่ใช่ conversationId** → `webSessionKey = ws:chn:externalId` · widget ต่อ WS ด้วย sessionId อย่างเดียว (ปลอดภัย: socket อยู่ bucket ของ session ตัวเองเท่านั้น กัน cross-tenant subscribe)
- **outbound routing**: `OutboundGateway.send(message)` มี conversationId → `WebRouteResolver` (impl ใน db) join conversation→identity ได้ `externalId` → push เข้า registry key เดียวกัน (resolve ตอน outbound ซึ่ง freq ต่ำกว่า inbound)
- **`ChannelRepository.findPublicById(channelId)` = ข้อยกเว้น multi-tenant** (ไม่ scope workspace) — เป็นจุดสถาปนา workspace context จาก public channelId ใน URL
- **`OutboundReceipt.delivered`** เพิ่มเข้า port (web ไม่มี provider id) — offline (ไม่มี socket) = `delivered:false` **ไม่ใช่ error** (message persist แล้ว)
- **`sendOutboundMessage` เป็น domain service** (สมมาตรกับ ingest) — persist ก่อนส่ง · sender default `{kind:'bot'}` (agent identity จริง Phase 3)
- **`AppDeps` inject เข้า `buildApp(deps)`** (ไม่ผูก DB ตรง) → test ด้วย fake ได้ · `createContainer` (wiring.ts) = ประกอบจริง (จุดเดียวที่ db+channel-web เจอกัน ผ่าน structural typing)
- **WS test ใน gate ใช้ real listen + ws client** (ไม่ใช้ `injectWS` — มันไม่ dispatch handler ใต้ vitest)

⚠️ **ที่ยังต้องให้พี่ veto** (เลือก default ไว้ก่อน): reply endpoint เปิดโล่ง (ยังไม่ auth — Phase 3) · EventBus = no-op (seam ยังไม่มี consumer) · registry in-memory ต่อ 1 process (หลาย instance ต้อง Redis pub/sub ทีหลัง)

## Gotchas / ยังไม่เคาะ

- **prod build/bundle ของ api** (tsup/esbuild) ยังไม่เลือก — dev ใช้ tsx พอ
- **WS auth** เริ่มแบบ session-based ก่อน, Auth.js/OIDC ทีหลัง (Phase 3)
- **media/attachment**: MessageContent เป็น union รองรับ แต่ storage (S3) ยังไม่ทำ
- **port 5432**: เครื่องนี้มี supabase/postgres อื่นรันอยู่ (port 544xx/5433) แต่ omni ใช้ 5432 ว่าง — ระวังชนถ้าเปลี่ยนเครื่อง
- **`unrs-resolver` build script** ถูก pnpm block — ไม่กระทบ gate แต่ถ้าจะรัน `pnpm --filter @omni/inbox lint` ต้อง approve build ก่อน

## กฎที่ต้องจำ (ทุก session)

- **ห้าม commit/push จนพี่สั่ง** (กฎเหล็ก AGENTS.md) · commit ทีละ increment ที่เขียว
- **PII**: ห้าม log ข้อความลูกค้า/PII เต็ม · secret ช่องทางอยู่ env เท่านั้น
- **ก่อนบอกเสร็จ**: `pnpm gate` เขียว + test ครอบของใหม่ + verify จริงถ้าแตะ flow (แตะ DB → `pnpm db:up` + `test:integration`)
- commit co-author = โมเดลที่ลงมือจริง session นั้น (session นี้ = `Claude Opus 4.8 (1M context)`)
