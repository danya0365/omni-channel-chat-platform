import type {
  ConversationRepository,
  InboxReadRepository,
  ManageConversation,
  SendOutboundMessage,
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

/**
 * ประกอบ bot consumer (Phase 5) — subscribe outbox ด้วย cursor 'bot' (additive · ไม่แตะ agent WS consumer)
 * bot ตอบตาม rules · (5B) rule ไม่ match + มี ANTHROPIC_API_KEY → ถาม AI · reuse sendOutbound/manageConversation
 * แยกไฟล์กัน God function/God file ใน wiring.ts (bot repos ผูก pool — อ่านล้วน, write path เปิด tx เอง)
 */
export function buildBotConsumer(
  handle: DbHandle,
  conversations: ConversationRepository,
  inboxRead: InboxReadRepository,
  sendOutbound: SendOutboundMessage,
  manageConversation: ManageConversation,
  ai: { apiKey?: string; fetch?: AnthropicFetch },
): () => Promise<number> {
  const cursorStore = createOutboxCursorStore(handle.db);
  const botRules = createBotRuleRepository(handle.db);
  const botConfig = createWorkspaceBotConfigRepository(handle.db);
  // AI fallback สร้างเมื่อมี key เท่านั้น (ต้อง aiEnabled ต่อ workspace ด้วย) · ไม่มี = rule-only
  const aiReply = ai.apiKey
    ? createAnthropicBotReplier({ apiKey: ai.apiKey, fetch: ai.fetch })
    : undefined;
  return createBotConsumer({
    claimBatch: (limit) => cursorStore.claimBatch('bot', limit),
    getBotConfig: (ws) => botConfig.get(ws),
    listRules: (ws, channelId) => botRules.listEnabled(ws, channelId),
    getConversation: (ws, conv) => conversations.findById(ws, conv),
    getMessage: (ws, msgId) => inboxRead.getMessageById(ws, msgId),
    sendOutbound,
    manage: manageConversation,
    aiReply,
  });
}
