---
name: phase-4-progress
description: 'สถานะ Phase 4 (routing/assignment + LINE channel) — sub-phase A (routing) เสร็จ+verify แล้ว · sub-phase B (LINE) ยังไม่เริ่ม. อ่านตอนเปิด session เพื่อทำ LINE channel ต่อ'
metadata:
  node_type: memory
  type: log
  status: active
  scope: global
  updated: 2026-07-19
  originSessionId: c95243e8-0ef0-4fc2-b3aa-cfd6f5dd01c6
---

# Handoff — Phase 4 กำลังทำ (routing + LINE channel)

> อ่านไฟล์นี้ + [[project-overview]] + [[adr-0004-phase-4-routing-and-line-channel]] แล้วทำต่อได้ทันที
> phase-3-progress = Phase 3 จบแล้ว (agent inbox realtime + auth)

## สถานะ (2026-07-19)

- branch **`feature/phase-4-routing-line`** (แยกจาก PR Phase 1-3 ที่ `feature/phase-1-stack-skeleton`)
  - remote: `git@github.com:danya0365/omni-channel-chat-platform.git` · push แล้ว
- **sub-phase A (routing/assignment) เสร็จ + verify ครบ** · **sub-phase B (LINE channel) ยังไม่เริ่ม** ← ต่อตรงนี้
- gate เขียว **102 unit** + integration **20** · inbox build ผ่าน

## ✅ Sub-phase A — Routing/Assignment (เสร็จ)

**domain**: `services/manage-conversation.ts` = `createManageConversation` (assign/unassign/close/reopen)
→ หา conversation (scope ws) → repo update → publish `conversation.updated` event · คืน Result
· ports: `ConversationRepository.setAssignee/setStatus` + `InboxReadRepository.getConversationListItem`
· event `conversation.updated` เพิ่มใน domainEventSchema

**db**: conversation-repo `setAssignee`/`setStatus` · inbox-read-repo `getConversationListItem`

**api**: routes `POST /inbox/conversations/:id/{assign,unassign,close,reopen}` (authed, agentId จาก token)
คืน patch `{conversation:{id,status,assignee}}` · wiring `manageConversation` (tx + outbox + triggerDrain)
· **outbox-consumer branch ตาม event type**: `conversation.updated` → getConversation → push
`{type:'conversation', conversation}` เข้า agent WS (ต่างจาก message event ที่ push `{type:'message'}`)
· `realtime/agent-events.ts` เพิ่ม `AgentConversationEvent` + `toAgentConversationEvent`

**inbox UI**: Inbox.tsx เพิ่ม — WS handler branch message/conversation · **filter tabs** (all/mine/unassigned, client-side)
· **assignee badge** (ของฉัน/มอบหมายแล้ว/ยังไม่รับ/ปิดแล้ว) · **ปุ่ม header** รับเรื่อง/คืนสาย + ปิดสาย/เปิดใหม่ (optimistic + WS sync)
· api.ts เพิ่ม assign/unassign/close/reopenConversation · types เพิ่ม Assignee/ConversationPatch/AgentConversationEvent

**verify**: gate 102 + integration `inbox-realtime` (+1: assign→agent WS conversation event · close→DB) +
`phase4-routing.integration` (setAssignee/setStatus/getConversationListItem) · **browser: ปุ่ม+badge+filter+2-tab realtime sync** (พี่คลิกยืนยัน)

## ⭐ ต่อไป — Sub-phase B: LINE channel (ยังไม่เริ่ม)

**ตัดสินใจไว้แล้ว (ADR-0004):** LINE creds เก็บ **DB ต่อ channel แบบ encrypted (AES-256-GCM, key จาก env `CHANNEL_ENCRYPTION_KEY`)** ·
outbound ใช้ **LINE push API** (ไม่ใช่ reply token) · ⚠️ **LINE verify จริงในนี้ไม่ได้** (ไม่มี public URL/bot) → **contract test ด้วย fixture เท่านั้น** (ห้ามเคลม verify จริง)

- **B1 db**: `channelType` enum เพิ่ม `'line'` + ตาราง `channel_credentials` (encrypted) + crypto util (encrypt/decrypt) + migration
- **B2 `@omni/channel-line`**: signature verify (x-line-signature = HMAC-SHA256 ของ raw body), inbound (LINE event→IngestInboundCommand), outbound gateway (unified→LINE push API) — โครงลอก `channel-web`
- **B3 api**: `POST /channels/line/:channelId/webhook` (ต้อง **raw body** — custom content-type parser ของ Fastify) + `/new-channel line` (slash command) + contract test ด้วย fixture payload จาก LINE docs

## วิธีรัน (routing demo — verify แล้ว)

```bash
pnpm db:up && pnpm --filter @omni/api seed:dev   # agent@demo.local / demo1234
pnpm --filter @omni/api dev                       # :3001
pnpm --filter @omni/inbox exec next dev -p 3002   # :3002 (⚠️ ถ้า dev เจอ 404 ให้ลบ apps/inbox/.next ก่อน — stale prod build ชน)
pnpm --filter @omni/widget dev                    # :5173 หรือ 5174 (vite เลือกเอง)
```

widget พิมพ์ → inbox เห็นสาย → คลิก → รับเรื่อง/ปิดสาย · เปิด inbox 2 แท็บ = เห็น sync realtime

## Gotchas Phase 4

- **inbox next dev 404 ที่ /** = `.next` เดิมจาก `next build` (prod) ชน dev → `rm -rf apps/inbox/.next` แล้ว restart
- มี stale `next-server` บน :3000 (ไม่ใช่ของ session นี้ — ไม่แตะ) · ใช้ 3002 สำหรับ inbox
- outbox-consumer แยก 2 event: message (getMessage) vs conversation.updated (getConversation) — เพิ่ม event ใหม่ต้องอัปเดต consumer
- reply ยังคง route เดิม `/inbox/conversations/:id/reply` (sender=agent) — assign/close เป็น routes แยก
