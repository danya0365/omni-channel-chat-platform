import type { Message } from '@omni/domain';
import { toWireMessage, type WireMessage } from '../routes/inbox-wire';

/**
 * Event ที่ push เข้า agent WS (realtime) — ตอนนี้มีชนิดเดียว: message ใหม่ในสาย
 * (inbound = ลูกค้าทัก · outbound = agent/bot ตอบ → คนอื่นใน workspace เห็น sync)
 * inbox UI parse event นี้: หา conversation ตาม conversationId แล้ว append/อัปเดต (dedupe ด้วย message.id)
 */
export interface AgentMessageEvent {
  type: 'message';
  conversationId: string;
  message: WireMessage;
}

export function toAgentMessageEvent(message: Message): AgentMessageEvent {
  return {
    type: 'message',
    conversationId: message.conversationId,
    message: toWireMessage(message),
  };
}
