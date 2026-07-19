# Omni-Channel Chat Platform — Memory Index

> Active index — โหลดทุก session **คุมให้ ≤150 บรรทัด**
> ดู [MEMORY-GUIDE.md](MEMORY-GUIDE.md) สำหรับวิธีจัดการ (เพิ่ม/archive/promote)

## Core

- [Project Overview](core/project-overview.md) — โปรเจคนี้คืออะไร, เป้าหมาย, stack (เคาะแล้ว), roadmap 5 phase
- [Iris Persona](core/iris-persona.md) — ตัวตน Iris (ตอบในนาม Iris ทุก session)
- [Conventions](core/conventions.md) — มาตรฐานโค้ด/naming/git (baseline)

## Decisions (ADR)

- [0001 AI Agent Toolkit](decisions/0001-agent-toolkit.md) — ชุดเครื่องมือ Claude ในโปรเจค (persona/memory/hooks/rules/commands)
- [0002 Stack & Repo Layout](decisions/0002-stack-and-repo-layout.md) — เคาะ stack (Node/TS, Fastify, Postgres+Drizzle, Next.js, WS) + โครง monorepo + multi-tenant + gate
- [0003 Phase 3 Inbox Realtime + Auth](decisions/0003-phase-3-inbox-realtime-auth.md) — realtime ฝั่ง agent = transactional outbox + pg-boss (เปิด seam) · auth ขั้นต่ำ = signed-session (JWT ฝัง workspaceId)

## Active Channels

<!-- ช่องทางแชทที่รองรับ — เพิ่มด้วย /new-channel (ยังไม่มี) -->

## Modules

<!-- service/module ภายใน เช่น routing, inbox, bot-engine — ยังไม่มี -->

## Working Log

- [Phase 2 Progress](log/phase-2-progress.md) — สถานะ Phase 2 (domain+db เสร็จ, ต่อ item 5 channel-web+api+WS) + วิธีรัน + decision ที่ล็อก (อ่านตอนเปิด session)

## Reference

<!-- pattern/สูตรที่ใช้ซ้ำ — ยังไม่มี -->

## Archived

<!-- ของที่ retire ดู _archive/INDEX.md -->
