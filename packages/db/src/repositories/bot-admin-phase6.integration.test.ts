import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createManageBotRules } from '@omni/domain';
import type { BotRule } from '@omni/domain';
import { createDb } from '../client';
import type { DbHandle } from '../client';
import { createIdGenerator } from '../id';
import { runMigrations } from '../migrate';
import { botRules, channels, workspaces } from '../schema';
import { createBotRuleRepository } from './bot-rule-repository';
import { createChannelRepository } from './channel-repository';
import { createWorkspaceBotConfigRepository } from './workspace-bot-config-repository';

/**
 * Phase 6 — จอจัดการ bot (CRUD rules + สวิตช์) บน Postgres จริง
 * เน้นสิ่งที่ unit test (in-memory) พิสูจน์ไม่ได้: scope workspace ใน SQL where จริง + upsert + cascade
 */
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

function manageFor() {
  return createManageBotRules({
    rules: createBotRuleRepository(handle.db),
    config: createWorkspaceBotConfigRepository(handle.db),
    channels: createChannelRepository(handle.db),
    generateId: gen,
    now: () => new Date(),
  });
}

async function seedWorkspace(name: string) {
  const workspaceId = gen('ws');
  const channelId = gen('chn');
  await handle.db.insert(workspaces).values({ id: workspaceId, name });
  await handle.db
    .insert(channels)
    .values({ id: channelId, workspaceId, type: 'web', displayName: 'Web' });
  return { workspaceId, channelId };
}

const reply = (text: string): BotRule['action'] => ({
  kind: 'reply',
  content: { type: 'text', text },
});

describe('Phase 6 bot admin (integration — ต้อง pnpm db:up)', () => {
  it('create → list → update → remove ครบวง (persist จริงลง Postgres)', async () => {
    const { workspaceId, channelId } = await seedWorkspace('WS admin');
    const manage = manageFor();

    const created = await manage.create({
      workspaceId,
      channelId,
      pattern: 'ราคา',
      action: reply('ดูราคาที่เว็บครับ'),
      priority: 20,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const listed = await manage.list(workspaceId);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ pattern: 'ราคา', channelId, priority: 20, enabled: true });

    // ปิด rule → listEnabled (ที่ bot ใช้) ต้องไม่เห็น แต่ list (จอ admin) ยังเห็น
    const updated = await manage.update({
      workspaceId,
      ruleId: created.value.id,
      enabled: false,
      pattern: 'ค่าบริการ',
    });
    expect(updated.ok).toBe(true);
    expect(await createBotRuleRepository(handle.db).listEnabled(workspaceId, channelId)).toEqual(
      [],
    );
    expect(await manage.list(workspaceId)).toHaveLength(1);
    expect((await manage.list(workspaceId))[0]).toMatchObject({
      pattern: 'ค่าบริการ',
      enabled: false,
    });

    const removed = await manage.remove({ workspaceId, ruleId: created.value.id });
    expect(removed.ok).toBe(true);
    expect(await manage.list(workspaceId)).toEqual([]);
  });

  it('ไม่รั่วข้าม tenant — list/update/remove ของ workspace อื่นไม่ติด', async () => {
    const a = await seedWorkspace('WS A');
    const b = await seedWorkspace('WS B');
    const manage = manageFor();

    const ruleOfB = await manage.create({
      workspaceId: b.workspaceId,
      pattern: 'ของ B',
      action: reply('B'),
    });
    expect(ruleOfB.ok).toBe(true);
    if (!ruleOfB.ok) return;

    expect(await manage.list(a.workspaceId)).toEqual([]); // A มองไม่เห็นของ B

    const crossUpdate = await manage.update({
      workspaceId: a.workspaceId,
      ruleId: ruleOfB.value.id,
      enabled: false,
    });
    expect(crossUpdate.ok).toBe(false);
    if (!crossUpdate.ok) expect(crossUpdate.error.code).toBe('bot_rule_not_found');

    const crossRemove = await manage.remove({
      workspaceId: a.workspaceId,
      ruleId: ruleOfB.value.id,
    });
    expect(crossRemove.ok).toBe(false);

    // ของ B ยังอยู่ครบ + ยังเปิดอยู่
    const stillThere = await manage.list(b.workspaceId);
    expect(stillThere).toHaveLength(1);
    expect(stillThere[0]?.enabled).toBe(true);
  });

  it('ผูก rule กับ channel ของ workspace อื่น → channel_not_found (ไม่เขียนลง DB)', async () => {
    const a = await seedWorkspace('WS A');
    const b = await seedWorkspace('WS B');
    const manage = manageFor();

    const result = await manage.create({
      workspaceId: a.workspaceId,
      channelId: b.channelId, // ช่องของคนอื่น
      pattern: 'x',
      action: { kind: 'escalate' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('channel_not_found');
    expect(await manage.list(a.workspaceId)).toEqual([]);
  });

  it('config upsert — ไม่มี row → สร้าง · เรียกซ้ำ → อัปเดตค่าเดิม (ไม่ duplicate)', async () => {
    const { workspaceId } = await seedWorkspace('WS config');
    const manage = manageFor();

    expect(await manage.getConfig(workspaceId)).toEqual({
      workspaceId,
      botEnabled: false,
      aiEnabled: false,
    });

    await manage.setConfig({ workspaceId, botEnabled: true, aiEnabled: false });
    expect(await manage.getConfig(workspaceId)).toMatchObject({
      botEnabled: true,
      aiEnabled: false,
    });

    await manage.setConfig({ workspaceId, botEnabled: true, aiEnabled: true });
    expect(await manage.getConfig(workspaceId)).toMatchObject({
      botEnabled: true,
      aiEnabled: true,
    });
  });

  it('ลบ workspace → rules ตามไปด้วย (cascade)', async () => {
    const { workspaceId } = await seedWorkspace('WS cascade');
    const manage = manageFor();
    await manage.create({ workspaceId, pattern: 'x', action: { kind: 'escalate' } });

    await handle.db.delete(workspaces).where(sql`${workspaces.id} = ${workspaceId}`);
    const rows = await handle.db
      .select()
      .from(botRules)
      .where(sql`${botRules.workspaceId} = ${workspaceId}`);
    expect(rows).toEqual([]);
  });
});
