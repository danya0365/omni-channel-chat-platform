import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import type { ChannelId, Conversation, ContactId, Message, WorkspaceId } from '@omni/domain';
import { createDb } from '../client';
import type { DbHandle } from '../client';
import { createIdGenerator, uuidv7 } from '../id';
import { runMigrations } from '../migrate';
import { agents, channels, contacts, conversations, messages, workspaces } from '../schema';
import { createAgentRepository } from './agent-repository';
import { createInboxReadRepository } from './inbox-read-repository';
import { createMessageRepository } from './message-repository';
import { createOutboxEventBus, createOutboxStore } from './outbox';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://omni:omni_dev_only@localhost:5432/omni';

let handle: DbHandle;
const gen = createIdGenerator();

beforeAll(async () => {
  handle = createDb(DATABASE_URL);
  await runMigrations(handle.db);
});

afterAll(async () => {
  await handle.close();
});

beforeEach(async () => {
  await handle.db.execute(sql`truncate table ${workspaces} restart identity cascade`);
});

interface Base {
  workspaceId: WorkspaceId;
  channelId: ChannelId;
  contactId: ContactId;
}

/** seed workspace + channel + contact (FK ให้ conversation/message/agent) */
async function seedBase(): Promise<Base> {
  const workspaceId = gen('ws');
  const channelId = gen('chn');
  const contactId = gen('ctc');
  await handle.db.insert(workspaces).values({ id: workspaceId, name: 'WS ทดสอบ' });
  await handle.db
    .insert(channels)
    .values({ id: channelId, workspaceId, type: 'web', displayName: 'Web widget' });
  await handle.db.insert(contacts).values({ id: contactId, workspaceId, displayName: 'ลูกค้าเทส' });
  return { workspaceId, channelId, contactId };
}

/** insert conversation ตรงๆ (คุม lastMessageAt เพื่อทดสอบ order) */
async function insertConversation(base: Base, lastMessageAt: Date): Promise<Conversation> {
  const conv: Conversation = {
    id: gen('conv'),
    workspaceId: base.workspaceId,
    contactId: base.contactId,
    channelId: base.channelId,
    status: 'open',
    assignee: null,
    createdAt: lastMessageAt,
    lastMessageAt,
  };
  await handle.db.insert(conversations).values(conv);
  return conv;
}

async function insertMessage(
  base: Base,
  conversationId: Conversation['id'],
  text: string,
  direction: 'inbound' | 'outbound',
  createdAt: Date,
): Promise<Message> {
  const msg: Message = {
    id: gen('msg'),
    workspaceId: base.workspaceId,
    conversationId,
    channelId: base.channelId,
    direction,
    sender:
      direction === 'inbound' ? { kind: 'contact', contactId: base.contactId } : { kind: 'bot' },
    content: { type: 'text', text },
    status: direction === 'inbound' ? 'received' : 'sent',
    externalId: null,
    createdAt,
  };
  await handle.db.insert(messages).values(msg);
  return msg;
}

describe('AgentRepository (integration — ต้อง pnpm db:up)', () => {
  it('findCredentialByEmail → คืน agent + hash · entity ไม่พก passwordHash', async () => {
    const { workspaceId } = await seedBase();
    const agentId = gen('agt');
    await handle.db.insert(agents).values({
      id: agentId,
      workspaceId,
      email: 'agent@example.com',
      passwordHash: 'hash_ปลอม_สำหรับเทส',
      displayName: 'ทีมงาน A',
    });

    const repo = createAgentRepository(handle.db);
    const cred = await repo.findCredentialByEmail('agent@example.com');
    expect(cred?.passwordHash).toBe('hash_ปลอม_สำหรับเทส');
    expect(cred?.agent.id).toBe(agentId);
    // entity ที่คืนมาต้องไม่มี field passwordHash (zod strip)
    expect((cred?.agent as Record<string, unknown>).passwordHash).toBeUndefined();

    expect(await repo.findCredentialByEmail('ไม่มี@example.com')).toBeNull();
  });

  it('findById → scope workspace (workspace อื่นมองไม่เห็น)', async () => {
    const { workspaceId } = await seedBase();
    const agentId = gen('agt');
    await handle.db.insert(agents).values({
      id: agentId,
      workspaceId,
      email: 'a@example.com',
      passwordHash: 'h',
      displayName: 'A',
    });

    const repo = createAgentRepository(handle.db);
    expect((await repo.findById(workspaceId, agentId))?.id).toBe(agentId);
    expect(await repo.findById('ws_tenant_อื่น', agentId)).toBeNull();
  });
});

describe('InboxReadRepository (integration — ต้อง pnpm db:up)', () => {
  it('listConversations → เรียงใหม่→เก่า + ชื่อ contact + ข้อความล่าสุด', async () => {
    const base = await seedBase();
    const older = await insertConversation(base, new Date(Date.UTC(2026, 0, 1, 10, 0, 0)));
    const newer = await insertConversation(base, new Date(Date.UTC(2026, 0, 1, 12, 0, 0)));
    await insertMessage(
      base,
      older.id,
      'สายเก่า-ล่าสุด',
      'inbound',
      new Date(Date.UTC(2026, 0, 1, 10, 0, 0)),
    );
    await insertMessage(
      base,
      newer.id,
      'สายใหม่-เก่ากว่า',
      'inbound',
      new Date(Date.UTC(2026, 0, 1, 11, 0, 0)),
    );
    await insertMessage(
      base,
      newer.id,
      'สายใหม่-ล่าสุด',
      'outbound',
      new Date(Date.UTC(2026, 0, 1, 11, 30, 0)),
    );

    const repo = createInboxReadRepository(handle.db);
    const list = await repo.listConversations(base.workspaceId, { limit: 10 });

    expect(list).toHaveLength(2);
    // newer อยู่บนสุด (lastMessageAt ใหม่กว่า)
    expect(list[0]?.conversation.id).toBe(newer.id);
    expect(list[0]?.contactName).toBe('ลูกค้าเทส');
    expect(list[0]?.lastMessage?.content).toEqual({ type: 'text', text: 'สายใหม่-ล่าสุด' });
    expect(list[0]?.lastMessage?.direction).toBe('outbound');
    expect(list[1]?.conversation.id).toBe(older.id);
    expect(list[1]?.lastMessage?.content).toEqual({ type: 'text', text: 'สายเก่า-ล่าสุด' });
  });

  it('listMessages → เรียงใหม่→เก่า + scope workspace', async () => {
    const base = await seedBase();
    const conv = await insertConversation(base, new Date(Date.UTC(2026, 0, 1, 10, 0, 0)));
    await insertMessage(
      base,
      conv.id,
      'ข้อความ 1',
      'inbound',
      new Date(Date.UTC(2026, 0, 1, 10, 0, 0)),
    );
    await insertMessage(
      base,
      conv.id,
      'ข้อความ 2',
      'outbound',
      new Date(Date.UTC(2026, 0, 1, 10, 1, 0)),
    );

    const repo = createInboxReadRepository(handle.db);
    const msgs = await repo.listMessages(base.workspaceId, conv.id, { limit: 10 });
    expect(msgs.map((m) => (m.content.type === 'text' ? m.content.text : ''))).toEqual([
      'ข้อความ 2',
      'ข้อความ 1',
    ]);

    // workspace อื่นมองไม่เห็น
    expect(await repo.listMessages('ws_อื่น', conv.id, { limit: 10 })).toHaveLength(0);
  });
});

describe('Outbox (integration — ต้อง pnpm db:up)', () => {
  it('transactional: message insert + outbox publish ใน tx เดียว → commit พร้อมกัน', async () => {
    const base = await seedBase();
    const conv = await insertConversation(base, new Date(Date.UTC(2026, 0, 1, 10, 0, 0)));
    const messageId = gen('msg');
    const occurredAt = new Date(Date.UTC(2026, 0, 1, 10, 5, 0));

    await handle.db.transaction(async (tx) => {
      const msgRepo = createMessageRepository(tx);
      const events = createOutboxEventBus(tx, uuidv7);
      await msgRepo.insert(base.workspaceId, {
        id: messageId,
        workspaceId: base.workspaceId,
        conversationId: conv.id,
        channelId: base.channelId,
        direction: 'outbound',
        sender: { kind: 'bot' },
        content: { type: 'text', text: 'ตอบกลับ' },
        status: 'sent',
        externalId: null,
        createdAt: occurredAt,
      });
      await events.publish({
        type: 'outbound_message.sent',
        workspaceId: base.workspaceId,
        channelId: base.channelId,
        conversationId: conv.id,
        messageId,
        occurredAt,
      });
    });

    // ทั้ง message และ outbox row ต้อง commit
    expect(await handle.db.select().from(messages).where(eq(messages.id, messageId))).toHaveLength(
      1,
    );

    const store = createOutboxStore(handle.db);
    const unprocessed = await store.fetchUnprocessed(10);
    expect(unprocessed).toHaveLength(1);
    expect(unprocessed[0]?.type).toBe('outbound_message.sent');
    expect(unprocessed[0]?.payload.messageId).toBe(messageId);
    // occurredAt เก็บ JSON-safe ใน payload (ISO string)
    expect(unprocessed[0]?.payload.occurredAt).toBe(occurredAt.toISOString());
  });

  it('markProcessed → หายจาก fetchUnprocessed', async () => {
    const base = await seedBase();
    await handle.db.transaction(async (tx) => {
      await createOutboxEventBus(tx).publish({
        type: 'inbound_message.received',
        workspaceId: base.workspaceId,
        channelId: base.channelId,
        conversationId: gen('conv'),
        contactId: base.contactId,
        messageId: gen('msg'),
        conversationCreated: true,
        occurredAt: new Date(Date.UTC(2026, 0, 1)),
      });
    });

    const store = createOutboxStore(handle.db);
    const rows = await store.fetchUnprocessed(10);
    expect(rows).toHaveLength(1);

    await store.markProcessed(
      rows.map((r) => r.id),
      new Date(Date.UTC(2026, 0, 2)),
    );
    expect(await store.fetchUnprocessed(10)).toHaveLength(0);
  });
});
