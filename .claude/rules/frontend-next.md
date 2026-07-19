---
paths:
  - 'apps/inbox/**'
  - 'apps/widget/**'
---

# Frontend Rules — Next.js inbox + Vite widget

> โหลดตอนแตะ frontend (agent inbox หรือ widget) · ต่อยอดจาก [code-standards.md](code-standards.md) + [definition-of-done.md](definition-of-done.md)
> stack เต็ม: [ADR-0002](../memory/decisions/0002-stack-and-repo-layout.md)

## หลักการ

- **inbox เป็น UI ล้วน** — คุย backend ผ่าน `apps/api` (HTTP + WebSocket) เท่านั้น · **ห้ามต่อ DB ตรง** จาก Next
- แชร์ type จาก `@omni/domain` ด้วย `import type` (unified schema ตัวเดียวทั้ง stack) — ห้าม redefine shape ฝั่ง client
- **No secret ใน client bundle** — เฉพาะค่า public (`NEXT_PUBLIC_*`) เท่านั้นที่ถึง browser · token ช่องทาง/DB อยู่ฝั่ง api
- **PII** — ข้อความลูกค้าแสดงบนจอได้ แต่ห้าม log ลง console/telemetry ฝั่ง client เป็น plaintext

## Next.js (App Router)

- default เป็น **Server Component** · ใส่ `'use client'` เฉพาะส่วนที่ต้อง interactive (reply box, realtime list)
- realtime = ต่อ WebSocket ไป `apps/api` จาก client component (reconnect + auth token)
- multi-tenant — ทุก request ต้องพก workspace context (session ผูก workspace) · UI ไม่ข้าม tenant

## Widget (Vite)

- build เป็น IIFE `widget.js` ฝังผ่าน `<script>` · โหลดเบา, ไม่พึ่ง framework หนัก
- คุย api ผ่าน channel key ของ workspace (public identifier) — ไม่ฝัง secret ใน bundle

## Gate ก่อนบอกเสร็จ

`pnpm gate` เขียว + `pnpm --filter @omni/inbox build` (next build) / `--filter @omni/widget build` ผ่าน ·
แตะหน้า inbox จริง → verify บน browser (ดู DoD ข้อ 3)
