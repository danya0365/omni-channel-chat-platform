---
name: phase-1-handoff
description: สถานะโปรเจคหลังจบ Phase 1 + วิธีรัน + สิ่งที่ต้องทำต่อใน Phase 2 (อ่านตอนเปิด session ใหม่เพื่อทำงานต่อ)
metadata:
  node_type: memory
  type: log
  status: archived
  scope: global
  updated: 2026-07-18
  originSessionId: d27419a9-916f-408a-b0de-cf37ab7a91c6
---

# Handoff — จบ Phase 1 → เริ่ม Phase 2

> อ่านไฟล์นี้ + [[project-overview]] + [[adr-0002-stack-and-repo-layout]] แล้วทำงานต่อได้ทันที

## สถานะปัจจุบัน (2026-07-18)

- **Phase 1 เสร็จ + verify จริงครบ** — บน branch `feature/phase-1-stack-skeleton` (ยังไม่ merge เข้า main)
- 3 commit ล่าสุด: `feat: monorepo skeleton` → `docs: ADR-0002 + sync` → `style: prettier`
- **working tree สะอาด** · ยังไม่ push (รอพี่สั่ง)
- **ยังไม่เริ่ม Phase 2** — โค้ด domain/adapter จริงยังไม่มี (มีแค่ skeleton)

## วิธีรัน (เครื่องนี้ deps ติดตั้งแล้ว)

```bash
pnpm install          # ถ้า clone ใหม่/lockfile เปลี่ยน
pnpm db:up            # docker-compose Postgres 16 (ต้องมี Docker รัน)
pnpm dev              # รัน api/inbox/widget ขนาน (--if-present)
pnpm gate             # lint + typecheck + test + boundaries — ต้องเขียวก่อนบอกเสร็จ
pnpm build            # next build + vite build
```

api dev: `apps/api` port 3001 (env `PORT`) · inbox: 3000 · verify: `curl localhost:3001/healthz` → `{"status":"ok"}`

## แผนที่ repo (จริง vs stub)

| path                   | สถานะ       | หมายเหตุ                                                                             |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `packages/domain`      | จริงบางส่วน | มี `Result<T,E>` + test เท่านั้น · **Phase 2 เติม schema + ports + services ที่นี่** |
| `packages/db`          | stub        | มีแค่ Drizzle table `workspaces` · ยังไม่มี connection/repos/migrations              |
| `packages/channel-web` | stub        | export const เปล่า · Phase 2 ทำ adapter จริง                                         |
| `apps/api`             | จริงขั้นต่ำ | `buildApp()` + `/healthz` + Zod env · ยังไม่มี webhook/WS/wiring                     |
| `apps/inbox`           | placeholder | Next.js render หน้าเดียว · Phase 3                                                   |
| `apps/widget`          | placeholder | Vite → `widget.js` · Phase 2 ทำแชท UI จริง                                           |

## สิ่งที่พิสูจน์แล้ว (อย่าทำซ้ำ)

- `pnpm gate` เขียว: lint ✓ / typecheck 6/6 ✓ / test 3/3 ✓ / boundaries ✓
- `next build` + `vite build` ผ่าน (Next เขียน tsconfig/next-env ทับแค่ build แรก — เสถียรแล้ว)
- `/healthz` ยิง HTTP จริงได้ 200 (ไม่ใช่แค่ inject test)

## การตัดสินใจที่ล็อกแล้ว (อย่ารื้อ — อยู่ใน ADR-0002)

- **Multi-tenant ตั้งแต่แรก** — `Workspace` เป็น root, ทุก entity มี `workspaceId`, repository รับ `workspaceId` เป็น param บังคับ, scope ทุก query เสมอ (ลืม = data leak ข้าม tenant)
- **ID** = `<prefix>_<uuidv7>` (text) — `ws`/`msg`/`conv`/`ctc`/`idn`/`chn`/`agt`
- **Boundary** apps → adapter (db, channel-\*) → domain — domain ห้าม import framework (dependency-cruiser จับใน gate)
- **WS อยู่บน Fastify (api)** ไม่ใช่ Next.js · **queue = defer** (seam port `EventBus` + outbox → pg-boss)
- **internal package** export ชี้ `./src/index.ts` ตรง — tsx/vitest/tsc bundler อ่าน .ts ได้ ไม่ต้อง build ขั้นกลาง

## Phase 2 — ทำอะไรต่อ (unified model + web widget end-to-end)

1. **`@omni/domain`**: schema (Zod) — `Message`, `Conversation`, `Contact` + `ContactIdentity`, `Channel`, `Workspace` · discriminated union: `MessageContent` (เริ่ม `text`), `assignee`, `sender` · delivery status `received|pending|sent|delivered|read|failed`
2. **ports**: `MessageRepository`, `ConversationRepository`, `ContactRepository`, `OutboundGateway`, `EventBus` (ทุกตัว scope `workspaceId`)
3. **service** `ingestInboundMessage`: หา/สร้าง identity→contact→conversation → persist → publish event — **unit test ครอบทุก branch**
4. **`@omni/db`**: Drizzle schema เต็ม + migrations (drizzle-kit) + repos + connection (pg) — **integration test กับ Postgres จริง** (`pnpm db:up`)
5. **`@omni/channel-web`** + routes ใน api: `POST /channels/web/sessions`, `POST .../messages`, WS delivery + connection registry (outbound)
6. **`apps/widget`**: แชท UI จริง + ส่ง inbound ไป api + WS reconnect รับ outbound
7. **Done Phase 2 (demo)**: พิมพ์จาก widget → เห็นใน DB → ยิง outbound (curl) → เด้งขึ้น widget realtime · contract test ของ adapter เขียว

## Gotchas / decision ที่ต้องเคาะกับพี่ก่อนถึงจุดนั้น

- **prod build/bundle ของ api** ยังไม่เลือก (tsup/esbuild) — dev ใช้ tsx พอ แต่ deploy ต้องมี
- **auth ของ inbox** (Phase 3) — เริ่ม session cookie แล้วค่อย Auth.js/OIDC
- **media/attachment** — `MessageContent` เป็น union รองรับไว้ แต่ storage (S3-compatible) ยังไม่ทำ
- Phase 4 LINE ต้องมี **public URL** (เสนอ cloudflared) + LINE OA จริง

## กฎที่ต้องจำ (ทุก session)

- **ห้าม commit/push จนพี่สั่ง** (กฎเหล็ก AGENTS.md) · แตก `feature/*` ไม่แตะ `main` ตรง
- **PII**: ห้าม log ข้อความลูกค้า/PII เต็ม · secret ช่องทางอยู่ใน env เท่านั้น
- **ก่อนบอกเสร็จ**: ผ่าน `pnpm gate` + test ครอบของใหม่ + verify จริงถ้าแตะ flow (definition-of-done)
- commit co-author = โมเดลที่ลงมือจริง (`Claude Fable 5 <noreply@anthropic.com>` สำหรับ session ก่อนหน้า)
