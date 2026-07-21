import { afterEach, describe, expect, it } from 'vitest';
import { createManageBotRules } from '@omni/domain';
import type {
  BotRule,
  BotRulePatch,
  BotRuleRepository,
  Channel,
  EntitlementModule,
  WorkspaceBotConfig,
  WorkspaceBotConfigRepository,
} from '@omni/domain';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import type { AppDeps } from '../deps';
import type { AuthService } from '../auth/service';

/**
 * routes จอจัดการ bot (Phase 6) — เน้น **ด่านสิทธิ์**: ไม่ล็อกอิน / ไม่ได้ซื้อโมดูล bot ต้องยิงไม่ผ่าน
 * business logic ของ CRUD ทดสอบที่ domain (manage-bot-rules.test.ts) + DB จริง (bot-admin-phase6.integration)
 */
const WS = 'ws_1';
const AGT = 'agt_1';
const AT = new Date(Date.UTC(2026, 0, 1));
const BEARER = { authorization: 'Bearer tok_valid' };

const auth: AuthService = {
  login: async () => null,
  authenticate: (token) => (token === 'tok_valid' ? { workspaceId: WS, agentId: AGT } : null),
};

const channel: Channel = {
  id: 'chn_web1',
  workspaceId: WS,
  type: 'web',
  displayName: 'Web',
  createdAt: AT,
};

function fakeRuleRepo(seed: BotRule[] = []): BotRuleRepository {
  const store = new Map(seed.map((r) => [r.id, r]));
  const own = (id: BotRule['id'], ws: BotRule['workspaceId']): BotRule | null => {
    const r = store.get(id);
    return r && r.workspaceId === ws ? r : null;
  };
  return {
    listEnabled: async () => [],
    listAll: async (ws) => [...store.values()].filter((r) => r.workspaceId === ws),
    findById: async (ws, id) => own(id, ws),
    insert: async (rule) => {
      store.set(rule.id, rule);
    },
    update: async (ws, id, patch: BotRulePatch) => {
      const current = own(id, ws);
      if (!current) return null;
      const next = { ...current, ...patch };
      store.set(id, next);
      return next;
    },
    remove: async (ws, id) => (own(id, ws) ? store.delete(id) : false),
  };
}

function fakeConfigRepo(seed?: WorkspaceBotConfig): WorkspaceBotConfigRepository {
  let current = seed;
  return {
    get: async (ws) => (current && current.workspaceId === ws ? current : null),
    upsert: async (config) => {
      current = config;
      return config;
    },
  };
}

/** deps เท่าที่ route ชุดนี้ใช้ — route อื่นแค่ถูก register (destructure ค่า undefined ได้ ไม่ถูกเรียก) */
function makeDeps(opts: { modules?: EntitlementModule[] | null; rules?: BotRule[] } = {}): AppDeps {
  const modules = opts.modules === undefined ? (['bot'] as EntitlementModule[]) : opts.modules;
  return {
    auth,
    session: { cookieName: 'session', secure: false, maxAgeSec: 3600, allowedOrigins: [] },
    entitlements: {
      get: async (ws: BotRule['workspaceId']) =>
        modules === null ? null : { workspaceId: ws, modules },
    },
    manageBotRules: createManageBotRules({
      rules: fakeRuleRepo(opts.rules),
      config: fakeConfigRepo(),
      channels: { findPublicById: async (id) => (id === channel.id ? channel : null) },
      generateId: ((prefix: string) => `${prefix}_new`) as never,
      now: () => AT,
    }),
  } as unknown as AppDeps;
}

const seededRule: BotRule = {
  id: 'botr_1',
  workspaceId: WS,
  channelId: null,
  matchType: 'contains',
  pattern: 'สวัสดี',
  action: { kind: 'reply', content: { type: 'text', text: 'hi' } },
  enabled: true,
  priority: 10,
  createdAt: AT,
};

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('bot admin routes — ด่านสิทธิ์ (Phase 6)', () => {
  it('ไม่ล็อกอิน → 401 ทุก route', async () => {
    app = await buildApp(makeDeps());
    for (const [method, url] of [
      ['GET', '/inbox/bot/rules'],
      ['POST', '/inbox/bot/rules'],
      ['GET', '/inbox/bot/config'],
      ['PUT', '/inbox/bot/config'],
    ] as const) {
      const res = await app.inject({ method, url, payload: {} });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it('ล็อกอินแล้วแต่ไม่ได้ซื้อโมดูล bot → 403 entitlement_required (ยิง API ตรงก็ไม่ผ่าน)', async () => {
    app = await buildApp(makeDeps({ modules: [], rules: [seededRule] }));
    const res = await app.inject({ method: 'GET', url: '/inbox/bot/rules', headers: BEARER });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'entitlement_required', module: 'bot' });
  });

  it('ไม่มี entitlement row เลย → 403 (fail-closed)', async () => {
    app = await buildApp(makeDeps({ modules: null }));
    const res = await app.inject({ method: 'POST', url: '/inbox/bot/rules', headers: BEARER });
    expect(res.statusCode).toBe(403);
  });
});

describe('bot admin routes — CRUD (ซื้อโมดูล bot แล้ว)', () => {
  it('GET /inbox/bot/rules → 200 + rules (createdAt เป็น ISO string)', async () => {
    app = await buildApp(makeDeps({ rules: [seededRule] }));
    const res = await app.inject({ method: 'GET', url: '/inbox/bot/rules', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { rules: Array<{ id: string; createdAt: string }> };
    expect(body.rules).toHaveLength(1);
    expect(body.rules[0]).toMatchObject({ id: 'botr_1', pattern: 'สวัสดี', enabled: true });
    expect(typeof body.rules[0]?.createdAt).toBe('string');
  });

  it('POST /inbox/bot/rules → 200 + rule ใหม่ (workspace มาจาก token ไม่ใช่ body)', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/inbox/bot/rules',
      headers: BEARER,
      payload: {
        pattern: 'ราคา',
        action: { kind: 'reply', content: { type: 'text', text: 'ดูที่เว็บครับ' } },
        priority: 20,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ rule: { pattern: 'ราคา', priority: 20, enabled: true } });
  });

  it('POST: body ผิด (pattern ว่าง) → 400 invalid_body', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/inbox/bot/rules',
      headers: BEARER,
      payload: { pattern: '', action: { kind: 'escalate' } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_body' });
  });

  it('PATCH: ปิด rule → 200 · rule ที่ไม่มี → 404', async () => {
    app = await buildApp(makeDeps({ rules: [seededRule] }));
    const ok = await app.inject({
      method: 'PATCH',
      url: '/inbox/bot/rules/botr_1',
      headers: BEARER,
      payload: { enabled: false },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ rule: { enabled: false } });

    const missing = await app.inject({
      method: 'PATCH',
      url: '/inbox/bot/rules/botr_ghost',
      headers: BEARER,
      payload: { enabled: false },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: 'bot_rule_not_found' });
  });

  it('DELETE: ลบได้ → 200 · ลบซ้ำ → 404', async () => {
    app = await buildApp(makeDeps({ rules: [seededRule] }));
    const first = await app.inject({
      method: 'DELETE',
      url: '/inbox/bot/rules/botr_1',
      headers: BEARER,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ deleted: 'botr_1' });

    const second = await app.inject({
      method: 'DELETE',
      url: '/inbox/bot/rules/botr_1',
      headers: BEARER,
    });
    expect(second.statusCode).toBe(404);
  });

  it('config: GET default ปิดทั้งคู่ → PUT เปิด bot → GET เห็นค่าใหม่', async () => {
    app = await buildApp(makeDeps());
    const before = await app.inject({ method: 'GET', url: '/inbox/bot/config', headers: BEARER });
    expect(before.json()).toEqual({
      config: { workspaceId: WS, botEnabled: false, aiEnabled: false },
    });

    const put = await app.inject({
      method: 'PUT',
      url: '/inbox/bot/config',
      headers: BEARER,
      payload: { botEnabled: true, aiEnabled: false },
    });
    expect(put.statusCode).toBe(200);

    const after = await app.inject({ method: 'GET', url: '/inbox/bot/config', headers: BEARER });
    expect(after.json()).toMatchObject({ config: { botEnabled: true, aiEnabled: false } });
  });

  it('PATCH: ผูก channel ของ workspace อื่น → 400 channel_not_found', async () => {
    app = await buildApp(makeDeps({ rules: [seededRule] }));
    const res = await app.inject({
      method: 'PATCH',
      url: '/inbox/bot/rules/botr_1',
      headers: BEARER,
      payload: { channelId: 'chn_foreign' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'channel_not_found' });
  });
});
