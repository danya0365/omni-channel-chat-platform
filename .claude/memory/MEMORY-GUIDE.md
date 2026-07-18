---
name: memory-guide
description: คู่มือ convention + lifecycle ของระบบ memory (อ่านก่อนเขียน/ย้าย/archive memory ทุกครั้ง) — ไฟล์นี้ไม่ถูกโหลดอัตโนมัติ
metadata:
  type: convention
  status: active
  scope: global
  updated: 2026-07-18
---

# Memory — คู่มือ & Lifecycle

ระบบนี้สร้างทับกลไก auto-memory ของ Claude Code เพื่อให้ **context ไม่บวม**
แม้ memory จะโตเป็นหลายร้อยไฟล์ Iris ต้องทำตามคู่มือนี้ทุกครั้งที่จัดการ memory

## หลักการ (ทำไมไม่บวม)
- **เฉพาะ `MEMORY.md` ที่โหลดทุก session** (200 บรรทัด/25KB แรก) → คุมให้ **≤150 บรรทัด**
- Topic files **ไม่โหลดตอนเริ่ม** — Iris เปิดอ่าน on-demand เมื่อ description ใน index ชี้ว่าเกี่ยว
- ไฟล์ที่ **ไม่อยู่ใน `MEMORY.md` = ไม่ recall อัตโนมัติ แต่เปิดอ่านได้** → กลไก "library"

## โครงสร้างโฟลเดอร์
| โฟลเดอร์ | เก็บอะไร |
|----------|----------|
| `core/` | ความรู้แกนถาวร: persona, project-overview, conventions |
| `decisions/` | ADR — 1 ไฟล์ = 1 การตัดสินใจ ตั้งชื่อ `NNNN-title.md` (เลขรันต่อ) |
| `channels/` | spec ต่อช่องทางแชท (1 ไฟล์ = 1 channel เช่น line/messenger/whatsapp) — สร้างด้วย `/new-channel` |
| `modules/` | spec ต่อ service/module ภายใน (1 ไฟล์ = 1 module เช่น routing, inbox, bot-engine) |
| `log/` | working log/progress — เก็บล่าสุดที่ active, เก่าย้าย `_archive/` |
| `reference/` | pattern/สูตรที่หยิบใช้ซ้ำ (ไม่ใช่ decision) |
| `_archive/` | library/cold storage — **ไม่ลิสต์ใน MEMORY.md** มี `INDEX.md` เป็น catalog |

## Frontmatter มาตรฐาน (ทุก topic file)
```yaml
---
name: <slug-kebab-case>
description: <1 บรรทัด ช่วย Iris ตัดสินใจ recall — บอกว่า "อ่านเมื่อ...">
metadata:
  type: persona | decision | module | channel | convention | log | reference
  status: active | archived
  scope: <ชื่อ module/channel หรือ global>
  updated: YYYY-MM-DD
---
```
- เชื่อม memory ที่เกี่ยวกันใน body ด้วย `[[name]]`
- `description` สำคัญสุด — recall ไม่ใช่ semantic อัตโนมัติ Iris เลือกเปิดจาก description ใน index
- ⚠️ **frontmatter อาจถูก memory-graph hook normalize** (เหลือ `name:""` + `node_type:memory` + `originSessionId`) —
  field อย่าง `progress:`/`updated:` ใน frontmatter อาจ **หายไปเอง** (edit แล้ว "not found")
  → **เก็บสถานะ/ความคืบหน้าใน body เสมอ ไม่ใช่ frontmatter** (frontmatter ไว้แค่ name/description/type สำหรับ recall)

## Lifecycle

### เพิ่ม memory ใหม่
1. เขียน topic file ในโฟลเดอร์ที่ตรงประเภท พร้อม frontmatter ครบ
2. เพิ่ม pointer 1 บรรทัดใน `MEMORY.md` section ที่ตรง: `- [Title](path) — description สั้น`
3. ถ้าเป็นการตัดสินใจสำคัญ → สร้าง ADR ใน `decisions/` ด้วย (`/new-adr`)

### คุมขนาด index
- ถ้า `MEMORY.md` ใกล้ ~150 บรรทัด → archive ของที่ไม่ active ออกก่อน หรือยุบ pointer ที่ซ้ำซ้อน
- Iris ต้อง **เตือนพี่** เมื่อ index ใกล้เต็ม (`/memory-status` ช่วยตรวจ)

### Archive (ย้ายเข้า library)
เมื่อ module/channel/decision เลิกใช้ หรือ log เก่า:
1. `git mv` ไฟล์ → `_archive/`
2. แก้ frontmatter `status: archived`
3. ลบ pointer ออกจาก `MEMORY.md`
4. เพิ่ม 1 แถวใน `_archive/INDEX.md`: ชื่อไฟล์ · เหตุผล · วันที่

(ทำผ่าน `/archive-memory <path>` ได้เลย)

### Promote กลับ
1. `git mv` ไฟล์ออกจาก `_archive/` กลับโฟลเดอร์เดิม
2. แก้ frontmatter `status: active`
3. คืน pointer ใน `MEMORY.md`
4. ลบแถวออกจาก `_archive/INDEX.md`

### เกณฑ์ตัดสิน archive
- ไม่ถูกอ้างอิง/แตะนานหลายเดือน **หรือ** ถูกแทนที่/ลบจริง (เช่น channel ที่เลิกรองรับ)
- ADR ที่ถูก supersede → ไม่ลบ แต่ archive + ชี้ ADR ใหม่ที่แทน
