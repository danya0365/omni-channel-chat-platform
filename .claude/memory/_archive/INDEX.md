# Archive Index (Library / Cold Storage)

ไฟล์ในโฟลเดอร์ `_archive/` คือ memory ที่ **retire แล้ว** — ไม่ถูกลิสต์ใน `MEMORY.md`
จึง **ไม่ถูก recall อัตโนมัติ / ไม่กิน context** แต่ยังเปิดอ่าน/promote กลับได้

วิธีใช้: เมื่อ archive ไฟล์ → ย้ายไฟล์มาที่นี่ + เพิ่ม 1 บรรทัดด้านล่าง (ชื่อ · เหตุผล · วันที่)
วิธี promote กลับ → ย้ายไฟล์ออก + คืน pointer ใน `MEMORY.md` + ลบบรรทัดที่นี่

| ไฟล์                | เหตุผลที่ archive                                                 | วันที่     |
| ------------------- | ----------------------------------------------------------------- | ---------- |
| phase-1-handoff.md  | ถูกแทนด้วย log/phase-2-progress.md (Phase 1 จบ, Phase 2 เดินแล้ว) | 2026-07-18 |
| phase-2-progress.md | Phase 2 จบ + merged เข้า main (PR #1) — Phase 4 เดินจบแล้ว        | 2026-07-20 |
| phase-3-progress.md | Phase 3 จบ + merged เข้า main (PR #1) — Phase 4 เดินจบแล้ว        | 2026-07-20 |
