import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import type { Conversation } from '@omni/domain';
import { createDb } from '../client';
import type { DbHandle } from '../client';
import { createIdGenerator } from '../id';
import { runMigrations } from '../migrate';
import { channels, contacts, conversations, messages, workspaces } from '../schema';
import { createConversationRepository } from './conversation-repository';
import { createInboxReadRepository } from './inbox-read-repository';

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

async function seedConversation(): Promise<Conversation> {
  const workspaceId = gen('ws');
  const channelId = gen('chn');
  const contactId = gen('ctc');
  const conversationId = gen('conv');
  await handle.db.insert(workspaces).values({ id: workspaceId, name: 'WS routing' });
  await handle.db
    .insert(channels)
    .values({ id: channelId, workspaceId, type: 'web', displayName: 'Web' });
  await handle.db.insert(contacts).values({ id: contactId, workspaceId, displayName: 'ลูกค้า R' });
  const conv: Conversation = {
    id: conversationId,
    workspaceId,
    contactId,
    channelId,
    status: 'open',
    assignee: null,
    createdAt: new Date(Date.UTC(2026, 0, 1)),
    lastMessageAt: new Date(Date.UTC(2026, 0, 1)),
  };
  await handle.db.insert(conversations).values(conv);
  await handle.db.insert(messages).values({
    id: gen('msg'),
    workspaceId,
    conversationId,
    channelId,
    direction: 'inbound',
    sender: { kind: 'contact', contactId },
    content: { type: 'text', text: 'ทักมา' },
    status: 'received',
    externalId: null,
    createdAt: new Date(Date.UTC(2026, 0, 1, 1)),
  });
  return conv;
}

describe('Phase 4 routing repo (integration — ต้อง pnpm db:up)', () => {
  it('setAssignee → row assignee อัปเดตจริง · getConversationListItem สะท้อน', async () => {
    const conv = await seedConversation();
    const repo = createConversationRepository(handle.db);
    const agentId = gen('agt');

    await repo.setAssignee(conv.workspaceId, conv.id, { kind: 'agent', agentId });
    const rows = await handle.db.select().from(conversations).where(eq(conversations.id, conv.id));
    expect(rows[0]?.assignee).toEqual({ kind: 'agent', agentId });

    const read = createInboxReadRepository(handle.db);
    const item = await read.getConversationListItem(conv.workspaceId, conv.id);
    expect(item?.conversation.assignee).toEqual({ kind: 'agent', agentId });
    expect(item?.contactName).toBe('ลูกค้า R');
    expect(item?.lastMessage?.content).toEqual({ type: 'text', text: 'ทักมา' });

    // unassign
    await repo.setAssignee(conv.workspaceId, conv.id, null);
    const item2 = await read.getConversationListItem(conv.workspaceId, conv.id);
    expect(item2?.conversation.assignee).toBeNull();
  });

  it('setStatus → open/closed อัปเดตจริง', async () => {
    const conv = await seedConversation();
    const repo = createConversationRepository(handle.db);

    await repo.setStatus(conv.workspaceId, conv.id, 'closed');
    const rows = await handle.db.select().from(conversations).where(eq(conversations.id, conv.id));
    expect(rows[0]?.status).toBe('closed');
  });

  it('getConversationListItem → null ถ้าข้าม workspace (scope)', async () => {
    const conv = await seedConversation();
    const read = createInboxReadRepository(handle.db);
    expect(await read.getConversationListItem('ws_อื่น', conv.id)).toBeNull();
  });
});
