---
description: สร้าง memory spec ของช่องทางแชท (channel) ใหม่ในระบบ omni-channel
argument-hint: "[ชื่อ channel เช่น line / messenger / whatsapp / web-widget]"
---

สร้าง memory spec สำหรับช่องทางแชทใหม่ตาม convention ใน `.claude/memory/MEMORY-GUIDE.md`
ชื่อ channel: **$ARGUMENTS**

ทำตามขั้นตอนนี้:

1. แปลงชื่อเป็น kebab-case → สร้างไฟล์ `.claude/memory/channels/<slug>.md`
2. frontmatter มาตรฐาน (`type: channel`, `status: active`, `scope: <slug>`, `updated` = วันนี้)
3. โครงเนื้อหา spec (เว้นที่ให้เติม):
   - **ผู้ให้บริการ & API** — เจ้าของแพลตฟอร์ม, เวอร์ชัน API, docs, rate limit
   - **Inbound (webhook)** — endpoint ที่รับข้อความเข้า, การ verify signature, event types
   - **Outbound (send)** — API ส่งข้อความออก, media/template ที่รองรับ
   - **Auth & token** — token/secret ที่ต้องใช้, เก็บที่ไหน (⚠️ ไม่ hardcode)
   - **Message mapping** — map payload ของช่องทางนี้ ↔ รูปแบบ message กลางของระบบ (unified schema)
   - **ปม technical ที่ต้องระวัง** — เช่น dedup, ordering, session window, delivery/read receipt
4. เพิ่ม pointer ใน section "Active Channels" ของ `.claude/memory/MEMORY.md`
5. (ถ้าเริ่ม coding แล้ว) เสนอว่าจะ scaffold โครง adapter ของ channel ต่อเลยไหม
