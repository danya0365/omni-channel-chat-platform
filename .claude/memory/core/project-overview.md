---
name: project-overview
description: 'Omni-Channel Chat Platform คืออะไร — เป้าหมายผลิตภัณฑ์, แนวคิด architecture, stack (เคาะแล้ว ดู ADR-0002), roadmap 5 phase (อ่านตอนเริ่ม session หรือทบทวนภาพรวม)'
metadata:
  node_type: memory
  type: convention
  status: active
  scope: global
  updated: 2026-07-18
  originSessionId: d27419a9-916f-408a-b0de-cf37ab7a91c6
---

# Omni-Channel Chat Platform — ภาพรวม

## โปรเจคนี้คืออะไร

แพลตฟอร์ม **รวมข้อความลูกค้าจากหลายช่องทางเข้ามาที่เดียว** — ลูกค้าทักเข้ามาจากช่องทางไหน
(LINE, Facebook Messenger, Instagram, WhatsApp, web chat widget, อีเมล ฯลฯ) ทีมงานก็ตอบได้จาก
**inbox เดียว** พร้อมระบบ routing, บอท/automation, และประวัติการสนทนาแบบรวมศูนย์

## แนวคิด architecture (ตั้งใจไว้ — ยังไม่ลงโค้ด)

- **Channel adapters** — แต่ละช่องทางเป็น adapter แยก รับ inbound webhook + ส่ง outbound
  แต่ทุกช่องทาง map เข้า/ออกผ่าน **unified message schema** ตัวเดียว (core ไม่รู้จัก payload ดิบของแต่ละเจ้า)
- **Core / routing** — รับ message กลาง → assign/route ไปยัง agent หรือ bot → เก็บ conversation
- **Agent inbox** — หน้าจอให้ทีมงานเห็นทุกแชทรวมกัน ตอบกลับได้
- **Bot / automation** — ตอบอัตโนมัติ, auto-reply, keyword/flow, (อนาคต) เชื่อม AI

## Stack — เคาะแล้ว (ดู [[adr-0002-stack-and-repo-layout]])

- **Backend**: Node.js 22 + TypeScript strict · Fastify · Postgres 16 + Drizzle ORM · Zod
- **Realtime**: WebSocket บน Fastify (api) — inbox/widget ต่อ api ตรง
- **Frontend**: Next.js (agent inbox) · Vite widget (IIFE ฝัง `<script>`)
- **Queue**: defer — seam `EventBus`/outbox → pg-boss เมื่อจำเป็น
- **Monorepo**: pnpm workspaces · `apps/{api,inbox,widget}` + `packages/{domain,db,channel-*}`
- **Tenancy**: multi-tenant ตั้งแต่แรก (`Workspace` root, ทุก entity มี `workspaceId`)
- **Gate**: `pnpm gate` = lint + typecheck + test + boundary (dependency-cruiser) + CI

## Roadmap (5 phase)

1. ✅ **Phase 1** — stack skeleton + gate + CI + ADR (เสร็จ: gate เขียว, api `/healthz`, inbox/widget build ผ่าน)
2. **Phase 2** — unified message model (`@omni/domain`) + web widget channel end-to-end (inbound→persist→outbound realtime)
3. **Phase 3** — agent inbox ขั้นต่ำ (conversation list + reply + realtime) + auth ขั้นต่ำ
4. **Phase 4** — routing/assignment + LINE channel (HMAC verify, reply/push, `/new-channel line`)
5. **Phase 5** — bot/automation (keyword → canned → escalate) + AI reply (Claude API, ADR แยก, ปม PII)
