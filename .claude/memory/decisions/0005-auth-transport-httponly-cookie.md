---
name: adr-0005-auth-transport-httponly-cookie
description: 'ADR-0005 — auth transport ย้ายจาก localStorage token (Bearer/?token=) → httpOnly cookie (Secure, SameSite=Strict) + CSRF Origin check + CORS credentials + WS cookie. อ่านเมื่อแตะ auth / session / CORS / เริ่ม server-first RSC'
metadata:
  node_type: memory
  type: decision
  status: active
  scope: global
  updated: 2026-07-20
  originSessionId: 46ba0ab4-fb53-4b26-a045-19ba5c8332f1
---

# ADR-0005 — Auth transport: httpOnly cookie (SameSite=Strict + Origin check)

## บริบท

auth เดิม (Phase 3, [[adr-0003-phase-3-inbox-realtime-auth]]) = signed-session token เก็บใน **localStorage**
ส่งเป็น `Authorization: Bearer` (HTTP) และ `?token=` (WS). ปัญหา:

- **localStorage เข้าถึงได้จาก JS** → ถ้ามี XSS ขโมย token ได้ทันที
- **token ใน URL ของ WS** อาจติด log ของ proxy/reverse-proxy
- **บล็อก server-first RSC** ([[frontend-architecture-standard]]) — RSC (server component) อ่าน localStorage ไม่ได้
  → ต้อง client-fetch ทุกอย่าง (ขัดนโยบาย server-first data-fetching)

## การตัดสินใจ

### 1. auth transport = **httpOnly cookie**

- login → `Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=ttl`
- `httpOnly` = JS อ่านไม่ได้ (กัน XSS ขโมย) · token ออกจาก localStorage
- verify: อ่าน token จาก cookie เป็นหลัก (`@fastify/cookie`)

### 2. CSRF = **SameSite=Strict + Origin allowlist check** (เลือกโดยพี่)

- `SameSite=Strict` = cookie **ไม่ถูกส่ง cross-site** → cross-site forge ยิงมาก็ไม่มี auth
- **Origin check** บน state-changing route (reply + assign/unassign/close/reopen) = defense-in-depth:
  มี Origin header + ไม่อยู่ `ALLOWED_ORIGINS` → 403 · ไม่มี Origin (server-to-server) หรือ allowlist ว่าง → ผ่าน
- (ไม่เลือก CSRF token / custom-header — SameSite=Strict robust พอสำหรับ internal same-site SPA)

### 3. CORS = `credentials: true` + reflect origin

- credentials:true ให้ browser แนบ cookie ข้าม origin (inbox ↔ api คนละ port) · origin reflect (ไม่ใช่ `*`)
- widget (ฝังเว็บไหนก็ได้) ไม่ใช้ cookie → ไม่กระทบ · CSRF จริงกันด้วย SameSite=Strict ไม่ใช่ CORS

### 4. WS auth ผ่าน cookie

- browser แนบ cookie ให้ WS handshake อัตโนมัติ (same-site) → verify จาก cookie · `?token=` = fallback

### 5. frontend เลิกถือ token

- ไม่เก็บ token ใน localStorage · รู้สถานะ login จาก **`GET /auth/me`** (cookie valid → 200) ตอน bootstrap
- ทุก fetch/WS ใช้ `credentials: 'include'` · logout → `POST /auth/logout` (clear cookie)

### 6. fallback ระหว่าง migrate

- backend ยังรับ `Authorization: Bearer` + คืน token ใน login body (server-to-server / test / ระหว่างสลับ frontend)
- ปิด fallback ทีหลังเมื่อ frontend ใช้ cookie เต็ม + integration test ปรับเป็น cookie

## เหตุผล

- httpOnly = กัน XSS ขโมย token (ข้อได้เปรียบหลัก) · ปลด server-first RSC
- SameSite=Strict = กัน CSRF แบบเรียบง่าย robust สำหรับ agent tool ภายใน (ไม่ต้องมี CSRF token infra)
- Origin check = ต้นทุนต่ำ (อ่าน header) เสริมชั้นสอง

## ผลที่ตามมา / ข้อควรระวัง

- ⚠️ **deploy ต้อง same-site** — app + api ต้องเป็น subdomain ของ registrable domain เดียวกัน (เช่น
  `app.example.com` + `api.example.com`) ไม่งั้น SameSite=Strict ไม่ส่ง cookie → auth พัง
- ⚠️ `Secure` cookie ต้อง HTTPS · dev http localhost Chromium ยอมส่ง (ตั้ง `COOKIE_SECURE=false` ได้)
- ⚠️ `ALLOWED_ORIGINS` prod ต้องตั้ง (ว่าง = Origin check ปิด — dev/test fallback)
- ⚠️ SameSite=Strict: click ลิงก์จากภายนอกเข้า app ครั้งแรก cookie ไม่ส่ง (ต้อง nav ภายใน app) — internal tool รับได้
- token ยัง **stateless** (revocation/refresh ยังไม่มี — เหมือน Phase 3) · logout ล้างแค่ฝั่ง client cookie

## ขอบเขต (ไม่รวม ADR นี้)

token revocation / refresh token · CSRF double-submit token · OIDC/Auth.js · rate-limit login ·
cookie rotation — ไว้ทำเมื่อยกระดับ auth จริง
