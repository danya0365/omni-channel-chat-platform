---
name: adr-0003-phase-3-inbox-realtime-auth
description: 'ADR-0003 — Phase 3: agent inbox realtime ด้วย transactional outbox + pg-boss (เปิด seam จาก ADR-0002) + auth ขั้นต่ำแบบ signed-session (อ่านเมื่อทำ Phase 3 หรือสงสัยเรื่อง queue/outbox/auth ของ inbox)'
metadata:
  node_type: memory
  type: decision
  status: active
  scope: global
  updated: 2026-07-19
  originSessionId: c95243e8-0ef0-4fc2-b3aa-cfd6f5dd01c6
---

# ADR-0003 — Phase 3: Agent Inbox Realtime + Minimal Auth

## บริบท

Phase 2 ทำ web channel end-to-end ฝั่งลูกค้าเสร็จ (widget → persist → outbound realtime กลับ widget)
โดย `EventBus` ใน composition root ยังเป็น **no-op** (`apps/api/src/wiring.ts`) — เป็น seam ที่
[[adr-0002-stack-and-repo-layout]] ตั้งใจไว้ ("queue defer → outbox + pg-boss ค่อยเสียบ")

Phase 3 ต้องการ **agent inbox**: ทีมงาน login → เห็น conversation ที่ลูกค้าทักเข้ามา **แบบ realtime**
→ ตอบกลับ (ด้วย agentId จริง ไม่ใช่ `bot` ปลอม) → เด้งกลับ widget. ต้องเคาะ 2 เรื่องใหญ่:
**(1) realtime ฝั่ง agent ต่อ EventBus seam ยังไง · (2) auth ขั้นต่ำแบบไหน**

## การตัดสินใจ

### 1. Realtime = transactional outbox + pg-boss (เปิด seam จาก ADR-0002)

- **`EventBus.publish` เขียน `DomainEvent` ลงตาราง `outbox`** ใน **transaction เดียวกับ business write**
  (ingest inbound / send outbound) → event ไม่มีทางหายแม้ crash หลัง commit (transactional outbox pattern)
- **pg-boss** (queue บน Postgres — ไม่เพิ่ม infra ใหม่) เป็น relay/worker: อ่าน outbox ที่ยังไม่ processed →
  dispatch → **consumer fan-out เข้า agent WS registry** → mark outbox row processed
- **agent WS registry key = `workspaceId`** (agent subscribe ทุก conversation ใน workspace ตัวเอง) —
  แยกจาก web-session registry เดิม (key = session ของลูกค้า) · fan-out scope ด้วย workspace เสมอ (multi-tenant)
- reply ของ agent ก็ publish event เช่นกัน → agent คนอื่นใน workspace เห็น sync (optimistic + reconcile)

### 2. Auth = minimal signed-session

- ตาราง **`agents`** (`agt_` id, `workspaceId`, `email` unique/workspace, `passwordHash`, `displayName`)
- **`POST /auth/login`** (email + password → verify hash → ออก **signed session token** = JWT
  ฝัง `{workspaceId, agentId}`, อายุสั้น) · secret ลงนามอยู่ **env เท่านั้น** (`AUTH_SESSION_SECRET`)
- **middleware guard** inbox API (`/inbox/*`) + agent WS → verify token → inject `{workspaceId, agentId}`
  เข้า request context (route ไม่ต้องรับ workspaceId จาก client — กัน spoof ข้าม tenant)
- **reply endpoint ต้อง authed** → `sender = {kind:'agent', agentId}` จริง (เดิม demo เปิดโล่ง = `bot`)

### 3. Inbox ↔ api = REST + WS (ไม่แตะ DB ตรง)

- `GET /inbox/conversations` (list ใน workspace: last message preview + contact + status, cursor by `last_message_at`)
- `GET /inbox/conversations/:id/messages` (history, cursor)
- `POST /inbox/conversations/:id/reply` (authed → sendOutbound ด้วย agentId)
- agent WS: `GET /inbox/ws` (authed) → รับ event realtime (message ใหม่ / reply)

## เหตุผล

- **outbox + pg-boss ตั้งแต่แรก** (พี่เลือก) — durable กว่า in-process, ไม่เพิ่ม infra (queue บน Postgres เดิม),
  และ ADR-0002 วาง seam ไว้แล้ว → เปิดใช้ตอนนี้ต้นทุนต่ำ ดีกว่ามารื้อตอนมี traffic
- **signed-session (ไม่ OIDC)** — "auth ขั้นต่ำ" ตาม roadmap · พอให้ flow ครบ + ปลอดภัยระดับ dev/MVP
  โดยไม่ดึงเวลาจาก core ของ inbox · Auth.js/OIDC provider จริงเลื่อนไป Phase 4+
- **JWT ฝัง workspaceId** — route/WS ได้ tenant context จาก token ไม่ใช่จาก client → กัน cross-tenant โดยดีไซน์

## ผลที่ตามมา / ข้อควรระวัง

- ⚠️ **pg-boss = work-queue ไม่ใช่ pub/sub** — job ตกที่ worker ตัวเดียว. WS socket ที่กระจายหลาย instance
  ต้องมี pub/sub (pg `LISTEN/NOTIFY` หรือ Redis) เพิ่มทีหลัง · **Phase 3 รัน consumer in-process =
  single-instance realtime** (พอสำหรับ MVP · scale หลาย instance = decision แยกทีหลัง)
- ⚠️ ต้องมี **DB migration ใหม่** 2 ตาราง (`outbox`, `agents`) + pg-boss สร้าง schema ของมันเอง (`pgboss`)
- ⚠️ `outbox` เขียนใน tx เดียวกับ business write → repository/service ที่ publish ต้องรับ tx context
  (ปรับ `EventBus` impl ให้ join tx ปัจจุบัน ไม่ใช่ connection แยก)
- ⚠️ **PII**: event ใน outbox/pg-boss มี content ข้อความลูกค้า — อยู่ใน DB ของเราเอง (ยอมรับได้) แต่
  **ห้าม log payload เต็ม** ตอน consumer ทำงาน (log แค่ id/type)
- ⚠️ `AUTH_SESSION_SECRET` = secret → env เท่านั้น, ห้าม commit · dev seed agent ใช้รหัสสมมติ
- pg-boss เพิ่ม dependency ใน `@omni/db` (หรือ layer แยก) — worker lifecycle (start/stop) ผูกกับ api process

## ขอบเขต (ไม่รวมใน Phase 3)

routing/assignment อัตโนมัติ (Phase 4) · OIDC/refresh token/RBAC · multi-instance WS fan-out ·
media/attachment storage · bot/AI reply (Phase 5)
