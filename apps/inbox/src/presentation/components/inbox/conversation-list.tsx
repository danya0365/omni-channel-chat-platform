import type { WireConversation } from '../../../domain/types';
import { ConversationRow } from './conversation-row';

interface Props {
  conversations: WireConversation[];
  me: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** ลิสต์สนทนา (กรองแล้ว) + empty state */
export function ConversationList({ conversations, me, selectedId, onSelect }: Props) {
  if (conversations.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-muted">ไม่มีสนทนาในหมวดนี้</p>;
  }
  return (
    <>
      {conversations.map((c) => (
        <ConversationRow
          key={c.id}
          conversation={c}
          me={me}
          selected={c.id === selectedId}
          onSelect={() => onSelect(c.id)}
        />
      ))}
    </>
  );
}
