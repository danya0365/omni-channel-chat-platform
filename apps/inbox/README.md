# @omni/inbox

Agent inbox (Next.js App Router) ของ Omni-Channel Chat Platform — หน้าจอให้ทีมงานเห็นทุกแชทจากทุกช่องทางรวมกันแล้วตอบกลับได้

> **สถานะ:** foundation (Next 16 + Tailwind v4) — UI จริง (conversation list + reply + realtime) จะทำใน **Phase 3**

## รันในโหมด dev

รันจาก **ราก monorepo** (pnpm workspaces) — อย่ารัน npm/yarn ในโฟลเดอร์นี้ตรงๆ

```bash
pnpm install                        # ครั้งแรก/หลัง lockfile เปลี่ยน (จากราก)
pnpm --filter @omni/inbox dev       # เปิด http://localhost:3000
# หรือรันทุก app ขนาน:
pnpm dev
```

## ขอบเขต (ดู [.claude/rules/frontend-next.md](../../.claude/rules/frontend-next.md))

- **UI ล้วน** — คุย backend ผ่าน `apps/api` (HTTP + WebSocket) เท่านั้น **ห้ามต่อ DB ตรง**
- แชร์ type จาก `@omni/domain` ด้วย `import type` (unified schema ตัวเดียวทั้ง stack)
- secret ไม่หลุดเข้า client bundle — เฉพาะ `NEXT_PUBLIC_*` เท่านั้นที่ถึง browser
- default เป็น Server Component · ใส่ `'use client'` เฉพาะส่วน interactive (reply box, realtime list)

## Gate

```bash
pnpm gate                           # lint + typecheck + test + boundaries (จากราก)
pnpm --filter @omni/inbox build     # next build
```

> `typecheck` รัน `next typegen && tsc --noEmit` — typegen สร้าง route types ให้ `tsc` ทำงานได้โดยไม่ต้อง full build
