---
name: adr-0007-phase-6-entitlements
description: 'ADR-0007 — Phase 6: entitlement (เปิด/ปิดฟีเจอร์ต่อ workspace ตามที่ลูกค้าซื้อ). gate ระดับ "โมดูล" ไม่ใช่รายฟีเจอร์ · ช่องทางแชท gate ด้วยข้อมูล (ไม่ใช้ flag) · บริการ (training/self-host) ไม่ใช่ flag · บังคับที่ server (domain/route) UI แค่ซ่อน · generalize workspace_bot_config → workspace_entitlements แบบ additive · self-host กันไม่ได้จริง ยอมรับ. อ่านเมื่อเพิ่มฟีเจอร์ที่ขายแยก / แตะ entitlement / ทำ admin เปิดปิดฟีเจอร์'
metadata:
  node_type: memory
  type: decision
  status: active
  scope: global
  updated: 2026-07-21
  originSessionId: 3be9577c-b819-462f-a61d-267f34fc9eb5
  modified: 2026-07-21T03:54:30.526Z
---

# ADR-0007 — Phase 6: Entitlements (เปิด/ปิดฟีเจอร์ตามที่ลูกค้าซื้อ)

## บริบท

เราทำ **ใบเสนอราคาแบบเลือกฟีเจอร์เอง** เสร็จแล้ว (`apps/billing` — 72 ฟีเจอร์ / 10 หมวด · ลูกค้าติ๊กเอง
ราคาคำนวณให้) ทำให้เกิดคำถามตามมา: **โค้ดจะรู้ได้ยังไงว่าลูกค้าคนนี้ซื้ออะไรไว้**

โจทย์จากพี่: _"เขียนให้ครบทุกฟีเจอร์ แล้วเปิด/ปิดในโค้ดได้ ถ้าลูกค้าจ่ายเพิ่มค่อยเปิด"_

**ทุนเดิมที่ reuse ได้:** Phase 5 มี `workspace_bot_config` (`botEnabled` / `aiEnabled` ต่อ workspace ·
**ไม่มี row = ปิด** · เช็คที่ `bot-consumer.ts` ฝั่ง server) — นี่คือ entitlement pattern ที่ถูกอยู่แล้ว
แค่ยังมี 2 สวิตช์

## การตัดสินใจ

### 1. สร้าง "กลไก" ก่อน · เขียน "ฟีเจอร์" ตอนมีคนจ่าย

**ไม่เขียนครบ 72 ฟีเจอร์ก่อนขาย** — 72 ฟีเจอร์ = หลายเดือนถึงเป็นปีสำหรับ solo+AI · ฟีเจอร์ที่ไม่มีใครซื้อ
= หนี้ maintenance ตลอดชีพ (test/migration/security patch) · และใบเสนอราคาถูกสร้างมาเพื่อ **ให้ลูกค้า
บอกเราว่าต้องการอะไร** ถ้าเดาเองก่อนก็เสียของ

→ Phase 6 ทำ **entitlement mechanism** ให้เสร็จ แล้วเขียนฟีเจอร์เรียงตามดีมานด์จริง เสียบ flag ที่รออยู่

### 2. ไม่ใช่ทุกอย่างในใบเสนอราคาต้องมี flag — แบ่ง 3 ประเภท

| ประเภท                                                            | จำนวน | กลไก                                                                                                               |
| ----------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| **ช่องทางแชท**                                                    | ~10   | **ไม่ใช้ flag** — gate ด้วยข้อมูล: ไม่ได้ซื้อ = ไม่สร้าง row ใน `channels` + ไม่ใส่ credential (มีตั้งแต่ Phase 4) |
| **บริการ** (training, ย้ายข้อมูล, ดูแล 1 ปี, SLA 24/7, self-host) | ~10   | **ไม่ใช่โค้ด** — งานคน ไม่มี flag                                                                                  |
| **ฟีเจอร์ในระบบ**                                                 | ~45   | ✅ ใช้ entitlement                                                                                                 |

### 3. Gate ระดับ **โมดูล** (~8 flag) ไม่ใช่รายฟีเจอร์ (45 flag)

45 boolean = 2⁴⁵ combination ที่เทสต์ไม่ไหว · flag ยิ่งละเอียด โค้ดยิ่งเป็นป่า `if`

**โมดูลเริ่มต้น (8):** `inbox_advanced` · `routing_advanced` · `bot` · `ai` · `crm_advanced` ·
`reports` · `integrations` · `security_advanced`

- ผลข้างเคียงที่ **ยอมรับ**: ลูกค้าซื้อ "รายงาน SLA" ตัวเดียว จะได้รายงานทั้งโมดูล — ไม่มีต้นทุนเพิ่มสำหรับเรา
  และเป็น pleasant surprise · ความละเอียดในใบเสนอราคาคือเครื่องมือ **ตั้งราคา** ไม่ใช่เครื่องมือ **บังคับสิทธิ์**
- type เป็น union ของ string literal → **แตกละเอียดขึ้นทีหลังได้แบบ additive** (เพิ่มสมาชิกใน union)
  เมื่อมีลูกค้าอยากซื้อเป็นชิ้นจริงๆ

### 4. บังคับที่ **server** — UI แค่ซ่อน

- เช็คใน domain service / route handler (pattern เดียวกับ `bot-consumer` ที่เรียก `getBotConfig` ก่อนทำงาน)
- `apps/inbox` ซ่อนเมนู/ปุ่มที่ไม่ได้ซื้อ = **UX เท่านั้น ไม่ใช่ security** — ถ้าซ่อนแค่ UI ลูกค้ายิง API ตรงได้
- ไม่มี entitlement = **ปิด** (fail-closed เหมือน `workspace_bot_config` ที่ไม่มี row = bot ปิด)

### 5. Storage = `workspace_entitlements` (1 row ต่อ workspace, `modules` jsonb)

- ตารางใหม่ `workspace_entitlements (workspace_id PK → workspaces, modules jsonb, created_at, updated_at)`
- เก็บเป็น **array ของ module id** (ไม่ใช่คอลัมน์ boolean ต่อโมดูล) → เพิ่มโมดูลใหม่ **ไม่ต้อง migration**
- **additive — ไม่รื้อ `workspace_bot_config`**: ตารางเดิมยังอยู่และยังทำงาน (Phase 5 verify ไปแล้ว)
  · `bot` / `ai` เป็นโมดูลใน entitlements ด้วย และ **ต้องผ่านทั้งคู่** (entitlement = "ซื้อไหม" ·
  bot config = "เปิดใช้ไหม") — สิทธิ์กับสวิตช์ใช้งานเป็นคนละเรื่อง

### 6. Self-host = กันไม่ได้จริง — ยอมรับตรงๆ

ลูกค้า self-host ถือโค้ด flip flag เองได้ · entitlement กันได้แค่ "ลูกค้าสุจริตที่ไม่อยากยุ่ง"
→ ถ้าจะขาย self-host แบบจำกัดฟีเจอร์จริงต้อง license key + signed entitlement (ยังไม่ทำ) ·
ตอนนี้ขาย self-host เป็น **trust + support** ไม่ใช่ technical lock

## ทางเลือกที่ไม่เลือก

- **flag รายฟีเจอร์ (45 ตัว)** — ตรงกับใบเสนอราคาเป๊ะ แต่ combination ระเบิด เทสต์ไม่ได้จริง
- **fork/branch ต่อลูกค้า** — merge hell ตั้งแต่ลูกค้าคนที่ 2
- **build-time flag (tree-shake)** — ได้ binary เล็กและกัน self-host ได้จริง แต่ต้อง build ต่อลูกค้า
  ขัดกับ multi-tenant deployment เดียวที่เป็นจุดขาย
- **แทนที่ `workspace_bot_config` ด้วย entitlements เลย** — ต้องแก้ bot consumer + test + seed ที่เขียวแล้ว
  ได้ไม่คุ้มเสีย ทำ additive ก่อน ค่อยยุบทีหลังถ้าซ้ำซ้อนจริง

## ผลที่ตามมา

- ✅ เพิ่มฟีเจอร์ใหม่ = เขียน + ผูก 1 โมดูล → ขายได้ทันที ไม่ต้องรื้อ
- ✅ ลูกค้าจ่ายเพิ่ม = update 1 row (อนาคตมี admin UI)
- ⚠️ **หนี้ flag**: ทุก flag คือ branch — ต้องมีวินัย **ลบ flag ทิ้งเมื่อฟีเจอร์กลายเป็น core** (ทุกคนได้)
- ⚠️ ต้องมี test ครอบทั้งสองทาง (มีสิทธิ์ / ไม่มีสิทธิ์) ทุกจุดที่ gate
- ⚠️ seed/dev ต้องเปิดครบ ไม่งั้น dev เจอฟีเจอร์หายแล้วงง
