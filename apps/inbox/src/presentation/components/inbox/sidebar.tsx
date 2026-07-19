import type { WsStatus } from '../../hooks/use-inbox-socket';
import type { Filter } from '../../lib/conversation-view';
import type { Session, WireConversation } from '../../../domain/types';
import { cn } from '../../lib/cn';
import { ConversationList } from './conversation-list';
import { FilterTabs } from './filter-tabs';
import { ThemeSwitcher } from './theme-switcher';

// ตาราง lookup แทน nested ternary เดิม (อ่านง่าย + เพิ่มสถานะได้ง่าย)
const STATUS: Record<WsStatus, { dot: string; label: string }> = {
  online: { dot: 'bg-success', label: 'ออนไลน์' },
  connecting: { dot: 'bg-warning', label: 'กำลังเชื่อม…' },
  offline: { dot: 'bg-error', label: 'ออฟไลน์' },
};

interface Props {
  session: Session;
  status: WsStatus;
  conversations: WireConversation[];
  filter: Filter;
  selectedId: string | null;
  onFilterChange: (f: Filter) => void;
  onSelect: (id: string) => void;
  onLogout: () => void;
}

/** แถบซ้าย — ตัวตน agent + สถานะ WS + สลับธีม + แท็บกรอง + ลิสต์สนทนา */
export function Sidebar({
  session,
  status,
  conversations,
  filter,
  selectedId,
  onFilterChange,
  onSelect,
  onLogout,
}: Props) {
  const s = STATUS[status];
  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-card">
      <header className="flex items-start justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-card-foreground">{session.agent.displayName}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span className={cn('inline-block h-2 w-2 rounded-full', s.dot)} />
            {s.label}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            onClick={onLogout}
            className="text-xs text-muted transition hover:text-foreground"
          >
            ออกจากระบบ
          </button>
          <ThemeSwitcher />
        </div>
      </header>
      <FilterTabs value={filter} onChange={onFilterChange} />
      <div className="flex-1 overflow-y-auto">
        <ConversationList
          conversations={conversations}
          me={session.agent.id}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </div>
    </aside>
  );
}
