import { describe, expect, it } from 'vitest';
import { createSendOutboundMessage } from './send-outbound-message';
import type { SendOutboundCommand, SendOutboundDeps } from './send-outbound-message';
import { makeId } from '../ids';
import type { IdGenerator } from '../ids';
import { err, ok } from '../result';
import type { Conversation } from '../schema/conversation';
import type { Message } from '../schema/message';
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
 * conversations เริ่มด้วย seededConversation หนึ่งสาย (เว้นแต่จะ override)
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

  const deps: SendOutboundDeps = { conversations, messages, outbound, events, generateId, now };
  return { store, deps, send: createSendOutboundMessage(deps) };
}

const baseCommand: SendOutboundCommand = {
  workspaceId: 'ws_1',
  channelId: 'chn_web',
  conversationId: 'conv_1',
  content: { type: 'text', text: 'ตอบกลับครับ' },
};

describe('sendOutboundMessage', () => {
  it('conversation มีจริง + ปลายทาง online → persist outbound(sent) + touch + ส่งออกช่องทาง + delivered=true', async () => {
    const { store, send } = setup({ delivered: true });

    const res = await send(baseCommand);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.delivered).toBe(true);
    expect(res.value.externalId).toBeNull();

    expect(store.messages).toHaveLength(1);
    const [msg] = store.messages;
    expect(msg?.direction).toBe('outbound');
    expect(msg?.status).toBe('sent');
    expect(msg?.sender).toEqual({ kind: 'bot' }); // default sender
    expect(msg?.content).toEqual({ type: 'text', text: 'ตอบกลับครับ' });

    // ยิงออก gateway จริง + touch เด้ง lastMessageAt
    expect(store.sent).toHaveLength(1);
    const conv = store.conversations.find((c) => c.id === 'conv_1');
    expect(conv?.lastMessageAt.getTime()).toBeGreaterThan(conv?.createdAt.getTime() ?? 0);

    // publish outbound_message.sent (→ agent inbox realtime) ชี้ message ที่เพิ่ง persist
    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({
      type: 'outbound_message.sent',
      conversationId: 'conv_1',
      messageId: msg?.id,
    });
  });

  it('ปลายทาง offline (ไม่มี socket) → ยัง persist + ส่ง แต่ delivered=false (ไม่ใช่ error)', async () => {
    const { store, send } = setup({ delivered: false });

    const res = await send(baseCommand);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.delivered).toBe(false);
    expect(store.messages).toHaveLength(1); // message ยัง persist
  });

  it('ส่ง sender เอง (bot อื่น/agent) → ใช้ค่าที่ส่งมา ไม่ override เป็น default', async () => {
    const { store, send } = setup();

    const res = await send({ ...baseCommand, sender: { kind: 'agent', agentId: 'agt_9' } });

    expect(res.ok).toBe(true);
    expect(store.messages[0]?.sender).toEqual({ kind: 'agent', agentId: 'agt_9' });
  });

  it('conversation ไม่มีจริง → err conversation_not_found, ไม่ persist/ไม่ส่ง', async () => {
    const { store, send } = setup();

    const res = await send({ ...baseCommand, conversationId: 'conv_ไม่มี' });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('conversation_not_found');
    expect(store.messages).toHaveLength(0);
    expect(store.sent).toHaveLength(0);
  });

  it('conversation มีจริงแต่คนละช่องทาง → err conversation_not_found (กันยิงผิดช่องทาง/ข้าม tenant)', async () => {
    const { store, send } = setup();

    const res = await send({ ...baseCommand, channelId: 'chn_อื่น' });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('conversation_not_found');
    expect(store.messages).toHaveLength(0);
  });

  it('command ไม่ผ่าน validation (text ว่าง) → err invalid_command, ไม่แตะ store', async () => {
    const { store, send } = setup();

    const res = await send({ ...baseCommand, content: { type: 'text', text: '' } });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('invalid_command');
    expect(store.messages).toHaveLength(0);
    expect(store.sent).toHaveLength(0);
  });

  it('gateway ช่องทางล้ม → err send_failed แต่ message ยัง persist ไว้ (persist-before-send)', async () => {
    const { store, send } = setup({ gatewayFails: true });

    const res = await send(baseCommand);

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('send_failed');
    // persist ก่อนส่ง — message เป็นความจริงแม้ช่องทางล้ม + event ก็ publish แล้ว (agent เห็น reply)
    expect(store.messages).toHaveLength(1);
    expect(store.sent).toHaveLength(0);
    expect(store.events).toHaveLength(1);
    expect(store.events[0]?.type).toBe('outbound_message.sent');
  });
});
