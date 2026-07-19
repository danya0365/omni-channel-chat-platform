'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { inboxWsUrl, listConversations, listMessages, reply, UnauthorizedError } from '../lib/api';
import { contentText } from '../lib/types';
import type { AgentMessageEvent, Session, WireConversation, WireMessage } from '../lib/types';

type WsStatus = 'connecting' | 'online' | 'offline';

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

/** เอา event มาอัปเดต conversation ที่มีอยู่ (bump lastMessage + ดันขึ้นบน) — false ถ้าไม่พบสาย */
function bumpConversation(
  list: WireConversation[],
  event: AgentMessageEvent,
): { next: WireConversation[]; found: boolean } {
  const idx = list.findIndex((c) => c.id === event.conversationId);
  const conv = list[idx];
  if (!conv) return { next: list, found: false };
  const updated: WireConversation = {
    ...conv,
    lastMessageAt: event.message.at,
    lastMessage: {
      direction: event.message.direction,
      content: event.message.content,
      at: event.message.at,
    },
  };
  return { next: [updated, ...list.slice(0, idx), ...list.slice(idx + 1)], found: true };
}

export function Inbox({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [conversations, setConversations] = useState<WireConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WireMessage[]>([]);
  const [status, setStatus] = useState<WsStatus>('connecting');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const { token } = session;

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

  // โหลด conversation list ครั้งแรก
  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  // WS realtime + reconnect
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
        let event: AgentMessageEvent;
        try {
          const parsed = JSON.parse(String(ev.data)) as AgentMessageEvent;
          if (parsed.type !== 'message') return;
          event = parsed;
        } catch {
          return;
        }
        // อัปเดต conversation list (bump) · ถ้าเป็นสายใหม่ที่ยังไม่มี → refetch
        setConversations((prev) => {
          const { next, found } = bumpConversation(prev, event);
          if (!found) void refreshConversations();
          return next;
        });
        // ถ้าเปิดสายนี้อยู่ → append (dedupe by id)
        if (event.conversationId === selectedIdRef.current) {
          setMessages((prev) =>
            prev.some((m) => m.id === event.message.id) ? prev : [...prev, event.message],
          );
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

  // auto-scroll ลงล่างสุดเมื่อมีข้อความใหม่
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
        // api คืนใหม่→เก่า · แสดง chat เก่า→ใหม่ (บนลงล่าง)
        setMessages(history.slice().reverse());
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
      // append ทันที (dedupe) — WS echo จะซ้ำ id เดิม เลยไม่เพิ่มซ้ำ
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    } catch (e) {
      if (!handleAuthError(e)) setDraft(text); // คืน draft ให้พิมพ์ใหม่
    } finally {
      setSending(false);
    }
  }

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-full flex-1 overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* sidebar: conversation list */}
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

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-zinc-400">ยังไม่มีสนทนา</p>
          )}
          {conversations.map((c) => (
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
              <span className="truncate text-xs text-zinc-500">
                {c.lastMessage
                  ? `${c.lastMessage.direction === 'outbound' ? 'คุณ: ' : ''}${contentText(c.lastMessage.content)}`
                  : '—'}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* main: conversation view */}
      <section className="flex flex-1 flex-col">
        {selectedConv ? (
          <>
            <header className="border-b border-zinc-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {selectedConv.contactName ?? 'ไม่ทราบชื่อ'}
              </p>
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
