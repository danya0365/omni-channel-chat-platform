---
name: project-overview
description: Omni-Channel Chat Platform คืออะไร — เป้าหมายผลิตภัณฑ์, แนวคิด architecture, stack (ยัง TBD), roadmap (อ่านตอนเริ่ม session หรือทบทวนภาพรวม)
metadata:
  type: convention
  status: active
  scope: global
  updated: 2026-07-18
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

## Stack — ⚠️ ยังไม่เลือก (TBD)
ยังไม่ได้ตัดสินใจภาษา/framework/DB/queue. เมื่อเคาะแล้วให้:
1. เขียน ADR ใน `decisions/` (`/new-adr`) บันทึกเหตุผล
2. อัปเดตส่วน "Stack & โครงสร้าง" ใน `~/omni-channel-chat-platform/AGENTS.md`
3. แตก scoped rule เฉพาะ stack ใน `.claude/rules/` (เช่น `backend-*.md`, `frontend-*.md`)

ตัวเลือกที่ต้องเคาะกับพี่: ภาษา backend (Node/TS, Go, Python…), realtime (WebSocket/SSE),
DB (Postgres…), message queue, framework frontend (dashboard), deployment

## Roadmap (คร่าวๆ — ปรับกับพี่)
1. เลือก stack + วางโครง repo (monorepo?) → ADR
2. Unified message model + 1 channel adapter แรก (เช่น LINE หรือ web widget) end-to-end
3. Agent inbox ขั้นต่ำ (เห็นแชท + ตอบได้)
4. Routing + เพิ่มช่องทางที่ 2, 3
5. Bot/automation + (อนาคต) AI reply
