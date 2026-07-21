---
name: marketing-page-brief
description: Brief งานอนาคต — หน้า Marketing/landing ให้ทีม marketing เอาโปรเจคไปขาย + go-to-market kit. รวม features / pain points / ROI / สิ่งที่ทีมต้องมี. อ่านตอนจะเริ่มทำหน้า marketing หรือคิด positioning/pricing
metadata:
  node_type: memory
  type: log
  status: planned
  scope: go-to-market
  updated: 2026-07-19
  originSessionId: 46ba0ab4-fb53-4b26-a045-19ba5c8332f1
  modified: 2026-07-21T05:45:46.971Z
---

# Marketing Page — Brief (ร่าง 2026-07-19 · **active focus ตั้งแต่ 2026-07-20**)

> **สถานะ: ACTIVE — พี่ pivot มาลุยงานนี้ 2026-07-20** (พัก dev Phase 5 ไว้ที่จุด PR-ready ดู [[phase-5-progress]])
> เป้าหมาย: สร้าง **หน้า Marketing/landing** + ชุดขาย (kit) ให้ **ทีม marketing เอาโปรเจคนี้ไปขาย**
> อ่านคู่: [[project-overview]] · [[frontend-architecture-standard]] · [[adr-0004-phase-4-routing-and-line-channel]]
>
> ▶️ **เริ่มที่ section 5 (Next step) — ด่านแรกคือเคาะ section C (ICP + pricing + positioning) ก่อน** เป็น input ของทุกอย่าง

---

## 1. ฟีเจอร์ของโปรเจค (แยก "ของจริงที่ build แล้ว" vs "roadmap" — ห้ามขายเกินจริง)

### ✅ ทำแล้ว/พิสูจน์แล้ว (ขายได้เต็มปาก)

- **Inbox เดียว รวมทุกช่องทาง** — ตอนนี้ต่อจริง **web chat widget + LINE**; architecture (channel adapter + unified schema) พร้อมเสียบ Messenger / IG / WhatsApp / email เพิ่ม
- **Unified message schema** — ทุกช่องทาง map เข้ารูปแบบกลางตัวเดียว → core ไม่ผูกกับ payload ดิบของเจ้าไหน (เพิ่มช่องทางใหม่ = เขียน adapter ตัวเดียว ไม่รื้อระบบ)
- **Realtime** — WebSocket, ข้อความเด้งเข้าทันที · **หลาย agent เห็น sync พร้อมกัน** (พิสูจน์ด้วย e2e 2 แท็บ)
- **Routing / assignment** — รับเรื่อง/คืนสาย/ปิดสาย/เปิดใหม่ · filter (ทั้งหมด/ของฉัน/ยังไม่รับ) · assignee badge → **กันตอบซ้ำ / กันสายตกหล่น**
- **Multi-tenant ตั้งแต่แรก** — แยก workspace ต่อธุรกิจ/แบรนด์ (agency เอาไปรับหลายลูกค้าบน deployment เดียวได้)
- **ประวัติสนทนารวมศูนย์** — thread เต็มต่อ contact
- **ความปลอดภัย/PII** — credential เข้ารหัส at-rest (AES-256-GCM) · verify webhook signature (HMAC) · auth signed-session ผูก workspace · ไม่ log PII plaintext → **จุดขายเรื่อง compliance/ความน่าเชื่อถือ**
- **Widget ฝังเว็บได้** — `<script>` ตัวเดียวแปะหน้าไหนก็ได้
- **Self-host / own-your-data** — ไม่ผูก SaaS ต่างชาติ, ข้อมูลลูกค้าอยู่กับธุรกิจเอง

### ✅ Phase 5–6 — merged main แล้ว (2026-07-21) · เคลมได้เพิ่ม

- **Bot / automation (rule-based)** — keyword `contains` → canned reply / escalate หา human ·
  **✅ merged + verify จริง** (gate + integration + e2e browser) → **เคลมได้เต็มปาก** (พูดตรงว่า rule-based)
- **✅ จอจัดการบอทในระบบ** (Phase 6) — ทีมงานเปิด/ปิดบอท, เพิ่ม/แก้/ลบกติกาเองได้จากหน้า inbox
  (ไม่ต้องเรียก dev) → **เคลมได้แล้ว** (เดิมห้าม เพราะยังต้องแก้ผ่าน seed/DB)
- **✅ เปิดฟีเจอร์ตามแพ็กเกจที่ซื้อ** (Phase 6 entitlements) — ลูกค้าจ่ายเท่าไหร่ได้เท่านั้น
  เปลี่ยนได้ทันทีไม่ต้อง deploy · **จุดขายตรงกับใบเสนอราคาแบบเลือกฟีเจอร์เอง**
- **AI reply (Claude Opus 4.8)** — no_match + opt-in → ถาม AI ช่วยตอบ · **🟡 merged + test (fake fetch)
  แต่ยังไม่เคยยิง API จริงสักครั้ง** → เคลมแบบ **"AI-assisted (beta)"** เท่านั้น

> ⚠️ กฎ DoD (อัปเดต 2026-07-21): bot rule-based + จอจัดการบอท + entitlement = **เคลมได้** ·
> AI reply = **beta** จนกว่าจะยิง Anthropic จริง 1 ครั้ง (item ก ใน [[phase-6-progress]] ตัวเลือก C)

---

## 2. Pain points ที่ระบบเราแก้

- **ข้อความกระจายหลายแอป** (LINE OA / FB Page / IG / เว็บ / อีเมล) → agent สลับแท็บ, ตอบช้า, ตกหล่น → **รวมจอเดียว**
- **ไม่มีประวัติลูกค้ารวม** — ลูกค้าคนเดียวทักหลายช่องทาง = หลายบทสนทนาไม่เชื่อมกัน → **รวมเป็น contact เดียว**
- **ไม่รู้ใครดูแลสายไหน** → ตอบชนกัน/สายตก → **assignment + status ชัด**
- **เพิ่มช่องทาง = เพิ่มเครื่องมือ/login ใหม่ให้ทีมเรียนใหม่** → เราเพิ่มช่องทางโดยจอไม่เปลี่ยน
- **SLA/response time คุมยาก** ตอนงานแตกกระจาย → คิว/routing รวมทำให้วัด+คุมได้
- **เสี่ยงเรื่องข้อมูล/PII** เวลาใช้แอป consumer คุยงานธุรกิจ → ระบบเราออกแบบเข้ารหัส + แยก tenant
- **Agency/หลายแบรนด์** จัดการช่องทางลูกค้าหลายเจ้าในเครื่องมือแยกๆ ยุ่ง → multi-tenant จอเดียว

---

## 3. ประหยัดเงิน / ได้กำไรตรงไหน (selling angles — ตัวเลขจริงต้องอิง ICP ที่เลือก)

**ประหยัด (cost down):**

- **แรงงาน** — จอเดียว ไม่สลับแอป → handle time ต่อสายเร็วขึ้น, agent คนเดิมรับได้มากขึ้น
- **ยุบค่า SaaS หลายตัว** — แทน helpdesk/เครื่องมือแยกต่อช่องทาง ด้วยระบบเดียว
- **Self-host = ไม่จ่ายค่า per-seat ที่บวมตามทีม** — ต้นทุน infra คาดเดาได้
- **(Phase 5) automation ตัดงานซ้ำ** — คำถามซ้ำๆ ให้บอตรับ → agent โฟกัสงานที่มีมูลค่า → scale support โดยไม่เพิ่มหัวแบบเชิงเส้น

**ได้กำไร/รายได้ (revenue up):**

- **ตอบเร็ว/ไม่ตกหล่น → ปิดการขายจาก inbound lead ได้มากขึ้น** (miss message = เสียยอด)
- **First-response ไวขึ้น → CSAT/conversion สูงขึ้น**
- **Agency ขายต่อได้** — deployment เดียวรับหลายลูกค้า (multi-tenant) = โมเดลรายได้ recurring

> 🎯 หมายเหตุ Iris (ตรงๆ): ตัวเลข ROI เป๊ะๆ (เช่น "ลดต้นทุน X%") **ยังใส่ไม่ได้** จนกว่าจะเคาะ **target segment** ก่อน —
> SME ร้านค้า LINE-first, e-commerce, หรือ agency คนละตัวเลขกันหมด. ให้ทำเป็น **ROI framing/calculator** ดีกว่าเคลมเลขลอยๆ

---

## 4. สิ่งที่ต้องมี เพื่อให้ทีม marketing เอาไปขายได้

### A. เนื้อหาหน้าเพจ (page sections)

- Hero: value prop 1 บรรทัด + CTA ("ขอเดโม")
- Problem → Solution
- Feature grid (ไอคอน + คำอธิบายสั้น) — แยก ✅/🔜 ให้ชัด
- "How it works" 3 สเต็ป: เชื่อมช่องทาง → ทีมตอบในจอเดียว → (เร็วๆนี้) automate
- โลโก้ช่องทางที่รองรับ (+ "coming soon")
- **Screenshots / เดโมจริงของ inbox** (ยังไม่มี — ต้องถ่าย)
- ROI/benefits + (ถ้าได้) mini ROI calculator
- Social proof (testimonial/โลโก้ลูกค้า — ยังไม่มี ใส่ placeholder ก่อน)
- Pricing (ต้องเคาะโมเดลก่อน — ดูข้อ C)
- Security/trust (เข้ารหัส, PII, แยก tenant)
- FAQ · CTA/ฟอร์มเก็บ lead / "request demo"

### B. Assets / collateral

- Screenshots + **product tour / วิดีโอเดโม (GIF/คลิปสั้น)** ของ inbox จริง
- ตารางเทียบคู่แข่ง (ดูข้อ C)
- One-pager / pitch deck สำหรับเซลล์คุยลูกค้า
- Brand kit: ชื่อผลิตภัณฑ์, โลโก้, สี — เรามี **semantic theme (multi-theme) ใน inbox** อยู่แล้ว เอามาต่อยอด brand ได้
- Copy: TH เป็นหลัก (+ EN ถ้าจะขายนอก)

### C. Go-to-market decisions ที่ยัง "ต้องเคาะ" (open — อย่าเพิ่งเขียนหน้าเพจก่อนตอบ)

- **Target segment / ICP** — SME LINE-first? e-commerce? agency? B2B? → กำหนดทุกอย่างที่เหลือ
- **Pricing & packaging** — per-seat? per-workspace? self-host license? freemium?
- **คู่แข่งที่จะเทียบ** — respond.io, SleekFlow (แรงในไทย), Zendesk/Intercom (global), Page365/R-Chat (ไทย) → ชูจุดต่าง: self-host/own-data + เปิด adapter เพิ่มช่องทางเอง + ราคาไม่บวมตาม seat
- **จุดยืน (positioning)** — จะชู "omni-channel รวมจอ", "self-host/ข้อมูลอยู่กับคุณ", หรือ "ไทย/LINE-first" เป็นหัวหอก?
- **Lead funnel** — ฟอร์ม lead ไปไหน (CRM/อีเมล/ชีต)?

### D. โน้ต technical ตอนจะ build หน้าเพจ (สำหรับ session อนาคต)

- ทำเป็น **route ใน `apps/inbox` (Next.js)** ได้ (public marketing/landing) หรือแยก app — เคาะตอนเริ่ม
- ต้องตาม [[frontend-architecture-standard]]: **server-first data-fetching, ห้าม God component, ใช้ semantic theme token, ผ่าน eslint gate**
- **Demo environment มีทุนอยู่แล้ว**: `seed:dev` + Playwright e2e harness ([[inbox-e2e-harness]]) spin stack ได้เอง → ใช้เป็นฐานทำ live demo / ถ่าย screenshot ได้
- ถ้ามี decision ใหญ่ (pricing/positioning/แยก app) → เปิด **/new-adr**

---

## 5. Next step (เมื่อพี่พร้อมลุย)

1. เคาะข้อ **C (ICP + pricing + positioning)** ก่อน — เป็น input ของทุกอย่าง
2. ถ่าย screenshot/เดโม inbox จริง (ใช้ e2e harness)
3. ร่าง copy หน้าเพจตาม section ข้อ A
4. Build หน้า (Next.js, ตาม standard) → verify browser (Playwright)
