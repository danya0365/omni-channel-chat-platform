# OmniChat — Quotation Builder 💬

เครื่องมือ **การตลาด/ขาย** ของโปรเจค omni-channel chat platform — ให้ลูกค้าเลือกฟีเจอร์เองแล้วระบบคำนวณราคาให้ทันที
พร้อมออกเอกสาร: **ใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จ** (พิมพ์ A4 ได้)

> ⚠️ แอปนี้ **แยกเดี่ยวจาก monorepo** (ไม่อยู่ใน pnpm workspace, ไม่อยู่ใน `pnpm gate`)
> มี `node_modules` / lockfile ของตัวเอง — เป็นเครื่องมือ go-to-market ไม่ใช่ส่วนของ product

## รัน

```bash
cd apps/billing
npm run dev      # → http://localhost:3000
```

## โมเดลราคา

แยก 2 ก้อน:

| ก้อน                       | คิดยังไง                                       | ส่วนลด / VAT           |
| -------------------------- | ---------------------------------------------- | ---------------------- |
| **ค่าติดตั้ง** (ครั้งเดียว) | base ของประเภทธุรกิจ + `price` ของฟีเจอร์ที่เลือก | มีส่วนลด + VAT ตามตัวเลือก |
| **ค่าบริการรายเดือน**       | base รายเดือน + `monthlyPrice` ของฟีเจอร์/platform | ไม่มีส่วนลด            |

## แก้ตรงไหน

| อยากแก้                              | ไฟล์                                                          |
| ------------------------------------ | ------------------------------------------------------------- |
| ★ ฟีเจอร์ / ราคา / แพ็กเกจ / ประเภทธุรกิจ | `src/data/mock/mockFeatures.ts`                               |
| ชื่อบริษัท, บัญชีธนาคาร, PromptPay    | `src/config/company.config.ts`                                |
| VAT, อายุใบเสนอราคา, เงื่อนไข         | `src/config/quotation.config.ts`                              |
| copy หน้า landing                     | `src/presentation/components/home/HomeView.tsx`               |
| การคำนวณราคา / state                  | `src/presentation/store/quotationStore.ts`                    |

## หน้าเว็บ

`/` landing · `/builder` เลือกฟีเจอร์ · `/quote` ใบเสนอราคา · `/invoice` ใบแจ้งหนี้ · `/receipt` ใบเสร็จ ·
`/about` `/contact` `/terms` `/privacy`

state เก็บใน **localStorage** (key `omnichat-quotation-storage`) — ยังไม่มี backend
