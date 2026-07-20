---
paths:
  - 'apps/inbox/**'
  - 'apps/widget/**'
---

# Frontend Rules — Next.js inbox + Vite widget

> โหลดตอนแตะ frontend (agent inbox หรือ widget) · ต่อยอดจาก [code-standards.md](code-standards.md) + [definition-of-done.md](definition-of-done.md)
> stack เต็ม: [ADR-0002](../memory/decisions/0002-stack-and-repo-layout.md) · reference implementation: `apps/inbox/app`

## 0) อ่าน docs ของ version จริงก่อนเขียน — **บังคับ**

`apps/inbox/AGENTS.md` สั่งไว้: Next version นี้ (16.2) มี breaking change จาก training data —
**ก่อนเขียน component/route ใหม่ ให้เปิดอ่าน guide ที่เกี่ยวข้องใน `apps/inbox/node_modules/next/dist/docs/01-app/`** ก่อน
(เช่น `01-getting-started/05-server-and-client-components.md`, `02-project-structure.md`). ห้ามเดาจากความจำ

## 1) Boundary (ยังบังคับ)

- **inbox/widget = UI ล้วน** — คุย backend ผ่าน `apps/api` (HTTP + WebSocket) เท่านั้น · **ห้ามต่อ DB ตรง**
- แชร์ type จาก `@omni/domain` ด้วย `import type` (unified schema ตัวเดียว) — **ห้าม redefine shape** ฝั่ง client
  (ดู `app/lib/types.ts`: wire DTO ประกอบจาก `Assignee`/`MessageContent`/`MessageSender` ของ domain)
- **No secret ใน client bundle** — เฉพาะ `NEXT_PUBLIC_*` ถึง browser · token ช่องทาง/DB อยู่ฝั่ง api
- **PII** — ข้อความลูกค้าแสดงบนจอได้ แต่ห้าม log ลง console/telemetry ฝั่ง client เป็น plaintext

## 2) โครงไฟล์ — hexagonal (ports & adapters) · `app/` = routing เท่านั้น

> ⚠️ **`app/` = route/metadata file เท่านั้น (ทุกชนิดไฟล์)** — ห้ามมี component/hook/logic **และห้าม `.css`/asset/
> folder อื่น** (เช่น `app/themes/` ❌ · `app/globals.css` ❌). styles/code จริง **ทั้งหมด** ไป `src/`
> โครงนี้ mirror จาก reference `easy-game-arena/apps/web/src` (แต่ inbox เป็น client SPA — ดูข้อ adapt ใน §5)

```
apps/inbox/
  app/                    ← route/metadata เท่านั้น: page/layout/loading/error + favicon.ico (ห้าม .css/asset/folder อื่น)
  src/
    domain/               contract/ view-model ล้วน (wire types) — ไม่มี React/framework/adapter
    data/                 adapter ออกนอก: inbox-api (HTTP→apps/api), session-store (localStorage)
    presentation/
      components/{ui,<feature>}/   UI ล้วน (รับ prop/ยิง callback — ไม่ fetch เอง)
      hooks/              custom hook = ตัวขับ adapter (state/effect/subscription · แตะ data ได้)
      lib/                pure view logic (format, filter/badge/reducer, cn · ไม่มี React)
      stores/             client state (Zustand) · providers/  React provider (theme ฯลฯ)
      styles/             CSS ทั้งหมด (globals + theme + themes/*.css) — layout import ผ่าน @/presentation/styles
```

- ทิศพึ่งพา: **presentation → data → domain** · presentation ภายใน: **components → hooks → lib** · `domain` = center บริสุทธิ์
- **ไฟล์ = kebab-case** (`conversation-row.tsx`, `use-inbox-socket.ts`) · **export = PascalCase (component) / camelCase (fn)**
- import จาก `src/` ใช้ alias **`@/`** (→ `src/`) ใน app/ · ภายใน src ใช้ relative (dep-cruiser resolve ชัด)
- **บังคับด้วย gate** (§5): app-route-only (eslint จับ .ts/.tsx **+ `check:app-routing` จับ .css/asset/ทุกชนิด**) + hexagonal boundary (dep-cruiser)

## 3) แยกความรับผิดชอบ — กัน God component (บทเรียนจริง)

> เดิม `Inbox.tsx` เป็นก้อนเดียว 419 บรรทัด (state + WS + reducer + render ทุกอย่างในไฟล์เดียว) แตกเป็น:
> **God component เปลือง re-render** (setState จุดเดียว → UI ทั้งก้อน render ใหม่แม้ส่วนที่ไม่เกี่ยว) + รีวิว/แก้ยาก

- **pure logic → `lib/`** (filter/badge/reducer เป็น pure function · unit test ได้ ไม่ต้อง DOM) — ดู `presentation/lib/conversation-view.ts`
- **stateful logic → `hooks/`** (WS lifecycle, data fetch+state) — ดู `presentation/hooks/use-inbox-socket.ts`, `use-conversations.ts`
- **presentational → `components/<feature>/`** (รับ prop, render, ยิง callback — ไม่ fetch เอง · แยก component = แยก re-render boundary)
- **orchestrator บาง** (`components/inbox/inbox.tsx`) = ต่อ hook เข้ากับ component ย่อย · อ่าน flow จบในจอเดียว
- ปุ่ม/input ที่ style ซ้ำ → primitive ใน `ui/` (แยก utility เป็นกลุ่ม variant/size ไม่ให้ทับกัน — ไม่ต้องพึ่ง tailwind-merge)
- **อย่าทำเกินหน้าที่** — component/hook/function ทำสิ่งเดียว (single responsibility) · อย่ายัด logic ไม่เกี่ยวเข้าไป

## 4) React 19 · Server & Client Components · **data fetching = server-first**

> **นโยบาย: server-first เป็น default** — ดึง/mutate ข้อมูลฝั่ง server (RSC / server action) ก่อนเสมอ ·
> **client fetch = ข้อยกเว้นที่ต้อง justify** (ไม่ใช่ default). ที่มา: EGA fetch เกือบทั้งหมดฝั่ง server —
> omni ยึดหลักเดียวกัน แต่ **backend เป็น Fastify แยก** → server action = **proxy ไป `apps/api`** (ห้ามแตะ DB ตรง · ต่างจาก EGA ที่เรียก Supabase ตรง)

- **default = Server Component** — page/layout เป็น server · fetch initial data (list conversations, message history) ที่นี่
  แล้วส่ง props ลง client component · ใส่ `'use client'` เฉพาะ **leaf** ที่ interactive จริง (push directive ลงล่างสุด ลด client bundle)
- **mutation** — ที่ไม่ต้อง optimistic (assign/close/reopen/settings) → **server action** (proxy → apps/api) ·
  ที่ต้อง optimistic (reply — ตอบแล้วขึ้นทันที) → client + WS echo
- **client fetch อนุญาตเฉพาะ 3 กรณี — ต้องมี comment `// client-fetch: <เหตุผล>` กำกับทุกจุด:**
  1. **realtime** subscription (WebSocket — หัวใจ inbox) · 2. **optimistic** update · 3. **interaction-driven** ที่ผูก browser state (infinite scroll, live filter)
- **ห้าม setState ใน effect เพื่อ fetch-on-mount** (`react-hooks/set-state-in-effect`) — โหลดจาก event handler / on-connect แทน · ดู `use-conversations`/`use-messages`
- **ห้ามเขียน `ref.current` ตอน render** (`react-hooks/refs`) — ใช้ `hooks/use-latest-ref.ts` (เขียน ref ใน effect)
- realtime = WebSocket ไป `apps/api` จาก client (reconnect + auth token) · multi-tenant: session ผูก workspace, UI ไม่ข้าม tenant
- ⚠️ **prerequisite ของ server-first:** server-side fetch ต้องมี token ฝั่ง server → auth ต้องย้าย **localStorage → httpOnly cookie**
  (ตอนนี้ inbox realtime ยังใช้ localStorage token + client WS = **documented exception** · ทำ cookie ตอนแตะ RSC จริง แล้วเขียน ADR ใหม่)
- **enforce = review (ไม่ใช่ tool-gate)** — static analysis แยก "client fetch ที่ถูก (realtime)" กับ "ขี้เกียจ" ไม่ได้ →
  reviewer/AI เช็ค comment `// client-fetch:` ทุกจุด · ไม่มี justify = ต้องย้ายไป server

## 5) Enforce จริง — 3 เครื่องมือ แบ่งหน้าที่ (ไม่ใช่แค่ doc)

`pnpm gate` รัน 3 ชั้น — **dependency-cruiser** = boundary import graph · **eslint** = quality + token-pure ต่อไฟล์ ·
**`check:app-routing`** (script) = app/ มีแต่ route/metadata **ทุกชนิดไฟล์** (eslint เห็นแค่ .ts/.tsx — จับ .css/asset ไม่ได้)

**(a) dependency-cruiser** (`.dependency-cruiser.cjs`) — hexagonal boundary ของ inbox (error ทุกตัว):

| rule                             | ห้าม                                                 |
| -------------------------------- | ---------------------------------------------------- |
| `inbox-src-only-allowed-folders` | `src/` มี folder อื่นนอกจาก domain/data/presentation |
| `inbox-domain-pure`              | domain → data/presentation/react/next                |
| `inbox-data-no-presentation`     | data (adapter) → presentation                        |
| `inbox-components-no-data`       | components → data ตรง (ต้องผ่าน hook)                |
| `inbox-lib-no-data`              | lib (pure) → data                                    |
| `inbox-hooks-no-components`      | hooks → components                                   |
| `inbox-lib-no-components-hooks`  | lib → components/hooks                               |

> **adapt จาก EGA:** EGA (server-component app) ห้าม `presentation → data` เลย (route ดึง data ส่ง props ลง).
> inbox เป็น **client SPA** (realtime WS + token localStorage) → presentation ต้องขับ adapter เอง →
> เปิดให้ **hooks เท่านั้นแตะ data** (components/lib ยังบริสุทธิ์). อยากเข้มเท่า EGA = เพิ่ม application layer คั่น

**(b) eslint** (`apps/inbox/eslint.config.mjs`) — quality ต่อไฟล์ บน `app/**` + `src/**` (ยกเว้น `*.test.*`):

| rule                                | ค่า/ขอบเขต       | กันอะไร                                                                           |
| ----------------------------------- | ---------------- | --------------------------------------------------------------------------------- |
| `no-restricted-syntax` (Program)    | `app/` non-route | ไฟล์ **.ts/.tsx** ที่ไม่ใช่ route หลุดเข้า `app/` (ดู §c สำหรับ .css)             |
| `no-restricted-syntax` (token-pure) | className        | hex/สีดิบ/`[var()]`/condition ดิบ + inline style (ดู skill nextjs-semantic-theme) |
| `max-lines`                         | 200              | ไฟล์บวมเป็น God component                                                         |
| `max-lines-per-function`            | 120              | ฟังก์ชัน/component ยาวเกิน                                                        |
| `complexity`                        | 12               | branch เยอะเกินในฟังก์ชันเดียว                                                    |
| `max-depth`                         | 4                | nesting ลึก                                                                       |

**(c) `check:app-routing`** (`scripts/check-app-routing.mjs`) — สแกน `apps/*/app/` ตรง filesystem:
`app/` ต้องมีแต่ route/metadata file (page/layout/…/favicon) **ทุกชนิดไฟล์** — จับ `.css`/asset/folder ที่ eslint มองไม่เห็น
(นี่คือตัวที่กัน `app/themes/*.css`, `app/globals.css` หลุดเข้าไป — styles ต้องอยู่ `src/presentation/styles/`)

> **แบ่งหน้าที่ กัน AI มั่ว:** import-direction → dep-cruiser · quality + token-pure ต่อไฟล์ → eslint ·
> app/ ทุกชนิดไฟล์ → check:app-routing · **ไม่เขียนกฎเดียวซ้ำ** · ปรับกฎ → แก้ที่ต้นทาง + อัปเดตตารางนี้

**ก่อนบอกเสร็จ:** `pnpm gate` เขียว (รวม 3 ชั้น) + `pnpm --filter @omni/inbox build` / `--filter @omni/widget build` ผ่าน ·
แตะหน้า inbox จริง → verify บน browser (ดู DoD ข้อ 3) — ใช้ **Playwright e2e harness**: `pnpm --filter @omni/inbox e2e`
(headless, spin up stack เอง · ดู `.claude/memory/reference/inbox-e2e-harness.md` + `apps/inbox/e2e/`)

## 6) Widget (Vite)

- build เป็น IIFE `widget.js` ฝังผ่าน `<script>` · โหลดเบา ไม่พึ่ง framework หนัก
- คุย api ผ่าน channel key ของ workspace (public identifier) — ไม่ฝัง secret ใน bundle
