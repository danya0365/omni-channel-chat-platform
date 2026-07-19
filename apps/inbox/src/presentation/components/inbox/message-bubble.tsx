import { contentText, timeLabel } from '../../lib/format';
import type { WireMessage } from '../../../domain/types';
import { cn } from '../../lib/cn';

/** ฟองข้อความเดียว — outbound (ทีมงาน) ชิดขวา · inbound (ลูกค้า) ชิดซ้าย */
export function MessageBubble({ message }: { message: WireMessage }) {
  const mine = message.direction === 'outbound';
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-3.5 py-2 text-sm',
          mine
            ? 'rounded-br-sm bg-brand-600 text-on-brand'
            : 'rounded-bl-sm border border-border bg-card text-card-foreground',
        )}
      >
        <p className="whitespace-pre-wrap wrap-break-word">{contentText(message.content)}</p>
        <p className={cn('mt-0.5 text-[10px]', mine ? 'text-on-brand/70' : 'text-muted')}>
          {timeLabel(message.at)}
        </p>
      </div>
    </div>
  );
}
