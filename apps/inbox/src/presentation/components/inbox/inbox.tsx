'use client';

import { useCallback, useState } from 'react';
import { filterConversations, isMine, type Filter } from '../../lib/conversation-view';
import type { AgentEvent, Session } from '../../../domain/types';
import { useConversations } from '../../hooks/use-conversations';
import { useInboxSocket } from '../../hooks/use-inbox-socket';
import { useMessages } from '../../hooks/use-messages';
import { ConversationPane } from './conversation-pane';
import { Sidebar } from './sidebar';

/**
 * Orchestrator ของ agent inbox — ถือ state ระดับหน้า (สายที่เลือก/filter)
 * แล้วต่อ 3 hook (conversations/messages/socket) เข้ากับ 2 พื้นที่ UI (Sidebar/ConversationPane)
 * ไม่ import data ตรง — assign/close/reply/refresh ทั้งหมดมาจาก hook · ไฟล์นี้จึงบางและอ่าน flow จบในจอเดียว
 */
export function Inbox({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const { token } = session;
  const me = session.agent.id;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const convs = useConversations(token, onLogout);
  const msgs = useMessages(token, onLogout);

  // realtime: message → bump list + append ถ้าเป็นสายที่เปิดอยู่ · conversation → upsert
  const handleEvent = useCallback(
    (event: AgentEvent) => {
      if (event.type === 'message') {
        convs.applyMessage(event.conversationId, event.message);
        if (event.conversationId === selectedId) msgs.append(event.message);
      } else {
        convs.applyConversation(event.conversation);
      }
    },
    [convs, msgs, selectedId],
  );

  // on (re)connect → refresh (sync สายที่พลาดตอนหลุด) · เป็นจุดโหลดลิสต์ครั้งแรกด้วย
  const status = useInboxSocket(token, { onOpen: convs.refresh, onEvent: handleEvent });

  const selectConversation = useCallback(
    (id: string) => {
      setSelectedId(id);
      void msgs.loadFor(id);
    },
    [msgs],
  );

  const visible = filterConversations(convs.conversations, filter, me);
  const selected = convs.conversations.find((c) => c.id === selectedId) ?? null;
  const onSelected = (action: (id: string) => Promise<void>) => () => {
    if (selectedId) void action(selectedId);
  };

  return (
    <div className="flex h-full flex-1 overflow-hidden bg-background">
      <Sidebar
        session={session}
        status={status}
        conversations={visible}
        filter={filter}
        selectedId={selectedId}
        onFilterChange={setFilter}
        onSelect={selectConversation}
        onLogout={onLogout}
      />
      <ConversationPane
        conversation={selected}
        messages={msgs.messages}
        mine={selected ? isMine(selected, me) : false}
        acting={convs.acting}
        onAssign={onSelected(convs.assign)}
        onUnassign={onSelected(convs.unassign)}
        onClose={onSelected(convs.close)}
        onReopen={onSelected(convs.reopen)}
        onSend={(text) => (selectedId ? msgs.send(selectedId, text) : Promise.resolve(false))}
      />
    </div>
  );
}
