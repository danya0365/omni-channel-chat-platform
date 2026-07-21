// Wire types ของ inbox — DTO ของ apps/api (routes/inbox-wire.ts) แบบ JSON-safe (date = ISO string)
// union ของ unified schema (content/direction/sender) แชร์จาก @omni/domain ด้วย import type (ไม่ redefine)
// helper แปลง content → text อยู่ที่ lib/format.ts (แยก type ออกจาก logic)

import type {
  Assignee,
  BotRuleAction,
  BotRuleMatchType,
  EntitlementModule,
  MessageContent,
  MessageDirection,
  MessageSender,
} from '@omni/domain';

export type {
  Assignee,
  BotRuleAction,
  EntitlementModule,
  MessageContent,
  MessageDirection,
} from '@omni/domain';

export interface WireMessage {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  sender: MessageSender;
  content: MessageContent;
  status: string;
  at: string;
}

export interface WireConversation {
  id: string;
  contactName: string | null;
  status: 'open' | 'closed';
  assignee: Assignee | null;
  lastMessageAt: string;
  lastMessage: { direction: MessageDirection; content: MessageContent; at: string } | null;
}

/** patch ที่ route assign/close คืนมา (UI merge เข้า conversation) */
export interface ConversationPatch {
  id: string;
  status: 'open' | 'closed';
  assignee: Assignee | null;
}

/** event ที่ agent WS ส่งมา (realtime) — ดู apps/api/src/realtime/agent-events.ts */
export interface AgentMessageEvent {
  type: 'message';
  conversationId: string;
  message: WireMessage;
}

export interface AgentConversationEvent {
  type: 'conversation';
  conversation: WireConversation;
}

export type AgentEvent = AgentMessageEvent | AgentConversationEvent;

export interface AuthAgent {
  id: string;
  workspaceId: string;
  email: string;
  displayName: string;
}

export interface Session {
  // auth transport = httpOnly cookie (ADR-0005) — ไม่มี token ฝั่ง client · เก็บแค่ตัวตน agent (ไม่ใช่ secret)
  agent: AuthAgent;
}

/**
 * โมดูลที่ workspace ซื้อไว้ (Phase 6) — UI ใช้ **ซ่อนเมนู** เท่านั้น (UX)
 * ⚠️ ไม่ใช่ security: server บังคับสิทธิ์เองทุก route (ADR-0007) — แก้ค่าฝั่ง client ก็ยิงไม่ผ่านอยู่ดี
 */
export type { BotRuleMatchType } from '@omni/domain';

/** rule ของบอท (wire DTO ของ apps/api → routes/bot-admin.ts) */
export interface WireBotRule {
  id: string;
  channelId: string | null;
  matchType: BotRuleMatchType;
  pattern: string;
  action: BotRuleAction;
  enabled: boolean;
  priority: number;
  createdAt: string;
}

/** สวิตช์ automation ของ workspace */
export interface WireBotConfig {
  workspaceId: string;
  botEnabled: boolean;
  aiEnabled: boolean;
}

/** ค่าที่ส่งไปสร้าง rule ใหม่ (workspace มาจาก session ฝั่ง server) */
export interface NewBotRule {
  pattern: string;
  action: BotRuleAction;
  priority?: number;
}

/** field ที่แก้ได้ของ rule */
export type BotRulePatchInput = Partial<Pick<WireBotRule, 'pattern' | 'enabled' | 'priority'>> & {
  action?: BotRuleAction;
};

/** โมดูลที่ UI รู้จัก — ใช้กับ `has()` ของ useEntitlements */
export type UiEntitlementModule = EntitlementModule;
