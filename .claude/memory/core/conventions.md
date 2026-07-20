---
name: conventions
description: มาตรฐานโค้ด/naming/git ของโปรเจค (อ่านก่อนเขียนโค้ดใหม่ หรือเมื่อสงสัยว่าควรวางไฟล์/ตั้งชื่อยังไง) — ชี้ไป code-standards rule ที่โหลดตอนแตะโค้ด
metadata:
  node_type: memory
  type: convention
  status: active
  scope: global
  updated: 2026-07-18
  originSessionId: d27419a9-916f-408a-b0de-cf37ab7a91c6
---

# Coding Conventions (baseline)

> มาตรฐานเต็ม (โหลดตอนแตะโค้ด) อยู่ที่ [`.claude/rules/code-standards.md`](../../rules/code-standards.md)
>
> - [`definition-of-done.md`](../../rules/definition-of-done.md) · ไฟล์นี้สรุปสั้นๆ
>   stack เคาะแล้ว → [ADR-0002](../decisions/0002-stack-and-repo-layout.md) · โหลด rule เฉพาะ (`backend-node.md`/`frontend-next.md`) ตอนแตะโค้ด

## หลักที่ยึดก่อน

- **Typed & strict** — static type ทุกที่, เลี่ยง `any`/untyped boundary
- **Unified message model** — ทุกช่องทาง map เข้า/ออก schema กลางตัวเดียว; core ไม่รู้จัก payload ดิบของแต่ละเจ้า
- **Boundaries** — domain แยกจาก transport/framework; adapter ของช่องทางพึ่ง port กลาง; ทิศ dependency **app → adapter → domain** (ห้ามย้อน)
- **No secret in code** — token/webhook secret อยู่ใน env/secret store; `.env*` ต้อง gitignore
- **PII-aware** — ห้าม log ข้อความลูกค้า/PII เต็มเป็น plaintext

## Git

- **integration branch = `main`** — ห้าม commit ตรง `main` → แตก `feature/*` เสมอ · **PR base = `main`** · ซอย 1 phase เป็นหลาย sub-phase PR ได้ (Phase 4 เข้า main เป็น PR #2–#6)
- commit **เมื่อพี่สั่งเท่านั้น** (กฎเหล็ก AGENTS.md)
- commit message: **conventional** (`feat:`/`fix:`/`chore:`/`docs:`/`refactor:`/`test:`) เนื้อความไทยได้

## โครงสร้าง (monorepo — pnpm workspaces)

- `apps/` — api (Fastify), inbox (Next.js), widget (Vite) · `packages/` — domain, db, channel-\*
- ทิศ dependency **apps → adapter → domain** (บังคับด้วย dependency-cruiser ใน `pnpm gate`)
- แตะ backend → โหลด `.claude/rules/backend-node.md` · frontend → `frontend-next.md`

## Naming

- **ID**: `<prefix>_<uuidv7>` (text, time-sortable) — prefix `ws` `msg` `conv` `ctc` (contact) `idn` (identity) `chn` `agt`
- **DB**: table พหูพจน์ snake_case (`messages`, `contact_identities`), column snake_case · **TS**: camelCase
- **Multi-tenant**: `Workspace` เป็น root · ทุก entity มี `workspaceId` · scope ทุก query/route ด้วย workspace เสมอ

## ที่ยังไม่ตกลง (TODO — เคาะทีหลัง)

- auth จริงของ inbox (เริ่ม session cookie → Auth.js/OIDC เมื่อมีทีม)
- deployment + secret store จริง (ตอนนี้ env/`.env` local) · media/attachment storage (S3-compatible)
- prod build/bundle ของ api (tsup/esbuild) · scale WS หลาย instance (Redis pub/sub)
