import type { Filter } from '../../lib/conversation-view';
import { cn } from '../../lib/cn';

const TABS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'mine', label: 'ของฉัน' },
  { key: 'unassigned', label: 'ยังไม่รับ' },
];

/** แท็บกรองสนทนา (ทั้งหมด/ของฉัน/ยังไม่รับ) — client-side */
export function FilterTabs({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  return (
    <div className="flex gap-1 border-b border-border px-3 py-2">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition',
            value === t.key ? 'bg-brand-600 text-on-brand' : 'text-muted hover:bg-muted-surface',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
