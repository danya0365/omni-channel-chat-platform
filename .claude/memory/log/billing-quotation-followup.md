---
name: billing-quotation-followup
description: 'Handoff งานถัดไป — แก้ apps/billing เรื่องใบเสนอราคา. รวมสภาพปัจจุบัน (flow/state/ราคา), บั๊กที่เจอแล้วยังไม่แก้ (เลขที่เอกสารสุ่มใหม่ทุก refresh = ตามงานไม่ได้), หนี้ lint 11 errors, ข้อจำกัด localStorage ไม่มี backend/ประวัติ. อ่านตอนจะเริ่มงาน billing/ใบเสนอราคา/ใบแจ้งหนี้/ใบเสร็จ'
metadata:
  node_type: memory
  type: log
  status: active
  scope: billing
  updated: 2026-07-21
  originSessionId: 562a0eaf-313c-415a-90f3-085482fa5177
  modified: 2026-07-21T07:23:38.891Z
---

# Handoff — งานถัดไป: `apps/billing` เรื่องใบเสนอราคา

> **สถานะ: ตั้งต้น ยังไม่เริ่มลงมือ** (2026-07-21) — พี่สั่งพักงาน marketing แล้วมาต่องานนี้ · คุยต่อ session ใหม่
> อ่านคู่: [[marketing-page-brief]] · [[adr-0008-icp-and-positioning]] · README ที่ `apps/billing/README.md`

---

## 1. สภาพปัจจุบัน (ต้องรู้ก่อนแตะ)

**`apps/billing` = Next app แยกเดี่ยว** — อยู่ **นอก** pnpm workspace และ **นอก `pnpm gate`** (ตั้งใจ:
เป็นเครื่องมือ go-to-market ไม่ใช่ product) · มี `node_modules`/lockfile ของตัวเอง (npm ไม่ใช่ pnpm)

```bash
cd apps/billing && npm run dev     # → :3000
npm run build                       # ✅ เขียว
npm run lint                        # ❌ แดง 11 errors (หนี้เดิม — ดูข้อ 3)
```

**Flow:** `/` landing → `/builder` ติ๊กฟีเจอร์ → `/quote` ใบเสนอราคา → `/invoice` ใบแจ้งหนี้ → `/receipt` ใบเสร็จ
(ทุกใบพิมพ์ A4 ได้ผ่าน `react-to-print`)

**State:** Zustand + persist ลง **localStorage key เดียว** (`omnichat-quotation-storage`) · **ไม่มี backend**

**ราคา:** setup (ครั้งเดียว) + รายเดือน แยกก้อนกัน · ตัวคูณ "รูปแบบการจ้าง" 4 แบบ (solo+AI ×1.0 → บริษัท ×2.6) ·
ช่องทางแชท = loss leader (ลด 30% ตั้งแต่ตัวที่ 2 · เพดานรวม ฿10,000)

| อยากแก้                       | ไฟล์                                                            |
| ----------------------------- | --------------------------------------------------------------- |
| ★ ฟีเจอร์/ราคา/ประเภทธุรกิจ   | `src/data/mock/mockFeatures.ts` (1,618 บรรทัด)                  |
| การคำนวณ/state                | `src/presentation/store/quotationStore.ts`                      |
| VAT, อายุใบเสนอราคา, เงื่อนไข | `src/config/quotation.config.ts`                                |
| ชื่อบริษัท/บัญชี/PromptPay    | `src/config/company.config.ts`                                  |
| เลขที่เอกสาร + วันที่         | `src/presentation/hooks/use{Quote,Invoice,Receipt}Presenter.ts` |

---

## 2. 🔴 บั๊กที่เจอแล้ว **ยังไม่ได้แก้** — เลขที่เอกสารสุ่มใหม่ทุก refresh

[useQuotePresenter.ts:58-62](../../../apps/billing/src/presentation/hooks/useQuotePresenter.ts) (และ
`useInvoicePresenter.ts:51`, `useReceiptPresenter.ts:51` แบบเดียวกัน):

```ts
const quoteNumber = useMemo(() => {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${DOCUMENT_PREFIXES.quote}-${now.format('YYYYMMDD')}-${random}`;
}, []); // ← deps ว่าง แต่ Math.random() ทำให้ได้เลขใหม่ทุก mount
```

**ทำไมเป็นปัญหาธุรกิจ ไม่ใช่แค่ lint:** ลูกค้าเปิดหน้าใบเสนอราคาได้ `QT-20260721-A3F9` →
กด refresh → กลายเป็น `QT-20260721-B7C2` → **เอกสารที่ส่งลูกค้ากับที่เราเห็นคนละเลข** →
อ้างอิงข้ามใบ (เสนอราคา → แจ้งหนี้ → ใบเสร็จ) ไม่ได้ · ตามงาน/ทวงเงินไม่ได้ · ออกใบซ้ำเลขชนกันได้

**ทางแก้ที่ควรพิจารณา (ยังไม่เคาะ):** เก็บเลขที่เอกสารเข้า store (persist) ตอน "สร้างใบ" ครั้งแรก
แทนการ generate ตอน render · เลขต้อง **running per วัน/ปี** ไม่ใช่สุ่ม (เลขสุ่มชนกันได้จริงที่ 4 หลัก base36)
→ ถ้าจะให้ไม่ชนจริงต้องมี backend หรืออย่างน้อย counter ใน localStorage

## 3. หนี้ `npm run lint` — 11 errors (มีมาก่อนงาน marketing)

ยืนยันด้วยการ stash เทียบแล้ว: **13 problems เท่ากันทั้งก่อนและหลัง** งาน landing ไม่ได้ทำให้แย่ลง

| ไฟล์                                                    | เรื่อง                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| `use{Quote,Invoice,Receipt}Presenter.ts`                | `react-hooks/purity` — `Math.random()` ตอน render (= ข้อ 2) |
| `CrystalBubble.tsx` (6 จุด)                             | impure ตอน render                                           |
| `ThemeToggle.tsx`, `SummaryPanel.tsx`, `MainHeader.tsx` | เบ็ดเตล็ด                                                   |

> 💡 แก้ข้อ 2 ให้ถูกทาง = ปลด lint error ไป 3 ตัวพร้อมกัน (สาเหตุเดียวกัน)
> ⚠️ app นี้อยู่นอก `pnpm gate` → ไม่มีใครจับ หนี้เลยสะสมเงียบๆ · **ควรตัดสินใจว่าจะดึงเข้า gate ไหม**

## 4. ข้อจำกัดเชิงโครงสร้าง (ถ้าพี่จะขยายงานใบเสนอราคา)

- **ไม่มีประวัติใบเสนอราคา** — localStorage key เดียว = ออกใบใหม่ **ทับใบเก่า** ย้อนดูของเดิมไม่ได้
- **ข้ามเครื่อง/เบราว์เซอร์ไม่ได้** — ลูกค้าติ๊กบนมือถือ เราเปิดบนคอมไม่เห็น · เคลียร์ browser = หาย
- **ไม่มีสถานะเอกสาร** (ร่าง/ส่งแล้ว/ตอบรับ/ชำระแล้ว) → ตามงานขายไม่ได้
- **ไม่รู้ว่าใครเข้ามาติ๊กอะไร** — landing มี CTA "ขอเดโม" ชี้ `/contact` แต่ปลายทางยังไม่ส่งไปไหน = **lead ตกพื้น**
  (ตรงกับที่ค้างใน [[marketing-page-brief]])

→ ทั้งหมดนี้ชี้ไปทางเดียวกัน: **ถ้าจะเอาจริง ต้องมี backend เก็บ quotation** (จะ reuse Postgres
ของ product หรือแยก ยังไม่เคาะ) · ถ้าไม่เอาจริง ก็ต้องยอมรับว่าเป็นเครื่องมือคิดเลขเฉยๆ

## 5. เริ่มตรงไหนดี (ข้อเสนอ Iris — พี่เคาะได้)

1. **ถามพี่ก่อนว่า "แก้เรื่องใบเสนอราคา" คือแก้อะไร** — พี่ยังไม่ได้ระบุ อย่าเดาแล้วลุย
2. ถ้าไม่มีโจทย์เฉพาะ → เสนอเริ่มที่ **ข้อ 2 (เลขที่เอกสาร)** เพราะเป็นบั๊กที่ทำให้เอกสารใช้งานจริงไม่ได้
   และปลดหนี้ lint ไปด้วย
3. งานที่ใหญ่กว่า (backend/ประวัติ/สถานะเอกสาร) → **ต้องเปิด ADR ก่อน** (`/new-adr`) เพราะกระทบสถาปัตยกรรม
