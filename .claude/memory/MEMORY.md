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

## Active Channels

- [web](../../packages/channel-web/) — web chat widget (Phase 2) · inbound REST + outbound WS realtime
- [LINE](channels/line.md) — LINE Messaging API (Phase 4) · inbound webhook (HMAC-SHA256 raw body) + outbound push · credential encrypted (AES-256-GCM) ใน DB · text only (MVP)

## Modules

- **agent inbox** (Phase 3) — Next 16 UI (`apps/inbox`) + api `/inbox/*` routes + agent WS realtime (key=workspaceId) · ดู [[phase-3-progress]]
- **realtime pipeline** (Phase 3) — transactional outbox → immediate drain → fan-out agent WS + pg-boss relay · ดู [[adr-0003-phase-3-inbox-realtime-auth]]
- **auth** (Phase 3) — signed-session (scrypt+HMAC, zero-dep) ฝัง workspaceId ใน token

## Working Log

- [Phase 6 Progress](log/phase-6-progress.md) — **🔨 กำลังทำ · branch `feature/phase-6-entitlements`** — entitlement (เปิดฟีเจอร์ต่อ tenant) · **Increment 1 (domain) + 2 (DB) เขียว+commit ครบ** (gate 227 + integration 47) · เหลือ **3 บังคับใช้ที่ server** / **4 UI+seed** · ยังไม่ push · Phase 6 stack บน Phase 5 ที่ยังไม่ merge
- [Phase 5 Progress](log/phase-5-progress.md) — **paused @ PR-ready (pivot ไป marketing)** — bot/automation + AI reply core (Increment 1-3b) เขียว+commit ครบ (gate 217 + integration 41) · branch push แล้วแต่ **PR ยังไม่สร้าง** (gh ไม่ auth) · resume = สร้าง PR **base `main`** (ไม่ใช่ phase-1-skeleton ที่ remote HEAD ชี้ค้าง) → merge · ถัดไป: verify API จริง / hardening / admin UI
- [Phase 4 Progress](log/phase-4-progress.md) — **done · merged เข้า main (PR #2–#6)** — Phase 4 (routing + LINE) + hardening (dedup/tx-split/retry) + tech debt B (failed-status realtime, LINE profile name, auth httpOnly cookie [[adr-0005-auth-transport-httponly-cookie]]) · verify ครบ (gate+integration 34+e2e browser) · ถือ deferred tech debt list

## Go-to-Market

- **ใบเสนอราคา** (`apps/billing`) — **✅ ทำแล้ว (2026-07-21)** — Next app แยกเดี่ยว (นอก pnpm workspace/gate) ให้ลูกค้าเลือกฟีเจอร์เอง 72 ฟีเจอร์/10 หมวด → ราคาคำนวณทันที + ออกใบเสนอราคา/แจ้งหนี้/ใบเสร็จ · ราคา = **setup + รายเดือน** × **รูปแบบการจ้าง 4 แบบ** (solo+AI ×1.0 → บริษัท ×2.6) · **ช่องทางแชท = loss leader** (มาตรฐานลด 30% ตั้งแต่ตัวที่ 2 + เพดานรวม ฿10,000 · กลุ่มต้องขออนุมัติแยกราคา) · รัน `cd apps/billing && npm run dev`
- [Marketing Page Brief](log/marketing-page-brief.md) — brief หน้า marketing/landing + go-to-market kit · **ยังค้าง: ICP + positioning + หน้าเพจจริง** (pricing เคาะแล้วผ่านใบเสนอราคา) · Phase 5 bot(rule)=เคลมได้ / AI=beta · pain points · ROI angles

## Reference

- [Inbox e2e harness](reference/inbox-e2e-harness.md) — Playwright e2e (headless) verify browser ของ inbox · `pnpm --filter @omni/inbox e2e` (ต้อง db:up) — วิธีมาตรฐานปิด DoD ข้อ 3 ฝั่ง frontend

## Archived

<!-- ของที่ retire ดู _archive/INDEX.md -->
