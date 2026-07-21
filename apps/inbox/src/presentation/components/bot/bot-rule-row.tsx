'use client';

import type { BotRulePatchInput, WireBotRule } from '../../../domain/types';
import { cn } from '../../lib/cn';
import { describeAction } from '../../lib/bot-view';
import { Button } from '../ui/button';

/** แถวกติกา 1 ข้อ — โชว์คำที่ดัก + สิ่งที่บอททำ + ปุ่มเปิด/ปิด/ลบ (ไม่ fetch เอง) */
export function BotRuleRow({
  rule,
  busy,
  onUpdate,
  onRemove,
}: {
  rule: WireBotRule;
  busy: boolean;
  onUpdate: (id: string, patch: BotRulePatchInput) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <li
      className={cn(
        'flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2',
        rule.enabled ? 'bg-card' : 'bg-muted-surface opacity-60',
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-card-foreground">“{rule.pattern}”</p>
        <p className="truncate text-xs text-muted">{describeAction(rule.action)}</p>
        <p className="text-xs text-muted">ลำดับ {rule.priority}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => onUpdate(rule.id, { enabled: !rule.enabled })}
          type="button"
        >
          {rule.enabled ? 'ปิด' : 'เปิด'}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => onRemove(rule.id)} type="button">
          ลบ
        </Button>
      </div>
    </li>
  );
}
