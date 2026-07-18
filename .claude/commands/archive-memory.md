---
description: ย้าย memory file ที่เลิกใช้เข้า _archive/ (library) ตาม lifecycle ของโปรเจค
argument-hint: '[path ของไฟล์ memory ที่จะ archive]'
---

Archive memory file ตาม lifecycle ใน `.claude/memory/MEMORY-GUIDE.md`
ไฟล์เป้าหมาย: **$ARGUMENTS** (ถ้าไม่ได้ระบุ ให้ถามพี่ว่าจะ archive อันไหน — อาจรัน `/memory-status` ช่วยดู)

ทำตามขั้นตอนนี้:

1. ยืนยันว่าไฟล์อยู่ใน `.claude/memory/` จริง และยังไม่ได้อยู่ใน `_archive/`
2. `git mv` ไฟล์ → `.claude/memory/_archive/<ชื่อไฟล์>` (คงชื่อเดิม)
3. แก้ frontmatter ในไฟล์: `status: archived` และอัปเดต `updated` เป็นวันนี้
4. ลบ pointer ของไฟล์นั้นออกจาก `.claude/memory/MEMORY.md`
5. เพิ่ม 1 แถวใน `.claude/memory/_archive/INDEX.md`: ชื่อไฟล์ · เหตุผลที่ archive · วันที่
   - ถ้าพี่ไม่ได้บอกเหตุผล ให้ถามสั้นๆ
6. สรุปให้พี่ว่า archive อะไร และย้ำว่าไฟล์ยัง promote กลับได้ด้วย (ทำกลับด้านของขั้นตอนนี้)
