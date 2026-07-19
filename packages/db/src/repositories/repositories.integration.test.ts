import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createIngestInboundMessage } from '@omni/domain';
import type { DomainEvent, IngestInboundDeps, Message } from '@omni/domain';
import { createDb } from '../client';
import type { DbHandle } from '../client';
import { createIdGenerator, systemClock } from '../id';
import { runMigrations } from '../migrate';
import {
  channels,
  contacts,
  conversations,
  contactIdentities,
  messages,
  workspaces,
} from '../schema';
import { createChannelRepository } from './channel-repository';
import { createContactRepository } from './contact-repository';
import { createConversationRepository } from './conversation-repository';
import { createMessageRepository } from './message-repository';
import { createWebRouteResolver } from './web-route-resolver';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://omni:omni_dev_only@localhost:5432/omni';

let handle: DbHandle;

beforeAll(async () => {
  handle = createDb(DATABASE_URL);
  await runMigrations(handle.db);
});

afterAll(async () => {
  await handle.close();
});

beforeEach(async () => {
  // ล้างทุกตาราง (cascade จาก workspaces) ก่อนแต่ละ test
  await handle.db.execute(sql`truncate table ${workspaces} restart identity cascade`);
});

/** seed workspace + web channel (เป็น FK ให้ identity/conversation/message) */
async function seed() {
  const gen = createIdGenerator();
  const workspaceId = gen('ws');
  const channelId = gen('chn');
  await handle.db.insert(workspaces).values({ id: workspaceId, name: 'WS ทดสอบ' });
  await handle.db
    .insert(channels)
    .values({ id: channelId, workspaceId, type: 'web', displayName: 'Web widget' });
  return { workspaceId, channelId };
}

/** wire ingest service กับ repo จริง + เก็บ event ที่ publish */
function makeIngest() {
  const published: DomainEvent[] = [];
  const deps: IngestInboundDeps = {
    contacts: createContactRepository(handle.db),
    conversations: createConversationRepository(handle.db),
    messages: createMessageRepository(handle.db),
    events: {
      publish: async (event) => {
        published.push(event);
      },
    },
    generateId: createIdGenerator(),
    now: systemClock,
  };
  return { ingest: createIngestInboundMessage(deps), published };
}

describe('@omni/db repositories + ingest (integration — ต้อง pnpm db:up)', () => {
  it('inbound ใหม่ → เขียน contact/identity/conversation/message ลง Postgres จริง + publish event + content round-trip', async () => {
    const { workspaceId, channelId } = await seed();
    const { ingest, published } = makeIngest();

    const res = await ingest({
      workspaceId,
      channelId,
      externalId: 'visitor-1',
      content: { type: 'text', text: 'สวัสดีจาก integration test' },
      contactName: 'ลูกค้าเทส',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.created).toEqual({ contact: true, conversation: true });

    const contactRows = await handle.db
      .select()
      .from(contacts)
      .where(eq(contacts.workspaceId, workspaceId));
    expect(contactRows).toHaveLength(1);
    expect(contactRows[0]?.displayName).toBe('ลูกค้าเทส');

    const identityRows = await handle.db
      .select()
      .from(contactIdentities)
      .where(eq(contactIdentities.workspaceId, workspaceId));
    expect(identityRows).toHaveLength(1);
    expect(identityRows[0]?.externalId).toBe('visitor-1');

    const msgRows = await handle.db
      .select()
      .from(messages)
      .where(eq(messages.workspaceId, workspaceId));
    expect(msgRows).toHaveLength(1);
    expect(msgRows[0]?.direction).toBe('inbound');
    expect(msgRows[0]?.status).toBe('received');
    // jsonb round-trip
    expect(msgRows[0]?.content).toEqual({ type: 'text', text: 'สวัสดีจาก integration test' });
    expect(msgRows[0]?.sender).toEqual({ kind: 'contact', contactId: res.value.contact.id });

    expect(published).toHaveLength(1);
    expect(published[0]?.type).toBe('inbound_message.received');
  });

  it('visitor เดิมส่งซ้ำ → resolve เจอของเดิม, reuse contact & conversation (persist จริง)', async () => {
    const { workspaceId, channelId } = await seed();
    const { ingest } = makeIngest();

    const first = await ingest({
      workspaceId,
      channelId,
      externalId: 'visitor-1',
      content: { type: 'text', text: 'ข้อความหนึ่ง' },
    });
    const second = await ingest({
      workspaceId,
      channelId,
      externalId: 'visitor-1',
      content: { type: 'text', text: 'ข้อความสอง' },
    });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.created).toEqual({ contact: false, conversation: false });
    expect(second.value.conversation.id).toBe(first.value.conversation.id);

    const contactRows = await handle.db
      .select()
      .from(contacts)
      .where(eq(contacts.workspaceId, workspaceId));
    const convRows = await handle.db
      .select()
      .from(conversations)
      .where(eq(conversations.workspaceId, workspaceId));
    const msgRows = await handle.db
      .select()
      .from(messages)
      .where(eq(messages.workspaceId, workspaceId));
    expect(contactRows).toHaveLength(1);
    expect(convRows).toHaveLength(1);
    expect(msgRows).toHaveLength(2);
  });

  it('conversation ถูกปิดแล้ว → visitor เดิมทักใหม่ = reuse contact แต่เปิด conversation ใหม่', async () => {
    const { workspaceId, channelId } = await seed();
    const { ingest } = makeIngest();

    const first = await ingest({
      workspaceId,
      channelId,
      externalId: 'visitor-1',
      content: { type: 'text', text: 'รอบแรก' },
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // ปิดสายใน DB จริง
    await handle.db
      .update(conversations)
      .set({ status: 'closed' })
      .where(eq(conversations.id, first.value.conversation.id));

    const again = await ingest({
      workspaceId,
      channelId,
      externalId: 'visitor-1',
      content: { type: 'text', text: 'กลับมาใหม่' },
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.created).toEqual({ contact: false, conversation: true });

    const contactRows = await handle.db
      .select()
      .from(contacts)
      .where(eq(contacts.workspaceId, workspaceId));
    const convRows = await handle.db
      .select()
      .from(conversations)
      .where(eq(conversations.workspaceId, workspaceId));
    expect(contactRows).toHaveLength(1);
    expect(convRows).toHaveLength(2);
  });
});

describe('@omni/db web routing repos (integration — ต้อง pnpm db:up)', () => {
  it('ChannelRepository.findPublicById → resolve workspace จาก channelId, unknown = null', async () => {
    const { workspaceId, channelId } = await seed();
    const repo = createChannelRepository(handle.db);

    const found = await repo.findPublicById(channelId);
    expect(found?.workspaceId).toBe(workspaceId);
    expect(found?.type).toBe('web');

    expect(await repo.findPublicById('chn_ไม่มีอยู่จริง')).toBeNull();
  });

  it('ConversationRepository.findById → scope workspace (ต่าง workspace = null)', async () => {
    const { workspaceId, channelId } = await seed();
    const { ingest } = makeIngest();
    const res = await ingest({
      workspaceId,
      channelId,
      externalId: 'visitor-1',
      content: { type: 'text', text: 'hi' },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const repo = createConversationRepository(handle.db);
    const conv = await repo.findById(workspaceId, res.value.conversation.id);
    expect(conv?.id).toBe(res.value.conversation.id);

    // workspace อื่นมองไม่เห็นสายนี้ (multi-tenant isolation)
    expect(await repo.findById('ws_tenant_อื่น', res.value.conversation.id)).toBeNull();
  });

  it('WebRouteResolver → outbound message (conversationId) → externalId (session) ของ contact บนช่องทาง', async () => {
    const { workspaceId, channelId } = await seed();
    const { ingest } = makeIngest();
    const res = await ingest({
      workspaceId,
      channelId,
      externalId: 'visitor-42',
      content: { type: 'text', text: 'hi' },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const resolve = createWebRouteResolver(handle.db);
    const outbound: Message = {
      ...res.value.message,
      id: 'msg_out_1',
      direction: 'outbound',
      sender: { kind: 'bot' },
    };
    expect(await resolve(outbound)).toBe('visitor-42');

    // conversation ไม่มีจริง → null (ไม่มีปลายทางให้ route)
    expect(await resolve({ ...outbound, conversationId: 'conv_ไม่มีจริง' })).toBeNull();
  });
});
