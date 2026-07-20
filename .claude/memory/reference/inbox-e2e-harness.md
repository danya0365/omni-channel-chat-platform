---
name: inbox-e2e-harness
description: Playwright e2e harness ของ agent inbox — วิธี verify browser จริง (headless) หลังแตะ frontend. อ่านเมื่อต้อง verify หน้า inbox บนเบราว์เซอร์ หรือเพิ่ม e2e case
metadata:
  node_type: memory
  type: reference
  status: active
  scope: inbox
  updated: 2026-07-19
  originSessionId: 46ba0ab4-fb53-4b26-a045-19ba5c8332f1
---

# Inbox e2e harness (Playwright)

โปรเจคมี **Playwright e2e headless** สำหรับ verify browser ของ agent inbox แล้ว (เพิ่ม Phase 4) —
ใช้เป็น **วิธีมาตรฐานปิด DoD ข้อ 3 (verify บน real-flow) ของ frontend** แทนการคลิกมือ

## รันยังไง

```bash
pnpm db:up                          # ต้องมี Postgres ก่อน
pnpm --filter @omni/inbox e2e       # = playwright test
```

- **spin up stack เอง** (ไม่ต้อง start server มือ): `playwright.config.ts` มี webServer 2 ตัว —
  api (`PORT=4001`, seed ก่อน) + inbox (`next dev -p 4002`, `NEXT_PUBLIC_API_ORIGIN=http://localhost:4001`)
- ใช้ **port 4001/4002** (เลี่ยงชนกับ dev server ที่ค้างบน 3000/3001)
- browser = chromium headless (`pnpm --filter @omni/inbox exec playwright install chromium` ถ้าเครื่องใหม่)

## เทสต์ที่มี (`apps/inbox/e2e/inbox.spec.ts`)

1. **single agent**: login → เห็นสายจาก DB → รับเรื่อง (assign) → ตอบ (reply)
2. **realtime**: inbound ใหม่เด้งเข้า **2 แท็บ** พร้อมกันผ่าน agent WS

inbound สร้างผ่าน web channel endpoint จริง (`chn_web_demo` จาก `seed:dev`) · login = `agent@demo.local`/`demo1234`

## selector สำคัญ (เผื่อเพิ่ม case)

- login: `#login-email`, `#login-password`, ปุ่ม `เข้าสู่ระบบ`
- สายในลิสต์ = `<button>` มี text ข้อความล่าสุด (`getByRole('button').filter({hasText})`)
- header ปุ่ม: `รับเรื่อง`/`คืนสาย` (assign/unassign) · `ปิดสาย`/`เปิดใหม่` (close/reopen)
- reply: input `aria-label="ข้อความตอบ"` + ปุ่ม `ส่ง` · bubble = `<p>` (`getByRole('paragraph')`)

## Gotchas

- ⚠️ ถ้า `next dev` เจอ 404 ที่ `/` → `.next` เดิมจาก `next build` (prod) ชน → config รัน `rm -rf .next` ก่อน dev ให้แล้ว
- artifacts (`test-results/`, `playwright-report/`) gitignore แล้ว
- **ไม่อยู่ใน `pnpm gate`** (e2e ต้อง db:up + spin server) — รันแยกตอนแตะ frontend · gate ยังเป็น lint+typecheck+unit+boundary
