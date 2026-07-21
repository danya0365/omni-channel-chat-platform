import { describe, expect, it } from 'vitest';
import type { BotRule } from '../schema/bot-rule';
import type { Channel } from '../schema/channel';
import type { WorkspaceBotConfig } from '../schema/workspace-bot-config';
import type { BotRulePatch, BotRuleRepository, WorkspaceBotConfigRepository } from '../ports';
import { createManageBotRules } from './manage-bot-rules';

const WS = 'ws_1';
const OTHER_WS = 'ws_2';
const CHN = 'chn_web1';
const FOREIGN_CHN = 'chn_other';
const AT = new Date(Date.UTC(2026, 0, 1));

const channel = (id: Channel['id'], workspaceId: Channel['workspaceId']): Channel => ({
  id,
  workspaceId,
  type: 'web',
  displayName: 'Web',
  createdAt: AT,
});

const existingRule = (over: Partial<BotRule> = {}): BotRule => ({
  id: 'botr_1',
  workspaceId: WS,
  channelId: null,
  matchType: 'contains',
  pattern: 'สวัสดี',
  action: { kind: 'reply', content: { type: 'text', text: 'hi' } },
  enabled: true,
  priority: 10,
  createdAt: AT,
  ...over,
});

/** in-memory repo — จำลอง scope workspace เหมือน SQL where (ลืม scope = data leak ข้าม tenant) */
function fakeRules(seed: BotRule[] = []) {
  const store = new Map(seed.map((r) => [r.id, r]));
  const inWorkspace = (r: BotRule | undefined, ws: string): BotRule | null =>
    r && r.workspaceId === ws ? r : null;
  const repo: BotRuleRepository = {
    listEnabled: async () => [],
    listAll: async (ws) =>
      [...store.values()]
        .filter((r) => r.workspaceId === ws)
        .sort((a, b) => a.priority - b.priority),
    findById: async (ws, id) => inWorkspace(store.get(id), ws),
    insert: async (rule) => {
      store.set(rule.id, rule);
    },
    update: async (ws, id, patch: BotRulePatch) => {
      const current = inWorkspace(store.get(id), ws);
      if (!current) return null;
      const next = { ...current, ...patch };
      store.set(id, next);
      return next;
    },
    remove: async (ws, id) => {
      if (!inWorkspace(store.get(id), ws)) return false;
      store.delete(id);
      return true;
    },
  };
  return { repo, store };
}

function fakeConfig(seed?: WorkspaceBotConfig) {
  let current = seed;
  const repo: WorkspaceBotConfigRepository = {
    get: async (ws) => (current && current.workspaceId === ws ? current : null),
    upsert: async (config) => {
      current = config;
      return config;
    },
  };
  return repo;
}

function setup(seed: BotRule[] = [], config?: WorkspaceBotConfig) {
  const { repo, store } = fakeRules(seed);
  const manage = createManageBotRules({
    rules: repo,
    config: fakeConfig(config),
    channels: {
      findPublicById: async (id) =>
        id === CHN ? channel(CHN, WS) : id === FOREIGN_CHN ? channel(FOREIGN_CHN, OTHER_WS) : null,
    },
    generateId: ((prefix: string) => `${prefix}_new`) as never,
    now: () => AT,
  });
  return { manage, store };
}

describe('createManageBotRules (Phase 6 · จอจัดการ bot)', () => {
  it('create: rule global (channelId=null) → บันทึกพร้อม id/createdAt ที่ระบบออกให้', async () => {
    const { manage, store } = setup();
    const result = await manage.create({
      workspaceId: WS,
      pattern: 'ราคา',
      action: { kind: 'reply', content: { type: 'text', text: 'ดูที่เว็บครับ' } },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      id: 'botr_new',
      workspaceId: WS,
      channelId: null, // default
      matchType: 'contains', // default
      enabled: true, // default
      priority: 100, // default
      pattern: 'ราคา',
      createdAt: AT,
    });
    expect(store.get('botr_new')).toBeDefined();
  });

  it('create: ผูก channel ของ workspace ตัวเอง → ผ่าน', async () => {
    const { manage } = setup();
    const result = await manage.create({
      workspaceId: WS,
      channelId: CHN,
      pattern: 'x',
      action: { kind: 'escalate' },
    });
    expect(result.ok).toBe(true);
  });

  it('create: ผูก channel ของ workspace อื่น → channel_not_found (กันผูกข้าม tenant)', async () => {
    const { manage, store } = setup();
    const result = await manage.create({
      workspaceId: WS,
      channelId: FOREIGN_CHN,
      pattern: 'x',
      action: { kind: 'escalate' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('channel_not_found');
    expect(store.size).toBe(0); // ไม่เขียนอะไรลง repo
  });

  it('create: pattern ว่าง → invalid_command', async () => {
    const { manage } = setup();
    const result = await manage.create({
      workspaceId: WS,
      pattern: '   ',
      action: { kind: 'escalate' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_command');
  });

  it('list: คืนเฉพาะ rule ของ workspace นั้น เรียง priority (รวมที่ปิดอยู่)', async () => {
    const { manage } = setup([
      existingRule({ id: 'botr_b', priority: 20, enabled: false }),
      existingRule({ id: 'botr_a', priority: 5 }),
      existingRule({ id: 'botr_other', workspaceId: OTHER_WS }),
    ]);
    const list = await manage.list(WS);
    expect(list.map((r) => r.id)).toEqual(['botr_a', 'botr_b']);
  });

  it('update: ปิด rule (enabled=false) → คืนค่าใหม่ · field ที่ไม่ส่งไม่ถูกแตะ', async () => {
    const { manage } = setup([existingRule()]);
    const result = await manage.update({ workspaceId: WS, ruleId: 'botr_1', enabled: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.enabled).toBe(false);
    expect(result.value.pattern).toBe('สวัสดี'); // ไม่ส่ง = ไม่แตะ
  });

  it('update: rule ของ workspace อื่น → bot_rule_not_found (ไม่รั่วข้าม tenant)', async () => {
    const { manage } = setup([existingRule({ workspaceId: OTHER_WS })]);
    const result = await manage.update({ workspaceId: WS, ruleId: 'botr_1', enabled: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('bot_rule_not_found');
  });

  it('update: ย้ายไป channel ของ workspace อื่น → channel_not_found', async () => {
    const { manage } = setup([existingRule()]);
    const result = await manage.update({
      workspaceId: WS,
      ruleId: 'botr_1',
      channelId: FOREIGN_CHN,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('channel_not_found');
  });

  it('remove: ลบของตัวเอง → ok · ลบของ workspace อื่น → bot_rule_not_found', async () => {
    const { manage, store } = setup([
      existingRule(),
      existingRule({ id: 'botr_x', workspaceId: OTHER_WS }),
    ]);
    expect((await manage.remove({ workspaceId: WS, ruleId: 'botr_1' })).ok).toBe(true);
    expect(store.has('botr_1')).toBe(false);

    const foreign = await manage.remove({ workspaceId: WS, ruleId: 'botr_x' });
    expect(foreign.ok).toBe(false);
    expect(store.has('botr_x')).toBe(true); // ยังอยู่
  });

  it('getConfig: ไม่มี row → ปิดทั้งคู่ (fail-closed) · setConfig แล้วอ่านได้ค่าใหม่', async () => {
    const { manage } = setup();
    expect(await manage.getConfig(WS)).toEqual({
      workspaceId: WS,
      botEnabled: false,
      aiEnabled: false,
    });

    const saved = await manage.setConfig({ workspaceId: WS, botEnabled: true, aiEnabled: false });
    expect(saved.ok).toBe(true);
    expect(await manage.getConfig(WS)).toMatchObject({ botEnabled: true, aiEnabled: false });
  });
});
