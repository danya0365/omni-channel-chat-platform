---
description: สร้าง Architecture Decision Record (ADR) ใหม่ในระบบ memory ของโปรเจค
argument-hint: "[ชื่อเรื่องการตัดสินใจสั้นๆ]"
---

สร้าง ADR ใหม่ตาม convention ใน `.claude/memory/MEMORY-GUIDE.md` โดยเรื่องคือ: **$ARGUMENTS**

ทำตามขั้นตอนนี้:

1. ดูเลข ADR ล่าสุดใน `.claude/memory/decisions/` แล้วใช้เลขถัดไป (รูปแบบ `NNNN` เช่น `0002`)
2. แปลงชื่อเรื่องเป็น kebab-case → ตั้งชื่อไฟล์ `decisions/NNNN-<slug>.md`
3. เขียนไฟล์ด้วย frontmatter มาตรฐาน (`type: decision`, `status: active`, `scope`, `updated` = วันที่วันนี้)
   และโครง ADR: **บริบท / การตัดสินใจ / เหตุผล / ผลที่ตามมา-ข้อควรระวัง**
   - ถ้าผมยังไม่รู้รายละเอียดพอ ให้ถามพี่สั้นๆ ก่อนเขียน
4. เพิ่ม pointer 1 บรรทัดใน section "Decisions (ADR)" ของ `.claude/memory/MEMORY.md`
   รูปแบบ: `- [NNNN ชื่อ](decisions/NNNN-<slug>.md) — description สั้นที่บอกว่าเมื่อไรควรอ่าน`
5. ยืนยันกับพี่ว่าสร้างไฟล์ไหน + เตือนถ้า MEMORY.md ใกล้ 150 บรรทัด
