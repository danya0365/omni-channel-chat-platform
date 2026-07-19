import type { WireConversation } from '../../../domain/types';
import { Button } from '../ui/button';

interface Props {
  conversation: WireConversation;
  mine: boolean;
  acting: boolean;
  onAssign: () => void;
  onUnassign: () => void;
  onClose: () => void;
  onReopen: () => void;
}

/** หัวข้อสายที่เลือก + ปุ่มจัดการ (รับเรื่อง/คืนสาย · ปิดสาย/เปิดใหม่) */
export function ConversationHeader({
  conversation,
  mine,
  acting,
  onAssign,
  onUnassign,
  onClose,
  onReopen,
}: Props) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
      <p className="text-sm font-semibold text-card-foreground">
        {conversation.contactName ?? 'ไม่ทราบชื่อ'}
      </p>
      <div className="flex gap-2">
        {mine ? (
          <Button variant="secondary" onClick={onUnassign} disabled={acting}>
            คืนสาย
          </Button>
        ) : (
          <Button variant="primary" onClick={onAssign} disabled={acting}>
            รับเรื่อง
          </Button>
        )}
        {conversation.status === 'open' ? (
          <Button variant="secondary" onClick={onClose} disabled={acting}>
            ปิดสาย
          </Button>
        ) : (
          <Button variant="secondary" onClick={onReopen} disabled={acting}>
            เปิดใหม่
          </Button>
        )}
      </div>
    </header>
  );
}
