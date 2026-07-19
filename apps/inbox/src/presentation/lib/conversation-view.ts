// Pure view logic ของ conversation list — filter / badge / reducer
// แยกจาก component เพื่อ unit test ได้ (ไม่มี React, ไม่มี side-effect)

import type { ConversationPatch, WireConversation, WireMessage } from '../../domain/types';

export type Filter = 'all' | 'mine' | 'unassigned';

/** สายนี้เป็นของ agent คนนี้ (me) หรือไม่ */
export function isMine(conv: WireConversation, me: string): boolean {
  return conv.assignee?.kind === 'agent' && conv.assignee.agentId === me;
}

/** กรองลิสต์ตามแท็บ (all/mine/unassigned) — client-side */
export function filterConversations(
  list: WireConversation[],
  filter: Filter,
  me: string,
): WireConversation[] {
  if (filter === 'mine') return list.filter((c) => isMine(c, me));
  if (filter === 'unassigned') return list.filter((c) => c.assignee === null);
  return list;
}

export interface Badge {
  label: string;
  className: string;
}

/** ป้ายสถานะ assignee (มุมมองของ agent = me) · null = ไม่แสดงป้าย */
export function assigneeBadge(conv: WireConversation, me: string): Badge | null {
  if (conv.status === 'closed')
    return { label: 'ปิดแล้ว', className: 'bg-muted-surface text-muted' };
  if (!conv.assignee) return { label: 'ยังไม่รับ', className: 'bg-warning-surface text-warning' };
  if (conv.assignee.kind === 'agent') {
    return isMine(conv, me)
      ? { label: 'ของฉัน', className: 'bg-brand-100 text-brand-700' }
      : { label: 'มอบหมายแล้ว', className: 'bg-accent-100 text-accent-600' };
  }
  return { label: 'บอท', className: 'bg-muted-surface text-muted' };
}

/** ข้อความใหม่ → ดันสายขึ้นบนสุด + อัปเดต lastMessage · found=false ถ้าไม่พบสาย (caller ควร refresh) */
export function bumpWithMessage(
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

/** upsert สาย (จาก conversation event) — แทนที่ตำแหน่งเดิม หรือเติมบนสุดถ้าเป็นสายใหม่ */
export function upsertConversation(
  list: WireConversation[],
  conv: WireConversation,
): WireConversation[] {
  return list.some((c) => c.id === conv.id)
    ? list.map((c) => (c.id === conv.id ? conv : c))
    : [conv, ...list];
}

/** merge patch (id/status/assignee) จาก manage action เข้า list */
export function patchConversation(
  list: WireConversation[],
  patch: ConversationPatch,
): WireConversation[] {
  return list.map((c) =>
    c.id === patch.id ? { ...c, status: patch.status, assignee: patch.assignee } : c,
  );
}
