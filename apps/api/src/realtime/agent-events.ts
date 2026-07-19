import type { ConversationListItem, Message } from '@omni/domain';
import {
  toWireConversation,
  toWireMessage,
  type WireConversation,
  type WireMessage,
} from '../routes/inbox-wire';

/**
 * Event ที่ push เข้า agent WS (realtime):
 *   - message      = ข้อความใหม่ในสาย (inbound ลูกค้า / outbound agent-bot)
 *   - conversation = conversation เปลี่ยน (assign/unassign/close/reopen — Phase 4)
 * inbox UI parse ตาม type: message → append (dedupe by id) · conversation → merge สาย (assignee/status/bump)
 */
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

export function toAgentMessageEvent(message: Message): AgentMessageEvent {
  return {
    type: 'message',
    conversationId: message.conversationId,
    message: toWireMessage(message),
  };
}

export function toAgentConversationEvent(item: ConversationListItem): AgentConversationEvent {
  return { type: 'conversation', conversation: toWireConversation(item) };
}
