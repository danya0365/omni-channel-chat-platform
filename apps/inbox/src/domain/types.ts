// Wire types ของ inbox — DTO ของ apps/api (routes/inbox-wire.ts) แบบ JSON-safe (date = ISO string)
// union ของ unified schema (content/direction/sender) แชร์จาก @omni/domain ด้วย import type (ไม่ redefine)
// helper แปลง content → text อยู่ที่ lib/format.ts (แยก type ออกจาก logic)

import type { Assignee, MessageContent, MessageDirection, MessageSender } from '@omni/domain';

export type { Assignee, MessageContent, MessageDirection } from '@omni/domain';

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
