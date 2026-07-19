import { assigneeBadge } from '../../lib/conversation-view';
import { contentText, timeLabel } from '../../lib/format';
import type { WireConversation } from '../../../domain/types';
import { cn } from '../../lib/cn';

interface Props {
  conversation: WireConversation;
  me: string;
  selected: boolean;
  onSelect: () => void;
}

/** แถวสนทนาในลิสต์ซ้าย — ชื่อ contact + เวลา + ข้อความล่าสุด + ป้าย assignee */
export function ConversationRow({ conversation, me, selected, onSelect }: Props) {
  const badge = assigneeBadge(conversation, me);
  const last = conversation.lastMessage;
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex w-full flex-col gap-0.5 border-b border-border px-4 py-3 text-left transition hover:bg-muted-surface',
        selected && 'bg-brand-50 hover:bg-brand-50',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="truncate text-sm font-medium text-card-foreground">
          {conversation.contactName ?? 'ไม่ทราบชื่อ'}
        </span>
        <span className="ml-2 shrink-0 text-[11px] text-muted">
          {timeLabel(conversation.lastMessageAt)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted">
          {last
            ? `${last.direction === 'outbound' ? 'คุณ: ' : ''}${contentText(last.content)}`
            : '—'}
        </span>
        {badge && (
          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              badge.className,
            )}
          >
            {badge.label}
          </span>
        )}
      </div>
    </button>
  );
}
