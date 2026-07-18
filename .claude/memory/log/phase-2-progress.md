---
name: phase-2-progress
description: 'สถานะ Phase 2 (unified model + web channel end-to-end) — เสร็จ item 1-4 (domain+db), ต่อ item 5 (channel-web+api+WS). อ่านตอนเปิด session เพื่อทำ Phase 2 ต่อ'
metadata:
  node_type: memory
  type: log
  status: active
  scope: global
  updated: 2026-07-18
  originSessionId: c95243e8-0ef0-4fc2-b3aa-cfd6f5dd01c6
---

# Handoff — Phase 2 กำลังทำ (unified model + web channel end-to-end)

> อ่านไฟล์นี้ + [[project-overview]] + [[adr-0002-stack-and-repo-layout]] แล้วทำต่อได้ทันที
> (phase-1-handoff ถูก archive แล้ว — Phase 1 จบไปนานแล้ว)

## สถานะ (2026-07-18)

- branch `feature/phase-1-stack-skeleton` — **ยังไม่ merge main, ยังไม่ push** (รอพี่สั่ง)
- **Phase 2 เสร็จ item 1-4 แล้ว** (domain + db) · **กำลังจะทำ item 5** (channel-web + api routes + WS)
- commit ล่าสุด: `accee70` domain · `443274e` style(inbox format) · `96d896a` db · working tree **สะอาด**

## Progress Phase 2 (7 items)

| #   | งาน                                                                                                  | สถานะ        |
| --- | ---------------------------------------------------------------------------------------------------- | ------------ |
| 1-2 | `@omni/domain` schema + ports                                                                        | ✅ `accee70` |
| 3   | `ingestInboundMessage` service + unit test ทุก branch                                                | ✅ `accee70` |
| 4   | `@omni/db` Drizzle schema/migration/repos/connection + integration test                              | ✅ `96d896a` |
| 5   | `@omni/channel-web` + routes ใน api (POST sessions/messages + **WS** delivery + connection registry) | ⬜ ต่อไป     |
| 6   | `apps/widget` แชท UI จริง (ส่ง inbound + WS รับ outbound)                                            | ⬜           |
| 7   | demo end-to-end (พิมพ์→DB→outbound curl→เด้ง widget realtime) + contract test                        | ⬜           |

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

**verify แล้ว**: gate เขียว (17 unit) · `test:integration` 3/3 ผ่านกับ Postgres 16 จริง

## Decision ที่ล็อกแล้วใน Phase 2 (อย่ารื้อ)

- **ID generation = injected port** (`IdGenerator`/`Clock`) → domain pure · uuidv7 จริงอยู่ `@omni/db/id.ts` · composition root (api) เป็นคน wire
- **union (content/sender/assignee) เก็บ jsonb** typed ด้วย domain type — เพิ่มชนิดไม่ต้อง migrate
- **repo รับ `workspaceId` param บังคับ** + scope ทุก query · **DB→domain map ผ่าน zod parse** (validate+brand ที่ boundary)
- **ContactIdentity key = (workspaceId, channelId, externalId)** = resolve inbound→contact
- **integration test แยก**: `*.integration.test.ts` ไม่รันใน gate (vitest.config exclude) → รันด้วย `pnpm test:integration` (vitest.integration.config.ts) · gate/CI เขียวโดยไม่ต้องมี DB
- inbox = **Next 16 + Tailwind v4** (reconcile เข้า monorepo แล้ว) · typecheck = `next typegen && tsc`

## Item 5 — แผน + default ที่เสนอไว้ (⚠️ ยังไม่ได้ให้พี่ยืนยัน)

1. **web session**: `POST /channels/web/:channelId/sessions` → คืน `sessionId` (= `externalId` ของ identity) · ต่อ WS ด้วย session (ยังไม่ auth เต็ม — Phase 3)
2. **inbound**: `POST /channels/web/:channelId/messages` (body: sessionId + text) → adapter map → `ingestInboundMessage`
3. **WS + connection registry**: in-memory map `workspaceId+conversationId → sockets` ใน api · `OutboundGateway` impl = push เข้า WS registry · ใช้ `@fastify/websocket`
4. **api = composition root** (`buildApp()`): `createDb` + repos + `createIngestInboundMessage` + WS plugin wire ที่นี่จุดเดียว
5. adapter web อยู่ `@omni/channel-web` (map payload↔command), contract test (mock)

→ เปิด session ใหม่ให้ **ถาม/ยืนยัน design นี้กับพี่ก่อนลงโค้ด** (พี่ค้างเลือกอยู่ว่าจะลุยเลยหรือเคาะก่อน)

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
