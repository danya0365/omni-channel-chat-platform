import { describe, expect, it } from 'vitest';
import {
  createDeliverOutboundMessage,
  createPersistOutboundMessage,
} from './send-outbound-message';
import type {
  SendOutboundCommand,
  SendOutboundError,
  SendOutboundResult,
} from './send-outbound-message';
import { makeId } from '../ids';
import type { IdGenerator } from '../ids';
import { err, ok } from '../result';
import type { Result } from '../result';
import type { Conversation } from '../schema/conversation';
import type { DeliveryStatus, Message } from '../schema/message';
import type {
  ConversationRepository,
  DomainEvent,
  EventBus,
  MessageRepository,
  OutboundGateway,
} from '../ports';

/** conversation ตั้งต้น (open) สำหรับ outbound ยิงเข้า */
const seededConversation: Conversation = {
  id: 'conv_1',
  workspaceId: 'ws_1',
  contactId: 'ctc_1',
  channelId: 'chn_web',
  status: 'open',
  assignee: null,
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 0)),
  lastMessageAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 0)),
};

/**
 * in-memory fakes · outbound gateway ปรับได้ว่าจะ deliver/offline/fail
 * เผย persist / deliver แยก + `send` = ประกอบเหมือน composition root (persist → deliver) เพื่อเทส flow เต็ม
 */
function setup(
  options: { delivered?: boolean; gatewayFails?: boolean; seed?: Conversation[] } = {},
) {
  const { delivered = true, gatewayFails = false, seed = [seededConversation] } = options;

  const store = {
    conversations: [...seed] as Conversation[],
    messages: [] as Message[],
    sent: [] as Message[],
    events: [] as DomainEvent[],
    statusUpdates: [] as Array<{ id: string; status: DeliveryStatus }>,
  };

  const conversations: ConversationRepository = {
    findLatestOpen: async () => null,
    findById: async (workspaceId, conversationId) =>
      store.conversations.find((c) => c.workspaceId === workspaceId && c.id === conversationId) ??
      null,
    insert: async (_workspaceId, conversation) => {
      store.conversations.push(conversation);
    },
    touch: async (_workspaceId, conversationId, lastMessageAt) => {
      const conv = store.conversations.find((c) => c.id === conversationId);
      if (conv) conv.lastMessageAt = lastMessageAt;
    },
    setAssignee: async () => {},
    setStatus: async () => {},
  };

  const messages: MessageRepository = {
    insert: async (_workspaceId, message) => {
      store.messages.push(message);
      return { inserted: true };
    },
    updateStatus: async (_workspaceId, messageId, status) => {
      store.statusUpdates.push({ id: messageId, status });
      const m = store.messages.find((x) => x.id === messageId);
      if (m) m.status = status;
    },
  };

  const outbound: OutboundGateway = {
    send: async (message) => {
      if (gatewayFails) return err({ code: 'send_failed', message: 'boom' });
      store.sent.push(message);
      return ok({ externalId: null, delivered });
    },
  };

  const events: EventBus = {
    publish: async (event) => {
      store.events.push(event);
    },
  };

  let idCounter = 0;
  const generateId: IdGenerator = (prefix) => makeId(prefix, `t${(idCounter += 1)}`);
  let tick = 1;
  const now = () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++));

  const persist = createPersistOutboundMessage({
    conversations,
    messages,
    events,
    generateId,
    now,
  });
  const deliver = createDeliverOutboundMessage({ outbound, messages });
  const send = async (
    command: SendOutboundCommand,
  ): Promise<Result<SendOutboundResult, SendOutboundError>> => {
    const persisted = await persist(command);
    if (!persisted.ok) return persisted;
    return deliver(persisted.value.message);
  };

  return { store, persist, deliver, send };
}

const baseCommand: SendOutboundCommand = {
  workspaceId: 'ws_1',
  channelId: 'chn_web',
  conversationId: 'conv_1',
  content: { type: 'text', text: 'ตอบกลับครับ' },
};

describe('persistOutboundMessage (เฟส 1 — ใน tx)', () => {
  it('conversation มีจริง → persist message(sent) + touch + publish event · ยังไม่ยิงช่องทาง', async () => {
    const { store, persist } = setup();

    const res = await persist(baseCommand);

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(store.messages).toHaveLength(1);
    const [msg] = store.messages;
    expect(msg?.direction).toBe('outbound');
    expect(msg?.status).toBe('sent'); // optimistic
    expect(msg?.sender).toEqual({ kind: 'bot' }); // default sender
    expect(res.value.message.id).toBe(msg?.id);

    // touch เด้ง lastMessageAt + publish event ชี้ message ที่เพิ่ง persist · ยังไม่ยิงช่องทาง (store.sent ว่าง)
    const conv = store.conversations.find((c) => c.id === 'conv_1');
    expect(conv?.lastMessageAt.getTime()).toBeGreaterThan(conv?.createdAt.getTime() ?? 0);
    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({
      type: 'outbound_message.sent',
      conversationId: 'conv_1',
      messageId: msg?.id,
    });
  });

  it('ส่ง sender เอง (agent) → ใช้ค่าที่ส่งมา ไม่ override เป็น default', async () => {
    const { store, persist } = setup();
    const res = await persist({ ...baseCommand, sender: { kind: 'agent', agentId: 'agt_9' } });
    expect(res.ok).toBe(true);
    expect(store.messages[0]?.sender).toEqual({ kind: 'agent', agentId: 'agt_9' });
  });

  it('conversation ไม่มีจริง → err conversation_not_found, ไม่ persist/ไม่ publish', async () => {
    const { store, persist } = setup();
    const res = await persist({ ...baseCommand, conversationId: 'conv_ไม่มี' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('conversation_not_found');
    expect(store.messages).toHaveLength(0);
    expect(store.events).toHaveLength(0);
  });

  it('conversation คนละช่องทาง → err conversation_not_found (กันยิงผิดช่องทาง/ข้าม tenant)', async () => {
    const { store, persist } = setup();
    const res = await persist({ ...baseCommand, channelId: 'chn_อื่น' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('conversation_not_found');
    expect(store.messages).toHaveLength(0);
  });

  it('command ไม่ผ่าน validation (text ว่าง) → err invalid_command, ไม่แตะ store', async () => {
    const { store, persist } = setup();
    const res = await persist({ ...baseCommand, content: { type: 'text', text: '' } });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('invalid_command');
    expect(store.messages).toHaveLength(0);
  });
});

describe('deliverOutboundMessage (เฟส 2 — นอก tx)', () => {
  const persistedMessage: Message = {
    id: 'msg_1',
    workspaceId: 'ws_1',
    conversationId: 'conv_1',
    channelId: 'chn_web',
    direction: 'outbound',
    sender: { kind: 'bot' },
    content: { type: 'text', text: 'ตอบกลับครับ' },
    status: 'sent',
    externalId: null,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 5)),
  };

  it('ปลายทาง online → delivered=true, ไม่แตะสถานะ', async () => {
    const { store, deliver } = setup({ delivered: true });
    const res = await deliver(persistedMessage);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.delivered).toBe(true);
    expect(store.sent).toHaveLength(1);
    expect(store.statusUpdates).toHaveLength(0);
  });

  it('ปลายทาง offline (ไม่มี socket) → delivered=false (ไม่ใช่ error), ไม่ mark failed', async () => {
    const { store, deliver } = setup({ delivered: false });
    const res = await deliver(persistedMessage);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.delivered).toBe(false);
    expect(store.statusUpdates).toHaveLength(0);
  });

  it('ช่องทางล้ม (retry หมด) → err send_failed + mark message เป็น failed', async () => {
    const { store, deliver } = setup({ gatewayFails: true });
    const res = await deliver(persistedMessage);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('send_failed');
    expect(store.sent).toHaveLength(0);
    // สถานะถูกอัปเป็น failed (message ยัง persist เป็นความจริง — แค่สะท้อนว่าส่งไม่ถึง)
    expect(store.statusUpdates).toEqual([{ id: 'msg_1', status: 'failed' }]);
  });
});

describe('send (persist → deliver ประกอบเหมือน composition root)', () => {
  it('flow ปกติ → persist + ยิงช่องทาง + delivered', async () => {
    const { store, send } = setup({ delivered: true });
    const res = await send(baseCommand);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.delivered).toBe(true);
    expect(store.messages).toHaveLength(1);
    expect(store.sent).toHaveLength(1);
    expect(store.events).toHaveLength(1);
  });

  it('persist ล้ม (conversation ไม่มี) → ไม่ deliver เลย', async () => {
    const { store, send } = setup();
    const res = await send({ ...baseCommand, conversationId: 'conv_ไม่มี' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('conversation_not_found');
    expect(store.messages).toHaveLength(0);
    expect(store.sent).toHaveLength(0);
  });

  it('deliver ล้ม → err send_failed แต่ message ยัง persist ไว้ (persist-before-deliver) + status failed', async () => {
    const { store, send } = setup({ gatewayFails: true });
    const res = await send(baseCommand);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('send_failed');
    // persist เกิดก่อน deliver — message + event เป็นความจริงแม้ช่องทางล้ม (agent เห็น reply)
    expect(store.messages).toHaveLength(1);
    expect(store.sent).toHaveLength(0);
    expect(store.events).toHaveLength(1);
    expect(store.events[0]?.type).toBe('outbound_message.sent');
    expect(store.messages[0]?.status).toBe('failed');
  });
});
