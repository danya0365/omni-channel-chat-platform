// Wire types ของ inbox — DTO ของ apps/api (routes/inbox-wire.ts) แบบ JSON-safe (date = ISO string)
// union ของ unified schema (content/direction/sender) แชร์จาก @omni/domain ด้วย import type (ไม่ redefine)

import type { MessageContent, MessageDirection, MessageSender } from '@omni/domain';

export type { MessageContent, MessageDirection } from '@omni/domain';

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
  lastMessageAt: string;
  lastMessage: { direction: MessageDirection; content: MessageContent; at: string } | null;
}

/** event ที่ agent WS ส่งมา (realtime) — ดู apps/api/src/realtime/agent-events.ts */
export interface AgentMessageEvent {
  type: 'message';
  conversationId: string;
  message: WireMessage;
}

export interface AuthAgent {
  id: string;
  workspaceId: string;
  email: string;
  displayName: string;
}

export interface Session {
  token: string;
  agent: AuthAgent;
}

/** ดึง text จาก content (union) — ชนิดที่ยังไม่รองรับแสดง placeholder */
export function contentText(content: MessageContent): string {
  return content.type === 'text' ? content.text : '[ข้อความชนิดนี้ยังไม่รองรับ]';
}
