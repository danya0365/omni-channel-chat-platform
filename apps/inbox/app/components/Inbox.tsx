'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  assignConversation,
  closeConversation,
  inboxWsUrl,
  listConversations,
  listMessages,
  reopenConversation,
  reply,
  unassignConversation,
  UnauthorizedError,
} from '../lib/api';
import { contentText } from '../lib/types';
import type {
  AgentEvent,
  ConversationPatch,
  Session,
  WireConversation,
  WireMessage,
} from '../lib/types';

type WsStatus = 'connecting' | 'online' | 'offline';
type Filter = 'all' | 'mine' | 'unassigned';

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

/** ข้อความใหม่ → bump lastMessage + ดันสายขึ้นบน · false ถ้าไม่พบสาย (ต้อง refetch) */
function bumpConversation(
  list: WireConversation[],
  conversationId: string,
  message: WireMessage,
): { next: WireConversation[]; found: boolean } {
  const idx = list.findIndex((c) => c.id === conversationId);
  const conv = list[idx];
  if (!conv) return { next: list, found: false };
  const updated: WireConversation = {
    ...conv,
    lastMessageAt: message.at,
    lastMessage: { direction: message.direction, content: message.content, at: message.at },
  };
  return { next: [updated, ...list.slice(0, idx), ...list.slice(idx + 1)], found: true };
}

/** upsert conversation (จาก conversation event) — แทนที่ในตำแหน่งเดิม หรือเติมบนสุดถ้าใหม่ */
function upsertConversation(list: WireConversation[], conv: WireConversation): WireConversation[] {
  const idx = list.findIndex((c) => c.id === conv.id);
  if (idx === -1) return [conv, ...list];
  return list.map((c) => (c.id === conv.id ? conv : c));
}

export function Inbox({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [conversations, setConversations] = useState<WireConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WireMessage[]>([]);
  const [status, setStatus] = useState<WsStatus>('connecting');
  const [filter, setFilter] = useState<Filter>('all');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);

  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const { token } = session;
  const me = session.agent.id;

  const handleAuthError = useCallback(
    (e: unknown) => {
      if (e instanceof UnauthorizedError) {
        onLogout();
        return true;
      }
      return false;
    },
    [onLogout],
  );

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await listConversations(token));
    } catch (e) {
      handleAuthError(e);
    }
  }, [token, handleAuthError]);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  // WS realtime (message + conversation) + reconnect
  useEffect(() => {
    let stopped = false;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (stopped) return;
      setStatus('connecting');
      const ws = new WebSocket(inboxWsUrl(token));
      socket = ws;
      ws.onopen = () => setStatus('online');
      ws.onmessage = (ev) => {
        let event: AgentEvent;
        try {
          event = JSON.parse(String(ev.data)) as AgentEvent;
        } catch {
          return;
        }
        if (event.type === 'message') {
          setConversations((prev) => {
            const { next, found } = bumpConversation(prev, event.conversationId, event.message);
            if (!found) void refreshConversations();
            return next;
          });
          if (event.conversationId === selectedIdRef.current) {
            setMessages((prev) =>
              prev.some((m) => m.id === event.message.id) ? prev : [...prev, event.message],
            );
          }
        } else if (event.type === 'conversation') {
          // assign/close ฯลฯ จาก agent อื่น → sync สาย
          setConversations((prev) => upsertConversation(prev, event.conversation));
        }
      };
      ws.onclose = () => {
        setStatus('offline');
        if (!stopped) retry = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws.close();
    };
    connect();

    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, [token, refreshConversations]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectConversation = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setMessages([]);
      setDraft('');
      try {
        const history = await listMessages(token, id);
        setMessages(history.slice().reverse()); // api ใหม่→เก่า · แสดงเก่า→ใหม่
      } catch (e) {
        handleAuthError(e);
      }
    },
    [token, handleAuthError],
  );

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !selectedId) return;
    setDraft('');
    setSending(true);
    try {
      const msg = await reply(token, selectedId, text);
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    } catch (e) {
      if (!handleAuthError(e)) setDraft(text);
    } finally {
      setSending(false);
    }
  }

  /** run action (assign/unassign/close/reopen) → merge patch เข้า conversation (WS จะ sync ซ้ำ, idempotent) */
  async function runAction(action: (t: string, id: string) => Promise<ConversationPatch>) {
    if (!selectedId) return;
    setActing(true);
    try {
      const patch = await action(token, selectedId);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === patch.id ? { ...c, status: patch.status, assignee: patch.assignee } : c,
        ),
      );
    } catch (e) {
      if (!handleAuthError(e)) void refreshConversations();
    } finally {
      setActing(false);
    }
  }

  const filtered = conversations.filter((c) => {
    if (filter === 'mine') return c.assignee?.kind === 'agent' && c.assignee.agentId === me;
    if (filter === 'unassigned') return c.assignee === null;
    return true;
  });
  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;
  const mineSelected =
    selectedConv?.assignee?.kind === 'agent' && selectedConv.assignee.agentId === me;

  function assigneeBadge(c: WireConversation): { label: string; className: string } | null {
    if (c.status === 'closed') return { label: 'ปิดแล้ว', className: 'bg-zinc-200 text-zinc-500' };
    if (!c.assignee) return { label: 'ยังไม่รับ', className: 'bg-amber-100 text-amber-700' };
    if (c.assignee.kind === 'agent')
      return c.assignee.agentId === me
        ? { label: 'ของฉัน', className: 'bg-violet-100 text-violet-700' }
        : { label: 'มอบหมายแล้ว', className: 'bg-sky-100 text-sky-700' };
    return { label: 'บอท', className: 'bg-zinc-100 text-zinc-500' };
  }

  const FILTERS: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'mine', label: 'ของฉัน' },
    { key: 'unassigned', label: 'ยังไม่รับ' },
  ];

  return (
    <div className="flex h-full flex-1 overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* sidebar */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {session.agent.displayName}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  status === 'online'
                    ? 'bg-emerald-500'
                    : status === 'connecting'
                      ? 'bg-amber-400'
                      : 'bg-red-500'
                }`}
              />
              {status === 'online'
                ? 'ออนไลน์'
                : status === 'connecting'
                  ? 'กำลังเชื่อม…'
                  : 'ออฟไลน์'}
            </p>
          </div>
          <button
            onClick={onLogout}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            ออกจากระบบ
          </button>
        </header>

        {/* filter tabs */}
        <div className="flex gap-1 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === f.key
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-zinc-400">ไม่มีสนทนาในหมวดนี้</p>
          )}
          {filtered.map((c) => {
            const badge = assigneeBadge(c);
            return (
              <button
                key={c.id}
                onClick={() => void selectConversation(c.id)}
                className={`flex w-full flex-col gap-0.5 border-b border-zinc-100 px-4 py-3 text-left transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 ${
                  c.id === selectedId ? 'bg-violet-50 dark:bg-zinc-800' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {c.contactName ?? 'ไม่ทราบชื่อ'}
                  </span>
                  <span className="ml-2 shrink-0 text-[11px] text-zinc-400">
                    {timeLabel(c.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-zinc-500">
                    {c.lastMessage
                      ? `${c.lastMessage.direction === 'outbound' ? 'คุณ: ' : ''}${contentText(c.lastMessage.content)}`
                      : '—'}
                  </span>
                  {badge && (
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* main */}
      <section className="flex flex-1 flex-col">
        {selectedConv ? (
          <>
            <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {selectedConv.contactName ?? 'ไม่ทราบชื่อ'}
              </p>
              <div className="flex gap-2">
                {mineSelected ? (
                  <button
                    onClick={() => void runAction(unassignConversation)}
                    disabled={acting}
                    className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    คืนสาย
                  </button>
                ) : (
                  <button
                    onClick={() => void runAction(assignConversation)}
                    disabled={acting}
                    className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                  >
                    รับเรื่อง
                  </button>
                )}
                {selectedConv.status === 'open' ? (
                  <button
                    onClick={() => void runAction(closeConversation)}
                    disabled={acting}
                    className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    ปิดสาย
                  </button>
                ) : (
                  <button
                    onClick={() => void runAction(reopenConversation)}
                    disabled={acting}
                    className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    เปิดใหม่
                  </button>
                )}
              </div>
            </header>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
              {messages.map((m) => {
                const mine = m.direction === 'outbound';
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
                        mine
                          ? 'rounded-br-sm bg-violet-600 text-white'
                          : 'rounded-bl-sm border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
                      }`}
                    >
                      <p className="whitespace-pre-wrap wrap-break-word">
                        {contentText(m.content)}
                      </p>
                      <p
                        className={`mt-0.5 text-[10px] ${mine ? 'text-violet-200' : 'text-zinc-400'}`}
                      >
                        {timeLabel(m.at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={listEndRef} />
            </div>

            <form
              onSubmit={sendReply}
              className="flex gap-2 border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="พิมพ์ข้อความตอบ…"
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="rounded-lg bg-violet-600 px-5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                ส่ง
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
            เลือกสนทนาทางซ้ายเพื่อเริ่มตอบ
          </div>
        )}
      </section>
    </div>
  );
}
