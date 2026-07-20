# Omni-Channel Chat Platform — Memory Index

> Active index — โหลดทุก session **คุมให้ ≤150 บรรทัด**
> ดู [MEMORY-GUIDE.md](MEMORY-GUIDE.md) สำหรับวิธีจัดการ (เพิ่ม/archive/promote)

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

## Active Channels

- [web](../../packages/channel-web/) — web chat widget (Phase 2) · inbound REST + outbound WS realtime
- [LINE](channels/line.md) — LINE Messaging API (Phase 4) · inbound webhook (HMAC-SHA256 raw body) + outbound push · credential encrypted (AES-256-GCM) ใน DB · text only (MVP)

## Modules

- **agent inbox** (Phase 3) — Next 16 UI (`apps/inbox`) + api `/inbox/*` routes + agent WS realtime (key=workspaceId) · ดู [[phase-3-progress]]
- **realtime pipeline** (Phase 3) — transactional outbox → immediate drain → fan-out agent WS + pg-boss relay · ดู [[adr-0003-phase-3-inbox-realtime-auth]]
- **auth** (Phase 3) — signed-session (scrypt+HMAC, zero-dep) ฝัง workspaceId ใน token

## Working Log

- [Phase 5 Progress](log/phase-5-progress.md) — **active (ยังไม่ commit)** — bot/automation + AI reply · ADR-0006 + Increment 1 (domain) + 2 (db) เขียวครบ (gate 194 + integration 37) · ถัดไป = 3a (bot consumer rule-only) → 3b (AI adapter raw-fetch) · branch `feature/phase-5-bot-automation`
- [Phase 4 Progress](log/phase-4-progress.md) — **done · merged เข้า main (PR #2–#6)** — Phase 4 (routing + LINE) + hardening (dedup/tx-split/retry) + tech debt B (failed-status realtime, LINE profile name, auth httpOnly cookie [[adr-0005-auth-transport-httponly-cookie]]) · verify ครบ (gate+integration 34+e2e browser) · ถือ deferred tech debt list

## Go-to-Market

- [Marketing Page Brief](log/marketing-page-brief.md) — **planned (ยังไม่เริ่ม)** — brief หน้า marketing/landing ให้ทีมขาย: features (built vs roadmap) · pain points · ROI/selling angles · สิ่งที่ทีม marketing ต้องมี + ต้องเคาะ (ICP/pricing/positioning)

## Reference

- [Inbox e2e harness](reference/inbox-e2e-harness.md) — Playwright e2e (headless) verify browser ของ inbox · `pnpm --filter @omni/inbox e2e` (ต้อง db:up) — วิธีมาตรฐานปิด DoD ข้อ 3 ฝั่ง frontend

## Archived

<!-- ของที่ retire ดู _archive/INDEX.md -->
