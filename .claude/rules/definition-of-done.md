---
paths:
  - 'src/**'
  - 'apps/**'
  - 'packages/**'
  - 'services/**'
---

# Definition of Done — เช็คก่อนบอกว่า "เสร็จ" (ทุก session / ทุก AI / พกข้ามโปรเจคได้)

> **กฎข้อเดียวที่สำคัญสุด:** ห้ามบอกพี่ว่างาน "เสร็จ" จนกว่าจะผ่าน checklist นี้ครบ —
> ไม่ว่าจะ session ไหน, AI ตัวไหน, มี persona Iris หรือไม่. นี่คือมาตรฐานตายตัว ไม่ใช่ทางเลือก.

## ✅ Checklist ก่อนปิดงาน (เรียงตามลำดับ)

### 1. Gate เขียวครบ — **บังคับเสมอ**

รันคำสั่งเดียว: **`pnpm gate`** = lint (ESLint) + typecheck (`tsc --noEmit` ทุก package) +
test (Vitest) + boundary check (dependency-cruiser). ต้องเขียวทุกตัว.

> CI รัน `pnpm gate` + `pnpm format` + `pnpm build` อัตโนมัติ (`.github/workflows/ci.yml`) ทุก push/PR.
> แตะ DB → `pnpm db:up` (docker-compose Postgres) ก่อนรัน integration test.

### 2. Test ครอบของใหม่ — **บังคับเมื่อเพิ่ม/แก้ logic**

- โดเมน/logic กลาง = test ครอบทุก branch ใหม่
- adapter ช่องทาง = contract test (mock provider + payload จาก docs จริง)
- ทุก behavior ใหม่ต้องมี test ยืนยัน — ไม่ใช่แค่ "คอมไพล์ผ่าน"

### 3. Verify บน real-flow — **บังคับเมื่อแตะ flow ที่ผู้ใช้/ช่องทางเห็น**

ถ้างานแตะ inbound webhook → routing → outbound send, หรือหน้า agent inbox, หรือเขียน/อ่าน DB จริง:

- รัน/ยิงจริงให้เห็นว่า flow ทำงาน (เช่น ส่ง test message เข้า webhook แล้ว trace จนตอบกลับ)
- ⚠️ **stack ไม่ up (ไม่มี dev server / provider sandbox)** → **ห้ามเคลมว่า "เสร็จ/พิสูจน์แล้ว"** ·
  ต้องแจ้งพี่ตรงๆ ว่า "โค้ดเขียวแต่ยังไม่ได้ verify บนจริงเพราะ stack ไม่ up" + บอกวิธีรัน

> งานที่ไม่แตะ flow จริง (refactor logic ล้วน, แก้ doc/memory, type-only) → ข้อ 3 ไม่บังคับ

### 4. Commit สะอาด

- conventional message (`feat:`/`fix:`/`docs:`…) · subject ไทยได้ · body ≤100 char/บรรทัด
- ปิดท้าย `Co-Authored-By:` ตามโมเดลที่ลงมือจริงใน session นั้น (เช่น `Claude Fable 5 <noreply@anthropic.com>`)
- ไม่มี secret/คีย์/webhook token หลุด · `.env*` ต้อง gitignore
- งานใหญ่ → **commit ทีละ increment ที่เขียว** (ไม่กองรวมก้อนเดียว)
- ⚠️ commit **เมื่อพี่สั่งเท่านั้น** (กฎเหล็กใน AGENTS.md)

### 5. รายงานตรง (ห้าม overclaim)

บอกชัด: ผ่านอะไร / ข้ามอะไร / เหลืออะไร. ถ้า test fail หรือข้าม step ให้พูดตรง พร้อม output.
"เสร็จและพิสูจน์แล้ว" = ผ่านข้อ 1-3 จริงเท่านั้น.

## สรุปสั้น (จำ 1 บรรทัด)

> **โค้ดเขียว (lint/type/test) → test ครอบของใหม่ → verify บนจริงถ้าแตะ flow → commit สะอาด (เมื่อสั่ง) → รายงานตรง**

ดูมาตรฐานโค้ดเต็ม: [code-standards.md](code-standards.md)
