import type { WireConversation, WireMessage } from '../../../domain/types';
import { ConversationHeader } from './conversation-header';
import { MessageThread } from './message-thread';
import { ReplyForm } from './reply-form';

interface Props {
  conversation: WireConversation | null;
  messages: WireMessage[];
  mine: boolean;
  acting: boolean;
  onAssign: () => void;
  onUnassign: () => void;
  onClose: () => void;
  onReopen: () => void;
  onSend: (text: string) => Promise<boolean>;
}

/** พื้นที่ขวา — หัวข้อ + ข้อความ + กล่องตอบ (หรือ empty state ถ้ายังไม่เลือกสาย) */
export function ConversationPane({
  conversation,
  messages,
  mine,
  acting,
  onAssign,
  onUnassign,
  onClose,
  onReopen,
  onSend,
}: Props) {
  if (!conversation) {
    return (
      <section className="flex flex-1 items-center justify-center text-sm text-muted">
        เลือกสนทนาทางซ้ายเพื่อเริ่มตอบ
      </section>
    );
  }
  return (
    <section className="flex flex-1 flex-col">
      <ConversationHeader
        conversation={conversation}
        mine={mine}
        acting={acting}
        onAssign={onAssign}
        onUnassign={onUnassign}
        onClose={onClose}
        onReopen={onReopen}
      />
      <MessageThread messages={messages} />
      <ReplyForm onSend={onSend} />
    </section>
  );
}
