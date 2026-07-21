# Omni-Channel Chat Platform — Memory Index

> Active index — โหลดทุก session **คุมให้ ≤150 บรรทัด**
> ดู [MEMORY-GUIDE.md](MEMORY-GUIDE.md) สำหรับวิธีจัดการ (เพิ่ม/archive/promote)

## 🔥 แนวทางหลัก — อ่านก่อนเริ่มงานทุกครั้ง

- [**Feature เปิดใช้ต่อ tenant ไม่ใช่ flag ในโค้ด**](core/product-direction-per-tenant.md) — **priority สูงสุด (2026-07-21)** — ขายแบบเลือกฟีเจอร์เอง แล้วเปิดใช้ด้วย **ข้อมูลต่อ workspace ใน DB เปลี่ยนได้ตอน runtime ไม่ต้อง deploy** · ❌ ห้าม `process.env.FEATURE_X` / build-time flag / fork ต่อลูกค้า / ซ่อนแค่ UI · บังคับสิทธิ์ที่ server เสมอ · **สร้างกลไกก่อน เขียนฟีเจอร์ตอนมีคนจ่าย** (ห้ามไล่เขียนให้ครบใบเสนอราคาก่อนขาย) · fail-closed

## Core

- [Project Overview](core/project-overview.md) — โปรเจคนี้คืออะไร, เป้าหมาย, stack (เคาะแล้ว), roadmap 5 phase
- [Iris Persona](core/iris-persona.md) — ตัวตน Iris (ตอบในนาม Iris ทุก session)
- [Conventions](core/conventions.md) — มาตรฐานโค้ด/naming/git (baseline)
- [Frontend Architecture Standard](core/frontend-architecture-standard.md) — **feedback** — คุณภาพโค้ด frontend (ห้าม God component · อ่าน installed Next docs ก่อนเขียน · eslint enforce ใน gate)

## Decisions (ADR)

- [0001 AI Agent Toolkit](decisions/0001-agent-toolkit.md) — ชุดเครื่องมือ Claude ในโปรเจค (persona/memory/hooks/rules/commands)
- [0002 Stack & Repo Layout](decisions/0002-stack-and-repo-layout.md) — เคาะ stack (Node/TS, Fastify, Postgres+Drizzle, Next.js, WS) + โครง monorepo + multi-tenant + gate
- [0003 Phase 3 Inbox Realtime + Auth](decisions/0003-phase-3-inbox-realtime-auth.md) — realtime ฝั่ง agent = transactional outbox + pg-boss (เปิด seam) · auth ขั้นต่ำ = signed-session (JWT ฝัง workspaceId)
- [0004 Phase 4 Routing + LINE Channel](decisions/0004-phase-4-routing-and-line-channel.md) — routing = manual assign/close (verify ได้) · LINE = adapter mirror channel-web (HMAC, push) · credential เก็บ DB ต่อ channel แบบ encrypted (AES-GCM)
- [0005 Auth Transport httpOnly Cookie](decisions/0005-auth-transport-httponly-cookie.md) — ย้าย auth จาก localStorage token → httpOnly cookie (SameSite=Strict) + CSRF Origin check + CORS credentials + WS cookie · ปลด server-first RSC
- [0006 Phase 5 Bot/Automation + AI Reply](decisions/0006-phase-5-bot-automation-and-ai-reply.md) — bot ตื่นผ่าน consumer แยก (additive multi-subscriber outbox, cursor/subscriber) · bot เป็นเจ้าของสายใหม่ก่อน (escalate=null queue) · rules ต่อ workspace (plaintext) · AI = adapter @omni/bot-anthropic (inject fetch) + ANTHROPIC_API_KEY env + per-workspace opt-in · ปม PII
- [0007 Phase 6 Entitlements](decisions/0007-phase-6-entitlements.md) — **เปิดฟีเจอร์ต่อ tenant ด้วยข้อมูลใน DB** (ไม่ใช่ flag ในโค้ด) · gate ระดับ **โมดูล 8 ตัว** ไม่ใช่รายฟีเจอร์ (45 flag = combination ระเบิด) · ช่องทางแชท gate ด้วยข้อมูลอยู่แล้ว · บริการไม่ใช่ flag · บังคับที่ server UI แค่ซ่อน · additive ไม่รื้อ `workspace_bot_config` · self-host กันไม่ได้จริง ยอมรับ
- [0008 ICP & Positioning](decisions/0008-icp-and-positioning.md) — **ขายให้ใคร/พูดว่าอะไร** · ICP หัวหอก = **เอเจนซี่/หลายแบรนด์** (secondary = ธุรกิจบริการ · SME LINE-first ไว้ทีหลัง) · หัวหอก positioning = **"ราคาไม่บวมตามจำนวนคน"** ชน per-seat ตรงๆ · landing อยู่ใน `apps/billing` ไม่แยก app · **ห้าม testimonial ปลอม / ห้ามเคลมช่องทางที่ยังไม่ต่อ**

## Active Channels

- [web](../../packages/channel-web/) — web chat widget (Phase 2) · inbound REST + outbound WS realtime
- [LINE](channels/line.md) — LINE Messaging API (Phase 4) · inbound webhook (HMAC-SHA256 raw body) + outbound push · credential encrypted (AES-256-GCM) ใน DB · text only (MVP)

## Modules

- **agent inbox** (Phase 3) — Next 16 UI (`apps/inbox`) + api `/inbox/*` routes + agent WS realtime (key=workspaceId) · ดู [[phase-3-progress]]
- **realtime pipeline** (Phase 3) — transactional outbox → immediate drain → fan-out agent WS + pg-boss relay · ดู [[adr-0003-phase-3-inbox-realtime-auth]]
- **auth** (Phase 3) — signed-session (scrypt+HMAC, zero-dep) ฝัง workspaceId ใน token
- **bot/automation** (Phase 5-6) — consumer แยก (cursor 'bot') ตอบตาม rule → AI fallback · **จอจัดการใน inbox** (`/inbox/bot/*` + drawer) · ต้องผ่าน **ทั้ง** entitlement `bot` และสวิตช์ `workspace_bot_config`
- **entitlements** (Phase 6) — เปิดฟีเจอร์ต่อ workspace ด้วยข้อมูลใน DB · `hasEntitlement` (domain) + `requireEntitlement` (route guard) + `GET /inbox/entitlements` (UI ซ่อนเมนู) · ดู [[adr-0007-phase-6-entitlements]]

## 📍 ตอนนี้อยู่ตรงไหน (2026-07-21)

**Phase 1–6 merged เข้า `main` หมดแล้ว (dev ครบ ไม่มีงานค้างกลางคัน)**
verify ล่าสุด: `pnpm gate` **260 unit** · `pnpm test:integration` **54** · e2e browser **3/3**

🌿 **branch ปัจจุบัน = `feature/marketing-landing`** (แตกจาก `main` @ `49814c7`) — งาน **Marketing / landing**

### ⏸️ งาน marketing — **พักไว้ (พี่สั่งพัก 2026-07-21)** · ทำถึงไหนแล้ว

✅ **เคาะ ICP + positioning** ([[adr-0008-icp-and-positioning]]) → **เอเจนซี่/หลายแบรนด์** ·
หัวหอก = **"เพิ่มทีมตอบแชทกี่คน ราคาก็เท่าเดิม"** (ชน per-seat)
✅ **landing เขียนใหม่ทั้งหน้าตาม positioning** (`apps/billing` — hero/stats/features/use-case/FAQ/CTA/metadata+OG) ·
ถอด **testimonial ปลอม** ออกหมด · แก้เคลมช่องทางให้ตรงจริง (ต่อแล้ว = web + LINE เท่านั้น) ·
verify: `npm run build` เขียว + Playwright ตรวจ 8 ข้อผ่าน · **ยังไม่ commit — รอพี่สั่ง (มี 6 ไฟล์ค้างใน working tree)**
🔜 ค้างไว้: screenshot เดโมจริง · ตัวเลขเทียบ per-seat (ห้ามมั่ว) · lead funnel · ดู [[marketing-page-brief]]

### ▶️ งานถัดไป (session ใหม่) — **`apps/billing` เรื่องใบเสนอราคา**

พี่สั่งไว้แต่ **ยังไม่ระบุว่าจะแก้อะไร → ถามก่อน อย่าเดาแล้วลุย** · handoff เต็ม + สิ่งที่เจอ:
[[billing-quotation-followup]]
🔴 บั๊กที่เจอระหว่างสำรวจ (ยังไม่แก้): **เลขที่เอกสารสุ่มใหม่ทุก refresh** (`Math.random()` ใน presenter hooks
ทั้ง quote/invoice/receipt) → เอกสารที่ส่งลูกค้ากับที่เราเห็นคนละเลข ตามงานไม่ได้
⚠️ หนี้ `npm run lint` **11 errors** ใน `apps/billing` (มีมาก่อนงาน marketing — stash เทียบยืนยันแล้ว) ·
app อยู่นอก `pnpm gate` เลยไม่มีใครจับ

## Working Log

- [Phase 6 Progress](log/phase-6-progress.md) — **✅ จบ · merged main (PR #9, #10)** — entitlement (เปิดฟีเจอร์ต่อ tenant) ครบวง: domain/DB → บังคับที่ server → `requireEntitlement` guard → จอจัดการบอทใน inbox (ฟีเจอร์แรกที่ใช้กลไกจริง) · **มีตาราง "ใช้อะไรเมื่อต้องการอะไร" + ตัวเลือกงานถัดไป**
- [Phase 5 Progress](log/phase-5-progress.md) — **✅ ปิดแล้ว · merged เข้า main (PR #8)** — bot/automation (rule) + AI reply fallback (Claude Opus 4.8) · follow-up ที่ยังค้าง: **verify ยิง Anthropic จริง 1 ครั้ง** / hardening (AI timeout, outbox retention) · (admin UI จัดการ rules ทำแล้วใน Phase 6)
- [Phase 4 Progress](log/phase-4-progress.md) — **done · merged เข้า main (PR #2–#6)** — Phase 4 (routing + LINE) + hardening (dedup/tx-split/retry) + tech debt B (failed-status realtime, LINE profile name, auth httpOnly cookie [[adr-0005-auth-transport-httponly-cookie]]) · verify ครบ (gate+integration 34+e2e browser) · ถือ deferred tech debt list

## Go-to-Market

- [Billing/ใบเสนอราคา — งานถัดไป](log/billing-quotation-followup.md) — **handoff งานถัดไป** · สภาพปัจจุบัน (flow/state/ไฟล์ไหนแก้อะไร) · 🔴 บั๊กเลขที่เอกสารสุ่มใหม่ทุก refresh · หนี้ lint 11 errors · ข้อจำกัด localStorage (ไม่มีประวัติ/ข้ามเครื่องไม่ได้/ไม่มีสถานะเอกสาร)
- **ใบเสนอราคา** (`apps/billing`) — **✅ ทำแล้ว (2026-07-21)** — Next app แยกเดี่ยว (นอก pnpm workspace/gate) ให้ลูกค้าเลือกฟีเจอร์เอง 72 ฟีเจอร์/10 หมวด → ราคาคำนวณทันที + ออกใบเสนอราคา/แจ้งหนี้/ใบเสร็จ · ราคา = **setup + รายเดือน** × **รูปแบบการจ้าง 4 แบบ** (solo+AI ×1.0 → บริษัท ×2.6) · **ช่องทางแชท = loss leader** (มาตรฐานลด 30% ตั้งแต่ตัวที่ 2 + เพดานรวม ฿10,000 · กลุ่มต้องขออนุมัติแยกราคา) · รัน `cd apps/billing && npm run dev`
- [Marketing Page Brief](log/marketing-page-brief.md) — brief หน้า marketing/landing + go-to-market kit · **ICP/positioning/หน้าเพจ = เคาะ+ทำแล้ว** ([[adr-0008-icp-and-positioning]]) · **ยังค้าง: screenshot เดโมจริง · ตัวเลขเทียบ per-seat · lead funnel · one-pager/pitch deck** · Phase 5 bot(rule)=เคลมได้ / AI=beta · pain points · ROI angles

## Reference

- [Inbox e2e harness](reference/inbox-e2e-harness.md) — Playwright e2e (headless) verify browser ของ inbox · `pnpm --filter @omni/inbox e2e` (ต้อง db:up) — วิธีมาตรฐานปิด DoD ข้อ 3 ฝั่ง frontend

## Archived

<!-- ของที่ retire ดู _archive/INDEX.md -->
