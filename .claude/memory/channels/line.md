---
name: line
description: spec ช่องทาง LINE (Messaging API) — inbound webhook (HMAC verify) + outbound push · credential encrypted ใน DB. อ่านเมื่อแก้/ดีบัก LINE channel หรือทำ channel อื่นเทียบเคียง
metadata:
  node_type: memory
  type: channel
  status: active
  scope: line
  updated: 2026-07-19
  originSessionId: 46ba0ab4-fb53-4b26-a045-19ba5c8332f1
---

# Channel Spec — LINE (Messaging API)

> implement แล้วใน Phase 4 sub-phase B · ตัดสินใจใน [[adr-0004-phase-4-routing-and-line-channel]] · สถานะ [[phase-4-progress]]
> adapter = `@omni/channel-line` (โครงลอก `@omni/channel-web`) · route = `apps/api/src/routes/line.ts`

## ผู้ให้บริการ & API

- **เจ้าของ**: LINE (LY Corporation) — **LINE Messaging API**
- **docs**: developers.line.biz/en/reference/messaging-api · console: developers.line.biz (Provider → Channel)
- **base URL**: `https://api.line.me`
- **rate limit / quota**: push/reply มี quota ต่อเดือน (แผน OA) + rate limit ต่อวินาที — **MVP ยังไม่ทำ retry/backoff** (log fail ไว้ก่อน)

## Inbound (webhook)

- **endpoint**: `POST /channels/line/:channelId/webhook` (`channelId` = public id ใน URL → resolve workspace)
- **verify signature**: header `x-line-signature` = **base64(HMAC-SHA256(channelSecret, rawBody))**
  - ⚠️ ต้องใช้ **raw body** (byte ก่อน parse JSON) — Fastify เก็บ raw ด้วย content-type parser `parseAs:'buffer'`
    ใน **plugin ย่อย encapsulated** (ไม่กระทบ JSON parser ของ route อื่น) · เทียบแบบ timing-safe (`verifyLineSignature`)
  - verify ไม่ผ่าน → **401** · ไม่มี credential ตั้งไว้ → **401 channel_not_configured** · ไม่ใช่ line channel → **404**
- **event types** (body = `{ destination, events: [...] }`):
  - รองรับตอนนี้: `message` + `message.type === 'text'` จาก `source.type === 'user'` (ต้องมี `source.userId`)
  - ข้าม (ไม่ ingest, ไม่ error): follow/unfollow/join/postback/sticker/image/... → **MVP text only**
- ตอบ **200 เร็ว** เสมอ (ingest ทีละ event แบบ best-effort · fail ไม่ทำให้ LINE retry รัว)

## Outbound (send)

- ใช้ **LINE push API**: `POST /v2/bot/message/push` (ไม่ใช่ reply token — agent ตอบเมื่อไรก็ได้ ไม่ผูก 30s)
  - header: `Authorization: Bearer <channelAccessToken>` · body: `{ to: <userId>, messages: [{type:'text', text}] }`
  - ปลายทาง `to` = **LINE userId** = `externalId` ของ contact identity (resolve จาก conversation)
  - client = `createLineHttpPushClient` (inject fetch ได้ → test ไม่ยิง network) · non-2xx/throw → `send_failed` (ไม่ throw ต่อ)
- **media/template**: ยังไม่รองรับ (text only) — sticker/image/flex เลื่อนไป Phase 5+
- **dispatch**: `createDispatchOutboundGateway` (apps/api) เลือก web/line ตาม channel type ของ message
  → agent reply สาย LINE จาก inbox เดียวกัน push ออกถูกช่องทาง

## Auth & token

- ต้องใช้ 2 ค่าต่อ channel: **channel access token** (push) + **channel secret** (verify signature)
- เก็บใน DB ตาราง `channel_credentials` (channelId PK) แบบ **encrypted at rest**:
  **AES-256-GCM**, key จาก env **`CHANNEL_ENCRYPTION_KEY`** (32 byte hex/base64) · decrypt เฉพาะใน adapter ตอน verify/send
  - ⚠️ **ห้าม hardcode/log plaintext** · dev มี default key + warning (เหมือน AUTH_SESSION_SECRET) · rotate = ต้อง re-encrypt (ยังไม่ทำ)
  - repo = `createChannelCredentialRepository` (get decrypt / upsert encrypt) · resolver = `createLineCredentialResolver` (validate เป็น `lineCredentialsSchema`)

## Message mapping (LINE ↔ unified schema)

| LINE inbound event              | unified `IngestInboundCommand`                               |
| ------------------------------- | ------------------------------------------------------------ |
| `source.userId`                 | `externalId` (→ contact identity)                            |
| `message.text`                  | `content = { type:'text', text }`                            |
| `message.id`                    | `externalMessageId` (trace/dedup)                            |
| (ไม่มี display name ใน webhook) | `contactName = null` (ต้องเรียก profile API — นอก scope MVP) |

| unified outbound `Message`    | LINE push                                                           |
| ----------------------------- | ------------------------------------------------------------------- |
| `content.text`                | `messages: [{ type:'text', text }]`                                 |
| resolve `externalId` (userId) | `to`                                                                |
| provider payload ดิบ          | เก็บ `messages.raw_payload` (JSONB, seam มีแล้ว) — ไม่รั่วเข้า core |

## ปม technical ที่ต้องระวัง

- **raw body**: HMAC ต้องใช้ byte ดิบ — ถ้า re-serialize จาก object แล้ว hash ไม่ตรง (จุดพลาดคลาสสิก)
- **dedup**: LINE อาจส่งซ้ำ (`deliveryContext.isRedelivery`) — MVP ยังไม่ dedup ด้วย `webhookEventId`/`message.id` (มี externalMessageId เก็บไว้แล้ว ทำทีหลังได้)
- **profile/ชื่อ**: webhook ไม่ให้ชื่อ → contact ขึ้นเป็น null จนกว่าจะเรียก `GET /v2/bot/profile/{userId}` (ยังไม่ทำ)
- **ordering**: events[] ใน 1 request เรียงตามเวลา · แต่ข้าม request ไม่การันตี — MVP ใช้ createdAt ของเราเป็นหลัก
- **verify จริงทำไม่ได้ในเครื่อง**: ไม่มี public URL/bot จริง → พิสูจน์ด้วย contract test (fixture) + integration ที่เซ็น signature เอง
  (`line-webhook.integration.test.ts` ขับ inbound e2e ผ่าน HTTP+Postgres จริง) · **ห้ามเคลมว่า verify กับ LINE จริง**

## Demo (ในเครื่อง)

- `pnpm --filter @omni/api seed:dev` สร้าง `chn_line_demo` + credential (secret=`line-dev-channel-secret`, dev only)
- ยิง webhook ทดสอบ: เซ็น body ด้วย HMAC-SHA256(secret) → POST `/channels/line/chn_line_demo/webhook` (header `x-line-signature`)
- ⚠️ outbound push จะ fail (access token เป็น placeholder — ไม่มี LINE bot จริง) — ทดสอบได้แค่ inbound
