import { describe, expect, it } from 'vitest';
import { createIngestInboundMessage } from './ingest-inbound-message';
import type { IngestInboundCommand, IngestInboundDeps } from './ingest-inbound-message';
import { makeId } from '../ids';
import type { IdGenerator } from '../ids';
import type { Contact, ContactIdentity } from '../schema/contact';
import type { Conversation } from '../schema/conversation';
import type { Message } from '../schema/message';
import type {
  ContactRepository,
  ConversationRepository,
  DomainEvent,
  EventBus,
  MessageRepository,
} from '../ports';

/** in-memory fakes + deterministic id generator + clock ที่เดินทีละวินาที (ให้ touch สังเกตได้) */
function setup() {
  const store = {
    contacts: [] as Contact[],
    identities: [] as ContactIdentity[],
    conversations: [] as Conversation[],
    messages: [] as Message[],
    events: [] as DomainEvent[],
  };

  const contacts: ContactRepository = {
    findByChannelIdentity: async (workspaceId, channelId, externalId) => {
      const identity = store.identities.find(
        (i) =>
          i.workspaceId === workspaceId && i.channelId === channelId && i.externalId === externalId,
      );
      if (!identity) return null;
      const contact = store.contacts.find((c) => c.id === identity.contactId) ?? null;
      return contact ? { contact, identity } : null;
    },
    insertContactWithIdentity: async (_workspaceId, contact, identity) => {
      store.contacts.push(contact);
      store.identities.push(identity);
    },
  };

  const conversations: ConversationRepository = {
    findLatestOpen: async (workspaceId, contactId, channelId) => {
      const open = store.conversations.filter(
        (c) =>
          c.workspaceId === workspaceId &&
          c.contactId === contactId &&
          c.channelId === channelId &&
          c.status === 'open',
      );
      return open.at(-1) ?? null;
    },
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
      // จำลอง partial unique (workspace_id, external_id): external_id non-null ซ้ำ = redelivery → no-op
      if (
        message.externalId !== null &&
        store.messages.some(
          (m) => m.workspaceId === message.workspaceId && m.externalId === message.externalId,
        )
      ) {
        return { inserted: false };
      }
      store.messages.push(message);
      return { inserted: true };
    },
    updateStatus: async () => {},
  };

  const events: EventBus = {
    publish: async (event) => {
      store.events.push(event);
    },
  };

  let idCounter = 0;
  const generateId: IdGenerator = (prefix) => makeId(prefix, `t${(idCounter += 1)}`);

  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++));

  const deps: IngestInboundDeps = { contacts, conversations, messages, events, generateId, now };
  return { store, deps, ingest: createIngestInboundMessage(deps) };
}

const baseCommand: IngestInboundCommand = {
  workspaceId: 'ws_1',
  channelId: 'chn_web',
  externalId: 'visitor-1',
  content: { type: 'text', text: 'สวัสดีครับ' },
};

describe('ingestInboundMessage', () => {
  it('ข้อความแรกจาก visitor ใหม่ → สร้าง contact + identity + conversation + message + publish event', async () => {
    const { store, ingest } = setup();

    const res = await ingest({ ...baseCommand, contactName: 'ลูกค้า A' });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.created).toEqual({ contact: true, conversation: true });
    expect(res.value.contact.displayName).toBe('ลูกค้า A');

    expect(store.contacts).toHaveLength(1);
    expect(store.identities).toHaveLength(1);
    expect(store.conversations).toHaveLength(1);
    expect(store.messages).toHaveLength(1);

    const [msg] = store.messages;
    expect(msg?.direction).toBe('inbound');
    expect(msg?.status).toBe('received');
    expect(msg?.sender).toEqual({ kind: 'contact', contactId: res.value.contact.id });
    expect(msg?.content).toEqual({ type: 'text', text: 'สวัสดีครับ' });

    // identity ผูกกับ key ช่องทางถูกต้อง
    expect(store.identities[0]?.externalId).toBe('visitor-1');
    expect(store.identities[0]?.contactId).toBe(res.value.contact.id);

    // event ครบ + ชี้ id ที่ถูกต้อง
    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({
      type: 'inbound_message.received',
      workspaceId: 'ws_1',
      channelId: 'chn_web',
      conversationId: res.value.conversation.id,
      contactId: res.value.contact.id,
      messageId: res.value.message.id,
    });
  });

  it('visitor เดิม + มี conversation open อยู่ → reuse contact & conversation, ต่อ message ในสายเดิม + เด้ง lastMessageAt', async () => {
    const { store, ingest } = setup();

    const first = await ingest(baseCommand);
    const second = await ingest({ ...baseCommand, content: { type: 'text', text: 'ข้อความสอง' } });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(second.value.created).toEqual({ contact: false, conversation: false });
    expect(second.value.conversation.id).toBe(first.value.conversation.id);

    expect(store.contacts).toHaveLength(1);
    expect(store.conversations).toHaveLength(1);
    expect(store.messages).toHaveLength(2);

    // lastMessageAt ถูกเด้งให้ใหม่กว่า createdAt (touch ทำงาน)
    const conv = store.conversations[0];
    expect(conv?.lastMessageAt.getTime()).toBeGreaterThan(conv?.createdAt.getTime() ?? 0);

    expect(store.events).toHaveLength(2);
  });

  it('visitor เดิมแต่ conversation ก่อนหน้าถูกปิด → reuse contact แต่เปิด conversation ใหม่', async () => {
    const { store, ingest } = setup();

    const first = await ingest(baseCommand);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // ปิดสายเดิม
    const conv = store.conversations.find((c) => c.id === first.value.conversation.id);
    if (conv) conv.status = 'closed';

    const again = await ingest({ ...baseCommand, content: { type: 'text', text: 'กลับมาใหม่' } });
    expect(again.ok).toBe(true);
    if (!again.ok) return;

    expect(again.value.created).toEqual({ contact: false, conversation: true });
    expect(again.value.conversation.id).not.toBe(first.value.conversation.id);

    expect(store.contacts).toHaveLength(1);
    expect(store.conversations).toHaveLength(2);
    expect(store.messages).toHaveLength(2);
  });

  it('visitor คนละคน (externalId ต่างกัน) → คนละ contact คนละ conversation', async () => {
    const { store, ingest } = setup();

    await ingest(baseCommand);
    await ingest({ ...baseCommand, externalId: 'visitor-2' });

    expect(store.contacts).toHaveLength(2);
    expect(store.conversations).toHaveLength(2);
    expect(store.messages).toHaveLength(2);
  });

  it('webhook redelivery (externalMessageId ซ้ำ) → dedup: ไม่ persist/ไม่ publish ซ้ำ (idempotent)', async () => {
    const { store, ingest } = setup();
    // จำลอง LINE: externalId = user id, externalMessageId = message id ที่ provider ส่งมา (unique)
    const lineCmd: IngestInboundCommand = {
      ...baseCommand,
      externalId: 'U-line-user',
      externalMessageId: 'linemsg-1',
    };

    const first = await ingest(lineCmd);
    const dup = await ingest(lineCmd); // provider ส่ง event เดิมซ้ำ

    expect(first.ok && dup.ok).toBe(true);
    if (!first.ok || !dup.ok) return;

    expect(first.value.deduped).toBe(false);
    expect(dup.value.deduped).toBe(true);

    // persist ครั้งเดียว — ไม่มี message/contact/conversation ซ้ำ
    expect(store.messages).toHaveLength(1);
    expect(store.contacts).toHaveLength(1);
    expect(store.conversations).toHaveLength(1);
    // event publish ครั้งเดียว → agent realtime ไม่เด้งซ้ำ
    expect(store.events).toHaveLength(1);
  });

  it('command ไม่ผ่าน validation (text ว่าง) → err invalid_command, ไม่แตะ store', async () => {
    const { store, ingest } = setup();

    const res = await ingest({ ...baseCommand, content: { type: 'text', text: '' } });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('invalid_command');

    expect(store.contacts).toHaveLength(0);
    expect(store.messages).toHaveLength(0);
    expect(store.events).toHaveLength(0);
  });
});
