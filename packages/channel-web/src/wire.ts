import type {
  ConversationId,
  Message,
  MessageContent,
  MessageDirection,
  MessageId,
  MessageSender,
} from '@omni/domain';

/**
 * WebMessageEvent — event ที่ push ผ่าน WS ไปหา widget (JSON-safe: createdAt → ISO string)
 * widget ใช้ event นี้ทั้งขา outbound (agent/bot ตอบ) และ echo inbound (ยืนยันข้อความตัวเอง)
 */
export interface WebMessageEvent {
  type: 'message';
  messageId: MessageId;
  conversationId: ConversationId;
  direction: MessageDirection;
  content: MessageContent;
  sender: MessageSender;
  /** ISO 8601 (createdAt ของ message) */
  at: string;
}

/** แปลง unified Message → payload สาย WS ของ web (serialize date ให้ JSON ส่งได้) */
export function toWirePayload(message: Message): WebMessageEvent {
  return {
    type: 'message',
    messageId: message.id,
    conversationId: message.conversationId,
    direction: message.direction,
    content: message.content,
    sender: message.sender,
    at: message.createdAt.toISOString(),
  };
}
