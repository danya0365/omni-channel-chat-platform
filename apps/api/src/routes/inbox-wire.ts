import type {
  Assignee,
  ConversationListItem,
  ConversationStatus,
  DeliveryStatus,
  Message,
  MessageContent,
  MessageDirection,
  MessageSender,
} from '@omni/domain';

/**
 * Wire DTO ของ inbox (api → inbox UI) — JSON-safe (Date → ISO string)
 * inbox UI นิยาม type ฝั่งตัวเองให้ตรง shape นี้ (import enum/union ที่ JSON-safe จาก @omni/domain ได้)
 * ⚠️ อย่าใส่ PII เกิน (contactName เป็นชื่อที่ช่องทางให้ — โชว์ใน inbox ได้)
 */
export interface WireMessage {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  sender: MessageSender;
  content: MessageContent;
  status: DeliveryStatus;
  at: string;
}

export interface WireConversation {
  id: string;
  contactName: string | null;
  status: ConversationStatus;
  assignee: Assignee | null;
  lastMessageAt: string;
  lastMessage: { direction: MessageDirection; content: MessageContent; at: string } | null;
}

export function toWireMessage(m: Message): WireMessage {
  return {
    id: m.id,
    conversationId: m.conversationId,
    direction: m.direction,
    sender: m.sender,
    content: m.content,
    status: m.status,
    at: m.createdAt.toISOString(),
  };
}

export function toWireConversation(item: ConversationListItem): WireConversation {
  const { conversation, contactName, lastMessage } = item;
  return {
    id: conversation.id,
    contactName,
    status: conversation.status,
    assignee: conversation.assignee,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    lastMessage: lastMessage
      ? {
          direction: lastMessage.direction,
          content: lastMessage.content,
          at: lastMessage.createdAt.toISOString(),
        }
      : null,
  };
}
