---
paths:
  - 'apps/api/**'
  - 'packages/**'
---

# Backend Rules — Node/TS (Fastify · Drizzle · Zod)

> โหลดตอนแตะ backend (apps/api หรือ packages/\*) · ต่อยอดจาก [code-standards.md](code-standards.md) + [definition-of-done.md](definition-of-done.md)
> stack เต็ม + เหตุผล: [ADR-0002](../memory/decisions/0002-stack-and-repo-layout.md)

## Boundary (บังคับด้วย dependency-cruiser ใน `pnpm gate`)

- ทิศ **apps/api → adapter (db, channel-\*) → domain** — ห้ามย้อน
- `@omni/domain` = core ล้วน: **ห้าม import** Fastify/Drizzle/framework ใดๆ (มีแค่ Zod + logic)
- adapter (`@omni/db`, `@omni/channel-*`) พึ่งได้แค่ `@omni/domain` + npm ภายนอก — ห้ามพึ่ง adapter อื่น/apps
- raw provider payload (webhook ดิบ) อยู่ใน `@omni/db` (JSONB) เท่านั้น — ไม่ให้รั่วเข้า core

## Patterns

- **Composition root** = `apps/api/src/app.ts` (`buildApp()`) — wire routes/adapters/repos ที่นี่จุดเดียว
- **Test** ใช้ `app.inject()` (ไม่เปิด port) · adapter = contract test (mock provider + payload fixture สมมติจาก docs)
- **env** parse ด้วย Zod ที่ boundary ตอน boot (`loadEnv()` ใน `apps/api/src/env.ts`) — ห้ามอ่าน `process.env` ตรงในโค้ดลึก
- **Error** ที่ boundary ภายนอก (webhook/outbound send) คืน `Result<T, E>` จาก `@omni/domain` — throw เฉพาะ exceptional จริง; ต้อง handle failure + retry/log
- **Multi-tenant** — repository ทุกตัวรับ `workspaceId` เป็น param บังคับ · ทุก query scope ด้วย workspace เสมอ (ลืม = data leak ข้าม tenant)

## Drizzle

- schema + migrations (drizzle-kit) + repositories อยู่ใน `@omni/db` · repos implement port ของ domain
- migration = source of truth ของ DB · dev: `pnpm db:up` (docker-compose Postgres) ก่อนรัน integration test

## Gate ก่อนบอกเสร็จ

`pnpm gate` (lint + typecheck + test + boundaries) เขียว · แตะ flow inbound→route→outbound ต้อง verify จริง (ดู DoD ข้อ 3)
