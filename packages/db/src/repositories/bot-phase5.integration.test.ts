import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createDb } from '../client';
import type { DbHandle } from '../client';
import { createIdGenerator } from '../id';
import { runMigrations } from '../migrate';
import {
  botRules,
  channels,
  outbox,
  outboxCursors,
  workspaceBotConfig,
  workspaces,
} from '../schema';
import { createBotRuleRepository } from './bot-rule-repository';
import { createOutboxCursorStore } from './outbox';
import { createWorkspaceBotConfigRepository } from './workspace-bot-config-repository';

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
  // outbox_cursors เป็น global (ไม่มี FK → workspaces) cascade ไม่ล้าง — ต้องล้างเองกัน cursor ค้างข้ามเทสต์
  await handle.db.execute(sql`truncate table ${outboxCursors}`);
});

async function seedWorkspaceWithChannels() {
  const workspaceId = gen('ws');
  const chnA = gen('chn');
  const chnB = gen('chn');
  await handle.db.insert(workspaces).values({ id: workspaceId, name: 'WS bot' });
  await handle.db.insert(channels).values([
    { id: chnA, workspaceId, type: 'web', displayName: 'Web A' },
    { id: chnB, workspaceId, type: 'line', displayName: 'LINE B' },
  ]);
  return { workspaceId, chnA, chnB };
}

const replyAction = (text: string) => ({ kind: 'reply', content: { type: 'text', text } }) as const;

describe('Phase 5 bot repos (integration — ต้อง pnpm db:up)', () => {
  it('listEnabled → รวม channel-specific + global เรียง priority · ตัด disabled/ช่องอื่น/ws อื่น', async () => {
    const { workspaceId, chnA, chnB } = await seedWorkspaceWithChannels();
    const otherWs = gen('ws');
    await handle.db.insert(workspaces).values({ id: otherWs, name: 'อื่น' });

    await handle.db.insert(botRules).values([
      {
        id: gen('botr'),
        workspaceId,
        channelId: null,
        matchType: 'contains',
        pattern: 'สวัสดี',
        action: replyAction('global'),
        enabled: true,
        priority: 10,
      },
      {
        id: gen('botr'),
        workspaceId,
        channelId: chnA,
        matchType: 'contains',
        pattern: 'ราคา',
        action: replyAction('chnA'),
        enabled: true,
        priority: 5,
      },
      {
        id: gen('botr'),
        workspaceId,
        channelId: chnB,
        matchType: 'contains',
        pattern: 'x',
        action: replyAction('chnB'),
        enabled: true,
        priority: 1,
      },
      {
        id: gen('botr'),
        workspaceId,
        channelId: chnA,
        matchType: 'contains',
        pattern: 'off',
        action: replyAction('disabled'),
        enabled: false,
        priority: 1,
      },
      {
        id: gen('botr'),
        workspaceId: otherWs,
        channelId: null,
        matchType: 'contains',
        pattern: 'y',
        action: replyAction('otherWs'),
        enabled: true,
        priority: 1,
      },
    ]);

    const repo = createBotRuleRepository(handle.db);
    const rules = await repo.listEnabled(workspaceId, chnA);

    // เหลือ chnA(pri5) + global(pri10) เรียง priority น้อย→มาก · ตัด chnB, disabled, otherWs
    expect(rules.map((r) => r.action)).toEqual([replyAction('chnA'), replyAction('global')]);
    expect(rules[0]?.pattern).toBe('ราคา');
    expect(rules[0]?.channelId).toBe(chnA);
    expect(rules[1]?.channelId).toBeNull();
  });

  it('claimBatch → อ่าน event หลัง cursor แล้ว advance · subscriber แยก cursor กัน · ไม่แตะ processed_at', async () => {
    const { workspaceId } = await seedWorkspaceWithChannels();

    const insertEvent = async (n: number) =>
      handle.db.insert(outbox).values({
        id: gen('msg').replace('msg_', 'obx_'),
        workspaceId,
        type: 'inbound_message.received',
        payload: { workspaceId, seq: n },
        occurredAt: new Date(Date.UTC(2026, 0, 1, 0, 0, n)),
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, n)),
      });
    for (const n of [1, 2, 3]) await insertEvent(n);

    const store = createOutboxCursorStore(handle.db);

    const first = await store.claimBatch('bot', 10);
    expect(first.map((r) => r.payload.seq)).toEqual([1, 2, 3]);

    // claim ซ้ำ → cursor advance แล้ว = ว่าง
    expect(await store.claimBatch('bot', 10)).toHaveLength(0);

    // event ใหม่เข้ามา → claim เห็นเฉพาะตัวใหม่
    await insertEvent(4);
    const next = await store.claimBatch('bot', 10);
    expect(next.map((r) => r.payload.seq)).toEqual([4]);

    // subscriber อื่น = cursor แยก → เห็นตั้งแต่ต้น (1..4)
    const other = await store.claimBatch('agent-x', 10);
    expect(other.map((r) => r.payload.seq)).toEqual([1, 2, 3, 4]);

    // cursor store ไม่แตะ processed_at ของ agent WS consumer เดิม (ยัง null ทุก row)
    const rows = await handle.db.select().from(outbox);
    expect(rows.every((r) => r.processedAt === null)).toBe(true);
  });

  it('claimBatch เคารพ limit (batch ทีละก้อน)', async () => {
    const { workspaceId } = await seedWorkspaceWithChannels();
    for (const n of [1, 2, 3, 4, 5]) {
      await handle.db.insert(outbox).values({
        id: gen('msg').replace('msg_', 'obx_'),
        workspaceId,
        type: 'inbound_message.received',
        payload: { workspaceId, seq: n },
        occurredAt: new Date(Date.UTC(2026, 0, 1, 0, 0, n)),
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, n)),
      });
    }
    const store = createOutboxCursorStore(handle.db);
    expect((await store.claimBatch('bot', 2)).map((r) => r.payload.seq)).toEqual([1, 2]);
    expect((await store.claimBatch('bot', 2)).map((r) => r.payload.seq)).toEqual([3, 4]);
    expect((await store.claimBatch('bot', 2)).map((r) => r.payload.seq)).toEqual([5]);
  });

  it('workspaceBotConfig.get → คืน config ที่มี (strip createdAt/updatedAt) · ไม่มี row = null', async () => {
    const { workspaceId } = await seedWorkspaceWithChannels();
    const repo = createWorkspaceBotConfigRepository(handle.db);

    // ยังไม่มี config → null (bot ปิด)
    expect(await repo.get(workspaceId)).toBeNull();

    await handle.db
      .insert(workspaceBotConfig)
      .values({ workspaceId, botEnabled: true, aiEnabled: false });
    expect(await repo.get(workspaceId)).toEqual({
      workspaceId,
      botEnabled: true,
      aiEnabled: false,
    });
  });
});
