import { describe, expect, it } from 'vitest';
import { createManageConversation } from './manage-conversation';
import type { ConversationRef } from './manage-conversation';
import type { Conversation } from '../schema/conversation';
import type { ConversationRepository, DomainEvent, EventBus } from '../ports';

const seededConversation: Conversation = {
  id: 'conv_1',
  workspaceId: 'ws_1',
  contactId: 'ctc_1',
  channelId: 'chn_web',
  status: 'open',
  assignee: null,
  createdAt: new Date(Date.UTC(2026, 0, 1)),
  lastMessageAt: new Date(Date.UTC(2026, 0, 1)),
};

function setup(seed: Conversation[] = [seededConversation]) {
  const store = { conversations: seed.map((c) => ({ ...c })), events: [] as DomainEvent[] };

  const conversations: ConversationRepository = {
    findLatestOpen: async () => null,
    findById: async (workspaceId, conversationId) =>
      store.conversations.find((c) => c.workspaceId === workspaceId && c.id === conversationId) ??
      null,
    insert: async () => {},
    touch: async () => {},
    setAssignee: async (_ws, conversationId, assignee) => {
      const c = store.conversations.find((x) => x.id === conversationId);
      if (c) c.assignee = assignee;
    },
    setStatus: async (_ws, conversationId, status) => {
      const c = store.conversations.find((x) => x.id === conversationId);
      if (c) c.status = status;
    },
  };
  const events: EventBus = {
    publish: async (event) => {
      store.events.push(event);
    },
  };
  const manage = createManageConversation({
    conversations,
    events,
    now: () => new Date(Date.UTC(2026, 0, 2)),
  });
  return { store, manage };
}

const ref = { workspaceId: 'ws_1', conversationId: 'conv_1' } as const;

describe('manageConversation', () => {
  it('assign → ตั้ง assignee เป็น agent + publish conversation.updated', async () => {
    const { store, manage } = setup();
    const res = await manage.assign({ ...ref, agentId: 'agt_9' });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.assignee).toEqual({ kind: 'agent', agentId: 'agt_9' });
    expect(store.conversations[0]?.assignee).toEqual({ kind: 'agent', agentId: 'agt_9' });
    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({
      type: 'conversation.updated',
      conversationId: 'conv_1',
    });
  });

  it('unassign → assignee = null', async () => {
    const { store, manage } = setup([
      { ...seededConversation, assignee: { kind: 'agent', agentId: 'agt_9' } },
    ]);
    const res = await manage.unassign(ref);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.assignee).toBeNull();
    expect(store.conversations[0]?.assignee).toBeNull();
  });

  it('close → status closed · reopen → status open', async () => {
    const { store, manage } = setup();
    const closed = await manage.close(ref);
    expect(closed.ok && closed.value.status).toBe('closed');
    expect(store.conversations[0]?.status).toBe('closed');

    const reopened = await manage.reopen(ref);
    expect(reopened.ok && reopened.value.status).toBe('open');
    expect(store.conversations[0]?.status).toBe('open');
    expect(store.events).toHaveLength(2); // close + reopen
  });

  it('conversation ไม่มีใน workspace → err conversation_not_found, ไม่ publish', async () => {
    const { store, manage } = setup();
    const res = await manage.assign({
      workspaceId: 'ws_1',
      conversationId: 'conv_missing',
      agentId: 'agt_9',
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('conversation_not_found');
    expect(store.events).toHaveLength(0);
  });

  it('command ผิดรูป (conversationId ไม่ใช่ conv_) → err invalid_command', async () => {
    const { manage } = setup();
    // cast: จำลอง input ที่มาจาก HTTP (untyped) ที่ conversationId ผิดรูป → service ต้อง safeParse ดัก
    const res = await manage.close({
      workspaceId: 'ws_1',
      conversationId: 'xxx',
    } as unknown as ConversationRef);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('invalid_command');
  });
});
