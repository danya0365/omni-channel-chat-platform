import { describe, expect, it } from 'vitest';
import {
  assigneeBadge,
  bumpWithMessage,
  filterConversations,
  isMine,
  patchConversation,
  upsertConversation,
} from './conversation-view';
import type { WireConversation, WireMessage } from '../../domain/types';

// ข้อมูลสมมติล้วน (ไม่ใช่ PII จริง) — agentId ต้องขึ้นต้น agt_ ตาม branded id
const ME = 'agt_me';

function conv(over: Partial<WireConversation> = {}): WireConversation {
  return {
    id: 'conv_1',
    contactName: 'ลูกค้า A',
    status: 'open',
    assignee: null,
    lastMessageAt: '2026-07-19T10:00:00.000Z',
    lastMessage: null,
    ...over,
  };
}

function msg(over: Partial<WireMessage> = {}): WireMessage {
  return {
    id: 'msg_1',
    conversationId: 'conv_1',
    direction: 'inbound',
    sender: { kind: 'contact', contactId: 'ctc_1' },
    content: { type: 'text', text: 'สวัสดี' },
    status: 'received',
    at: '2026-07-19T11:00:00.000Z',
    ...over,
  };
}

describe('isMine', () => {
  it('true เมื่อ assignee เป็น agent = me', () => {
    expect(isMine(conv({ assignee: { kind: 'agent', agentId: ME } }), ME)).toBe(true);
  });
  it('false เมื่อเป็น agent คนอื่น / bot / null', () => {
    expect(isMine(conv({ assignee: { kind: 'agent', agentId: 'agt_other' } }), ME)).toBe(false);
    expect(isMine(conv({ assignee: { kind: 'bot' } }), ME)).toBe(false);
    expect(isMine(conv({ assignee: null }), ME)).toBe(false);
  });
});

describe('filterConversations', () => {
  const mine = conv({ id: 'conv_mine', assignee: { kind: 'agent', agentId: ME } });
  const other = conv({ id: 'conv_other', assignee: { kind: 'agent', agentId: 'agt_x' } });
  const free = conv({ id: 'conv_free', assignee: null });
  const list = [mine, other, free];

  it('all = ทั้งหมด', () => {
    expect(filterConversations(list, 'all', ME)).toHaveLength(3);
  });
  it('mine = เฉพาะของฉัน', () => {
    expect(filterConversations(list, 'mine', ME).map((c) => c.id)).toEqual(['conv_mine']);
  });
  it('unassigned = เฉพาะที่ยังไม่ assign', () => {
    expect(filterConversations(list, 'unassigned', ME).map((c) => c.id)).toEqual(['conv_free']);
  });
});

describe('assigneeBadge', () => {
  it('closed → ปิดแล้ว (ชนะทุกกรณี)', () => {
    const b = assigneeBadge(
      conv({ status: 'closed', assignee: { kind: 'agent', agentId: ME } }),
      ME,
    );
    expect(b?.label).toBe('ปิดแล้ว');
  });
  it('ไม่มี assignee → ยังไม่รับ', () => {
    expect(assigneeBadge(conv({ assignee: null }), ME)?.label).toBe('ยังไม่รับ');
  });
  it('agent = me → ของฉัน', () => {
    expect(assigneeBadge(conv({ assignee: { kind: 'agent', agentId: ME } }), ME)?.label).toBe(
      'ของฉัน',
    );
  });
  it('agent อื่น → มอบหมายแล้ว', () => {
    expect(assigneeBadge(conv({ assignee: { kind: 'agent', agentId: 'agt_x' } }), ME)?.label).toBe(
      'มอบหมายแล้ว',
    );
  });
  it('bot → บอท', () => {
    expect(assigneeBadge(conv({ assignee: { kind: 'bot' } }), ME)?.label).toBe('บอท');
  });
});

describe('bumpWithMessage', () => {
  it('ดันสายที่มีข้อความใหม่ขึ้นบนสุด + อัปเดต lastMessage', () => {
    const a = conv({ id: 'conv_a' });
    const b = conv({ id: 'conv_b' });
    const { next, found } = bumpWithMessage([a, b], 'conv_b', msg({ conversationId: 'conv_b' }));
    expect(found).toBe(true);
    expect(next.map((c) => c.id)).toEqual(['conv_b', 'conv_a']);
    expect(next[0]?.lastMessage?.content).toEqual({ type: 'text', text: 'สวัสดี' });
    expect(next[0]?.lastMessageAt).toBe('2026-07-19T11:00:00.000Z');
  });
  it('ไม่พบสาย → found=false + list เดิม', () => {
    const a = conv({ id: 'conv_a' });
    const { next, found } = bumpWithMessage([a], 'conv_ghost', msg());
    expect(found).toBe(false);
    expect(next).toEqual([a]);
  });
});

describe('upsertConversation', () => {
  it('มีอยู่แล้ว → แทนที่ตำแหน่งเดิม (ไม่ย้าย)', () => {
    const a = conv({ id: 'conv_a' });
    const b = conv({ id: 'conv_b', status: 'open' });
    const updatedB = conv({ id: 'conv_b', status: 'closed' });
    const next = upsertConversation([a, b], updatedB);
    expect(next.map((c) => c.id)).toEqual(['conv_a', 'conv_b']);
    expect(next[1]?.status).toBe('closed');
  });
  it('สายใหม่ → เติมบนสุด', () => {
    const a = conv({ id: 'conv_a' });
    const next = upsertConversation([a], conv({ id: 'conv_new' }));
    expect(next.map((c) => c.id)).toEqual(['conv_new', 'conv_a']);
  });
});

describe('patchConversation', () => {
  it('merge status/assignee เข้าสายที่ id ตรง', () => {
    const a = conv({ id: 'conv_a' });
    const next = patchConversation([a], {
      id: 'conv_a',
      status: 'closed',
      assignee: { kind: 'agent', agentId: ME },
    });
    expect(next[0]?.status).toBe('closed');
    expect(next[0]?.assignee).toEqual({ kind: 'agent', agentId: ME });
    // field อื่นคงเดิม
    expect(next[0]?.contactName).toBe('ลูกค้า A');
  });
});
