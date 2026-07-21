import type {
  ConversationRepository,
  InboxReadRepository,
  ManageConversation,
  SendOutboundMessage,
  WorkspaceEntitlementsRepository,
} from '@omni/domain';
import {
  createBotRuleRepository,
  createOutboxCursorStore,
  createWorkspaceBotConfigRepository,
} from '@omni/db';
import type { DbHandle } from '@omni/db';
import { createAnthropicBotReplier } from '@omni/bot-anthropic';
import type { AnthropicFetch } from '@omni/bot-anthropic';
import { createBotConsumer } from './bot-consumer';

export interface BotConsumerWiring {
  handle: DbHandle;
  conversations: ConversationRepository;
  inboxRead: InboxReadRepository;
  /** สิทธิ์ที่ workspace ซื้อไว้ (Phase 6) — gate โมดูล `bot`/`ai` ที่ฝั่ง server */
  entitlements: WorkspaceEntitlementsRepository;
  sendOutbound: SendOutboundMessage;
  manageConversation: ManageConversation;
  ai: { apiKey?: string; fetch?: AnthropicFetch };
}

/**
 * ประกอบ bot consumer (Phase 5) — subscribe outbox ด้วย cursor 'bot' (additive · ไม่แตะ agent WS consumer)
 * bot ตอบตาม rules · (5B) rule ไม่ match + มี ANTHROPIC_API_KEY → ถาม AI · reuse sendOutbound/manageConversation
 * (Phase 6) ต้องผ่าน entitlement `bot`/`ai` ด้วย — ซื้อไหม (entitlement) แยกจาก เปิดใช้ไหม (bot config)
 * แยกไฟล์กัน God function/God file ใน wiring.ts (bot repos ผูก pool — อ่านล้วน, write path เปิด tx เอง)
 */
export function buildBotConsumer(w: BotConsumerWiring): () => Promise<number> {
  const cursorStore = createOutboxCursorStore(w.handle.db);
  const botRules = createBotRuleRepository(w.handle.db);
  const botConfig = createWorkspaceBotConfigRepository(w.handle.db);
  // AI fallback สร้างเมื่อมี key เท่านั้น (ต้อง aiEnabled + ซื้อโมดูล ai ต่อ workspace ด้วย) · ไม่มี = rule-only
  const aiReply = w.ai.apiKey
    ? createAnthropicBotReplier({ apiKey: w.ai.apiKey, fetch: w.ai.fetch })
    : undefined;
  return createBotConsumer({
    claimBatch: (limit) => cursorStore.claimBatch('bot', limit),
    getBotConfig: (ws) => botConfig.get(ws),
    getEntitlements: (ws) => w.entitlements.get(ws),
    listRules: (ws, channelId) => botRules.listEnabled(ws, channelId),
    getConversation: (ws, conv) => w.conversations.findById(ws, conv),
    getMessage: (ws, msgId) => w.inboxRead.getMessageById(ws, msgId),
    sendOutbound: w.sendOutbound,
    manage: w.manageConversation,
    aiReply,
  });
}
