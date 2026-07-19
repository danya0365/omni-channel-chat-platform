---
name: adr-0002-stack-and-repo-layout
description: 'ADR-0002 — เคาะ stack (Node/TS, Fastify, Postgres+Drizzle, Next.js, Vite widget, WebSocket) + โครง monorepo (pnpm workspaces) + tenancy + gate (อ่านเมื่อสงสัยว่าทำไมเลือก tech นี้ หรือจะเพิ่ม package/แก้โครง)'
metadata:
  node_type: memory
  type: decision
  status: active
  scope: global
  updated: 2026-07-18
  originSessionId: d27419a9-916f-408a-b0de-cf37ab7a91c6
---

# ADR-0002 — Stack & Repo Layout

## บริบท

เดิม stack เป็น TBD (ดู [[project-overview]]). เริ่ม Phase 1 จริง จึงต้องเคาะภาษา/framework/DB/
โครง repo ให้ครบก่อนลงโค้ด domain. เกณฑ์: **moving parts ต่ำสุด** สำหรับ solo/ทีมเล็กบน macOS,
รองรับ webhook + realtime + multi-channel, และคุม boundary (app → adapter → domain) ได้แบบ mechanical

## การตัดสินใจ

**ภาษา/รันไทม์:** Node.js 22 LTS + TypeScript strict (pin `.nvmrc`, `engines`)

**Backend:** Fastify — long-running server รองรับ WebSocket + raw body (จำเป็นกับ HMAC verify ของ
LINE/Meta) + `app.inject()` เทสไม่ต้องเปิด port

**DB:** Postgres 16 (docker-compose) + **Drizzle ORM** (SQL-first, type แน่น, ไม่มี codegen ขั้นกลาง) ·
raw webhook payload เก็บ JSONB ใน `@omni/db` เท่านั้น (ไม่หลุดเข้า core)

**Validation:** Zod — ใช้ 3 จุด: unified schema (domain), provider payload (adapter), env parse ตอน boot

**Frontend inbox:** Next.js (App Router) · **Widget:** Vite build เป็น IIFE `widget.js` (ฝัง `<script>` ได้)

**Realtime:** WebSocket บน Fastify (`apps/api`) — **ไม่ host WS บน Next.js** (ไม่ถนัด); widget + inbox
ต่อ WS เข้า api ตรง · ภายใน api เป็น pub/sub interface (in-process ก่อน → Redis เมื่อ scale หลาย instance)

**Queue:** **defer** — seam = port `EventBus` + transactional outbox table · เมื่อจำเป็นสลับเป็น pg-boss
(queue บน Postgres ไม่เพิ่ม infra) โดย domain ไม่แก้ → เขียน ADR ตอนนั้น

**Monorepo:** pnpm workspaces (ยังไม่เอา Turborepo) · โครง:

```
apps/  api (Fastify) · inbox (Next.js) · widget (Vite)
packages/  domain (@omni/domain, core ล้วน) · db (@omni/db) · channel-web · channel-line (Phase 4)
```

internal package export ชี้ `./src/index.ts` ตรง (types + default) — tsx/vitest/tsc bundler อ่าน .ts ได้
ไม่ต้อง build ขั้นกลางตอน dev

**Tenancy:** **multi-tenant ตั้งแต่แรก** — `Workspace` เป็น root, ทุก entity มี `workspaceId`,
ทุก query/route/WS scope ด้วย workspace เสมอ (repository รับ `workspaceId` เป็น param บังคับ)

**Gate:** `pnpm gate` = ESLint + `tsc --noEmit` (ทุก package) + Vitest + dependency-cruiser (boundary) ·
ผูก GitHub Actions CI (`.github/workflows/ci.yml`)

**ID convention:** `<prefix>_<uuidv7>` (text) — prefix `ws`/`msg`/`conv`/`ctc`/`idn`/`chn`/`agt` ·
DB snake_case, TS camelCase (ดู [[conventions]])

## เหตุผล

- **ภาษาเดียวทั้ง stack** (backend/frontend/widget/schema) — แชร์ type ของ unified schema ข้ามชั้นได้จริง
- **Fastify + Drizzle + Zod + Postgres** = moving parts ต่ำ, type-safe boundary, ไม่มี magic/codegen หนัก
- **pnpm workspaces + dependency-cruiser** — คุมทิศ dependency แบบ mechanical (อยู่ใน gate) ไม่พึ่งวินัยล้วน
- **defer queue** — MVP ไม่ต้องการ throughput สูง แต่วาง seam ไว้ไม่ให้ต้อง rewrite

## ผลที่ตามมา / ข้อควรระวัง

- ⚠️ WS ไม่อยู่บน Next.js → inbox เป็น UI ล้วน ต่อ api แยก (เผื่อ CORS/auth ข้าม origin ตอน deploy)
- ⚠️ multi-tenant = ทุก query/test/auth ต้อง scope workspace ตั้งแต่ MVP (ลืม = data leak ข้าม tenant)
- ⚠️ internal package ชี้ `.ts` ตรง → prod build ของ api ต้อง bundle/transpile ทีหลัง (Phase 2+ ค่อยเลือก tsup/esbuild)
- ⚠️ Next auto-reconfig `tsconfig.json` + `next-env.d.ts` ตอน build ครั้งแรก (ปกติ — commit ตามได้)
- pin เวอร์ชัน stack ใน `package.json` ราก + per-package · upgrade Node/framework = แก้ pin จุดเดียว
