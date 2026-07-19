---
name: frontend-architecture-standard
description: มาตรฐาน + บทเรียนเรื่องคุณภาพโค้ด frontend (Next.js inbox) — พี่คาดหวังโค้ดสะอาด ไม่ God component และต้องอ่าน installed docs ก่อนเขียน. อ่านก่อนแตะ apps/inbox
metadata:
  node_type: memory
  type: feedback
  status: active
  scope: global
  updated: 2026-07-19
  originSessionId: c95243e8-0ef0-4fc2-b3aa-cfd6f5dd01c6
---

# มาตรฐานคุณภาพโค้ด Frontend (บทเรียนจริง)

พี่รีวิว inbox แล้วบอกตรงว่า "เละเทะ ผิด rules" — และพี่ถูก: `Inbox.tsx` เป็น God component 419 บรรทัด,
ก๊อป className ปุ่ม/input ซ้ำ, และมี `react-hooks` error ค้าง (`set-state-in-effect`, `refs`) ที่ **gate มองไม่เห็น**
เพราะ gate รัน `eslint .` (root generic) เฉยๆ ไม่เคยรัน Next config เลย.

แก้แล้ว (session นี้) — **hexagonal เต็ม** (mirror `easy-game-arena/apps/web/src`): **`app/` = routing เท่านั้น** ·
code ไป **`src/{domain,data,presentation}`** — domain=contract ล้วน · data=adapter (inbox-api HTTP, session-store) ·
presentation={components/{ui,auth,inbox}, hooks, lib} · ทิศ **presentation→data→domain**, ภายใน **components→hooks→lib**.
component/lib ไม่แตะ data (ผ่าน hook เท่านั้น — adapt จาก EGA เพราะ inbox เป็น client SPA). สร้าง ui/Button,ui/TextInput,
useAuth/useSession/SessionGate (page เป็น server component). **2 เครื่องมือ enforce:** dependency-cruiser = boundary
(hexagonal layers, พิสูจน์ teeth แล้ว) · eslint = quality (max-lines/complexity/react-hooks) + app-route-only.
รายละเอียดเต็ม → [[adr-0002-stack-and-repo-layout]] และ rule `.claude/rules/frontend-next.md` (§2 โครง, §5 boundary table).

**Why:** โปรเจคนี้พี่ถือคุณภาพโค้ดเป็นเรื่องจริงจัง — "เขียนได้" ไม่พอ ต้อง "สะอาด + ตามกฎ + กฎต้องมีคนบังคับ".
โค้ด framework (Next/React) ต้องเขียนตาม convention ของ **version จริงที่ติดตั้ง** ไม่ใช่จากความจำ (training data เก่า).

**How to apply:**

- แตะ frontend → โหลด `.claude/rules/frontend-next.md` ก่อน (มีโครงไฟล์ + enforcement + pattern อ้างอิง)
- **ก่อนเขียน Next/React ใหม่ ต้องเปิดอ่าน `apps/inbox/node_modules/next/dist/docs/01-app/`** guide ที่เกี่ยว
  (`apps/inbox/AGENTS.md` สั่งไว้ — session ก่อนผมข้ามตรงนี้ จึงเขียนผิด convention)
- **`app/` = route/metadata file เท่านั้น (ทุกชนิดไฟล์!)** — ห้าม component/hook/logic **และห้าม `.css`/asset/folder อื่น**
  (เคยพลาด: วาง `app/themes/*.css` + `app/globals.css` → ผิดกฎตัวเอง). styles/code จริงไป `src/` — CSS ไป `src/presentation/styles/`
- อย่าเขียนก้อนเดียวจบ — contract→`domain/`, adapter→`data/`, pure view+cn→`lib/`, stateful→`hooks/`, UI→`components/`,
  CSS→`styles/`. **components/lib ห้ามแตะ data ตรง** (ผ่าน hook) · style ซ้ำ → primitive ใน `ui/` · **1 หน่วย = 1 หน้าที่**
- **3 ชั้น enforce ใน gate** (คนละหน้าที่ ไม่ซ้ำ): **dep-cruiser** = ทิศ import · **eslint** = quality + token-pure ต่อไฟล์
  (แต่เห็นแค่ .ts/.tsx) · **`check:app-routing`** (script) = app/ ทุกชนิดไฟล์ (จับ .css/asset ที่ eslint มองไม่เห็น)
- ปิดงาน frontend = `pnpm gate` เขียว (lint + dep-cruiser + check:app-routing) + `next build` ผ่าน + verify browser จริง
- อย่าตั้งกฎเป็น doc ลอยๆ — ต้อง enforce ด้วย tool ถึงจะมีผลจริง (พิสูจน์ teeth ด้วยการลอง inject violation)
