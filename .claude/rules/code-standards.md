---
paths:
  - 'src/**'
  - 'apps/**'
  - 'packages/**'
  - 'services/**'
---

# Code Standards — Omni-Channel Chat Platform (stack-agnostic baseline)

> โหลดตอนแตะโค้ดจริง · ปรัชญา: **กฎที่ tool บังคับแล้ว ไม่ต้องท่องจำ — รู้ว่ามี gate อะไร + รันยังไง ก็พอ**
> ⚠️ ยัง **ไม่ได้เลือก stack** (backend/frontend/DB) — ไฟล์นี้เป็น baseline กลาง เมื่อเลือก stack แล้ว
> ให้แตก rule เฉพาะ (`backend-*.md`, `frontend-*.md`, per-channel) + เขียน ADR แล้วอัปเดตไฟล์นี้ให้ชี้ gate จริง
> 🚦 **ก่อนบอกว่า "เสร็จ" ต้องผ่าน [Definition of Done](definition-of-done.md)** ทุกครั้ง

## หลักการที่ยึดไว้ก่อน (ยังไม่มี automated gate — ยึดด้วยวินัย)

- **Typed & strict** — ใช้ static type (TS strict / type hints) · หลีกเลี่ยง `any` / untyped boundary
- **Boundaries ชัด** — โดเมน/business logic แยกจาก transport & framework · adapter ของแต่ละช่องทาง (LINE/Messenger/…)
  พึ่ง port/interface กลาง ไม่ผูกตรงกับ core · ทิศ dependency: **app/transport → adapter → domain** (ห้ามย้อน)
- **Unified message model** — ทุกช่องทาง map เข้า/ออกผ่าน schema ข้อความกลางตัวเดียว ไม่ให้ payload ดิบของแต่ละเจ้ารั่วเข้า core
- **No secret in code** — token/API key/webhook secret อยู่ใน env/secret store เท่านั้น · ห้าม commit `.env*`
- **Error handling ชัด** — คืนค่าแบบ explicit (เช่น `Result<T>` / typed error) แทน throw กลาง flow ปกติ ที่ boundary ภายนอก (webhook/ส่งข้อความ) ต้อง handle failure + retry/log
- **PII-aware** — ข้อความลูกค้าเป็นข้อมูลอ่อนไหว: ห้าม log body เต็ม/PII เป็น plaintext (ดู AGENTS.md → หมายเหตุความเป็นส่วนตัวของข้อมูล)

## Test conventions (baseline)

- โดเมน/logic กลาง = unit test ครอบ branch ใหม่ทุกอัน
- adapter ช่องทาง = contract test (mock provider + payload จริงจาก docs)
- flow ที่ผู้ใช้เห็น (inbound→route→outbound) = integration/e2e เมื่อ stack พร้อม

## Git & commit

- flow: ห้าม commit ตรง `main` — แตก `feature/*` เสมอ · commit ตอนพี่สั่งเท่านั้น (ดู AGENTS.md กฎเหล็ก)
- commit message: **conventional** (`feat:`/`fix:`/`chore:`/`docs:`/`refactor:`/`test:`) เนื้อความไทยได้

## Doc/Decision

- กฎใหม่ที่ตกลงกัน → เติมที่นี่ + [conventions.md](../memory/core/conventions.md) · ตัดสินใจใหญ่ → ADR ใน `decisions/` (`/new-adr`)
