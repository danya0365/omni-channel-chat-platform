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

## Active Channels

- [web](../../packages/channel-web/) — web chat widget (Phase 2) · inbound REST + outbound WS realtime
- [LINE](channels/line.md) — LINE Messaging API (Phase 4) · inbound webhook (HMAC-SHA256 raw body) + outbound push · credential encrypted (AES-256-GCM) ใน DB · text only (MVP)

## Modules

- **agent inbox** (Phase 3) — Next 16 UI (`apps/inbox`) + api `/inbox/*` routes + agent WS realtime (key=workspaceId) · ดู [[phase-3-progress]]
- **realtime pipeline** (Phase 3) — transactional outbox → immediate drain → fan-out agent WS + pg-boss relay · ดู [[adr-0003-phase-3-inbox-realtime-auth]]
- **auth** (Phase 3) — signed-session (scrypt+HMAC, zero-dep) ฝัง workspaceId ใน token

## Working Log

- [Phase 4 Progress](log/phase-4-progress.md) — **active** — routing/assignment + LINE channel (sub-phase B) เสร็จ+verify (gate+integration) · ยังไม่ commit · เหลือ verify browser inbox refactor
- [Phase 3 Progress](log/phase-3-progress.md) — Phase 3 จบแล้ว (agent inbox realtime + auth) — archive ได้
- [Phase 2 Progress](log/phase-2-progress.md) — Phase 2 จบแล้ว (web channel e2e) — archive ได้

## Reference

<!-- pattern/สูตรที่ใช้ซ้ำ — ยังไม่มี -->

## Archived

<!-- ของที่ retire ดู _archive/INDEX.md -->
