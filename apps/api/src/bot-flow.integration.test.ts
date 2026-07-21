import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import {
  botRules,
  channels,
  conversations,
  createDb,
  createIdGenerator,
  messages,
  outboxCursors,
  runMigrations,
  workspaceBotConfig,
  workspaceEntitlements,
  workspaces,
} from '@omni/db';
import type { DbHandle } from '@omni/db';
import type { Assignee, EntitlementModule } from '@omni/domain';
import type { AnthropicFetch } from '@omni/bot-anthropic';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import { createContainer } from './wiring';
import type { Container } from './wiring';

/**
 * Bot automation e2e (integration — ต้อง pnpm db:up):
 *   inbound "สวัสดี" (web) → bot รับสาย (assignBot) + ตอบ canned จริงลง Postgres ผ่าน pipeline เต็ม
 *   → inbound "แอดมิน" → bot escalate (assignee=null) + แจ้งลูกค้า
 * พิสูจน์ bot consumer wired จริงใน container (trigger หลัง ingest · cursor 'bot' แยกจาก agent WS)
 */
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://omni:omni_dev_only@localhost:5432/omni';

let seedHandle: DbHandle;
let container: Container;
let app: FastifyInstance;
let baseUrl: string;
/** mutable AI fetch — test ตั้งก่อน trigger · default = ยอมแพ้ (escalate) · inject เข้า container (hermetic) */
let anthropicFetchImpl: AnthropicFetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    content: [{ type: 'text', text: '[[ESCALATE]]' }],
    stop_reason: 'end_turn',
  }),
});

beforeAll(async () => {
  seedHandle = createDb(DATABASE_URL);
  await runMigrations(seedHandle.db);
});

afterAll(async () => {
  await seedHandle.close();
});

beforeEach(async () => {
  await seedHandle.db.execute(sql`truncate table ${workspaces} restart identity cascade`);
  // outbox_cursors เป็น global (ไม่มี FK → workspaces) cascade ไม่ล้าง — reset กัน cursor 'bot' ค้างข้ามเทสต์
  await seedHandle.db.execute(sql`truncate table ${outboxCursors}`);
  // default AI = escalate (สาย aiEnabled=false ในเทสต์ส่วนใหญ่ไม่เรียก AI อยู่แล้ว) · เทสต์ 5B override impl
  anthropicFetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ type: 'text', text: '[[ESCALATE]]' }],
      stop_reason: 'end_turn',
    }),
  });
  container = createContainer({
    databaseUrl: DATABASE_URL,
    authSecret: 'integration-test-secret-16+',
    anthropicApiKey: 'sk-integration-test',
    anthropicFetch: (url, init) => anthropicFetchImpl(url, init),
  });
  app = await buildApp(container.deps);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await app.close();
  await container.close();
});

/**
 * seed workspace + web channel + เปิด bot + demo rules (คืน id ที่ใช้ยิง endpoint)
 * `modules` = โมดูลที่ workspace **ซื้อไว้** (Phase 6) · null = ไม่มี row เลย (ไม่ได้ซื้ออะไร)
 */
async function seedBotWorkspace(
  aiEnabled = false,
  modules: EntitlementModule[] | null = ['bot', 'ai'],
): Promise<{ workspaceId: string; channelId: string }> {
  const gen = createIdGenerator();
  const workspaceId = gen('ws');
  const channelId = gen('chn');
  await seedHandle.db.insert(workspaces).values({ id: workspaceId, name: 'WS bot e2e' });
  await seedHandle.db
    .insert(channels)
    .values({ id: channelId, workspaceId, type: 'web', displayName: 'Web bot e2e' });
  if (modules) {
    await seedHandle.db.insert(workspaceEntitlements).values({ workspaceId, modules });
  }
  await seedHandle.db
    .insert(workspaceBotConfig)
    .values({ workspaceId, botEnabled: true, aiEnabled });
  await seedHandle.db.insert(botRules).values([
    {
      id: gen('botr'),
      workspaceId,
      channelId: null,
      matchType: 'contains',
      pattern: 'แอดมิน',
      action: { kind: 'escalate' },
      enabled: true,
      priority: 5,
    },
    {
      id: gen('botr'),
      workspaceId,
      channelId: null,
      matchType: 'contains',
      pattern: 'สวัสดี',
      action: { kind: 'reply', content: { type: 'text', text: 'สวัสดีครับ ยินดีต้อนรับครับ' } },
      enabled: true,
      priority: 10,
    },
  ]);
  return { workspaceId, channelId };
}

async function postJson<T>(path: string, body: unknown): Promise<{ status: number; json: T }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as T };
}

/** poll DB จนเงื่อนไขจริง (bot ทำงาน fire-and-forget หลัง ingest) หรือ timeout */
async function waitForRows<T>(
  query: () => Promise<T[]>,
  cond: (rows: T[]) => boolean,
  timeoutMs = 4000,
): Promise<T[]> {
  const start = Date.now();
  for (;;) {
    const rows = await query();
    if (cond(rows)) return rows;
    if (Date.now() - start > timeoutMs) throw new Error('waitForRows timeout');
    await new Promise((r) => setTimeout(r, 25));
  }
}

const msgRows = (workspaceId: string) =>
  seedHandle.db.select().from(messages).where(eq(messages.workspaceId, workspaceId));
const convRow = (conversationId: string) =>
  seedHandle.db.select().from(conversations).where(eq(conversations.id, conversationId));

describe('bot automation e2e (integration — ต้อง pnpm db:up)', () => {
  it('สายใหม่ "สวัสดี" → bot รับสาย + ตอบ canned · จากนั้น "แอดมิน" → escalate + แจ้งลูกค้า', async () => {
    const { workspaceId, channelId } = await seedBotWorkspace();

    // mint session
    const sessionRes = await fetch(`${baseUrl}/channels/web/${channelId}/sessions`, {
      method: 'POST',
    });
    const { sessionId } = (await sessionRes.json()) as { sessionId: string };

    // 1) inbound แรก "สวัสดี" → สายใหม่ → bot รับ + ตอบ
    const inbound1 = await postJson<{ conversationId: string }>(
      `/channels/web/${channelId}/messages`,
      { sessionId, text: 'สวัสดีครับ ขอสอบถามหน่อย', contactName: 'ลูกค้า bot' },
    );
    expect(inbound1.status).toBe(200);
    const conversationId = inbound1.json.conversationId;

    // bot ตอบ canned (outbound sender bot) — persist จริง
    const afterGreeting = await waitForRows(
      () => msgRows(workspaceId),
      (rows) => rows.some((r) => r.direction === 'outbound'),
    );
    const greeting = afterGreeting.find((r) => r.direction === 'outbound');
    expect(greeting?.sender).toEqual({ kind: 'bot' });
    expect(greeting?.content).toEqual({ type: 'text', text: 'สวัสดีครับ ยินดีต้อนรับครับ' });

    // bot รับสาย → assignee = bot
    const [convAfter1] = await waitForRows(
      () => convRow(conversationId),
      (rows) => (rows[0]?.assignee as Assignee | null)?.kind === 'bot',
    );
    expect(convAfter1?.assignee).toEqual({ kind: 'bot' });

    // 2) inbound สอง "แอดมิน" (สายเดิม assignee=bot) → escalate keyword
    const inbound2 = await postJson<{ conversationId: string }>(
      `/channels/web/${channelId}/messages`,
      { sessionId, text: 'ขอคุยกับแอดมินหน่อยครับ' },
    );
    expect(inbound2.json.conversationId).toBe(conversationId); // สายเดียวกัน

    // bot escalate → assignee กลับเป็น null (เข้า unassigned queue รอ human)
    const [convAfter2] = await waitForRows(
      () => convRow(conversationId),
      (rows) => rows[0]?.assignee === null,
    );
    expect(convAfter2?.assignee).toBeNull();

    // ส่ง notice แจ้งลูกค้า → outbound bot รวมเป็น 2 (greeting + notice)
    const finalRows = await waitForRows(
      () => msgRows(workspaceId),
      (rows) => rows.filter((r) => r.direction === 'outbound').length >= 2,
    );
    const outbound = finalRows.filter((r) => r.direction === 'outbound');
    expect(outbound).toHaveLength(2);
    expect(outbound.every((r) => (r.sender as Assignee).kind === 'bot')).toBe(true);
  });

  it('bot ปิด (ไม่มี config) → ไม่ตอบเอง (คง behavior เดิม)', async () => {
    const gen = createIdGenerator();
    const workspaceId = gen('ws');
    const channelId = gen('chn');
    await seedHandle.db.insert(workspaces).values({ id: workspaceId, name: 'WS no-bot' });
    await seedHandle.db
      .insert(channels)
      .values({ id: channelId, workspaceId, type: 'web', displayName: 'Web no-bot' });
    // ไม่ insert workspaceBotConfig → bot ปิด

    const sessionRes = await fetch(`${baseUrl}/channels/web/${channelId}/sessions`, {
      method: 'POST',
    });
    const { sessionId } = (await sessionRes.json()) as { sessionId: string };
    await postJson(`/channels/web/${channelId}/messages`, { sessionId, text: 'สวัสดีครับ' });

    // ให้ bot drain มีโอกาสรัน แล้วยืนยันว่าไม่มี outbound (มีแค่ inbound เดียว)
    await new Promise((r) => setTimeout(r, 300));
    const rows = await msgRows(workspaceId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.direction).toBe('inbound');
  });

  it('5B: no_match + aiEnabled → bot ถาม AI (fake) → ตอบข้อความ AI จริงลง DB', async () => {
    const { workspaceId, channelId } = await seedBotWorkspace(true); // aiEnabled
    // fake Claude ตอบข้อความช่วยเหลือ (ไม่ยิง api.anthropic.com จริง)
    anthropicFetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: 'text', text: 'ร้านเราเปิดทุกวัน 9 โมงถึง 6 โมงเย็นครับ 😊' }],
        stop_reason: 'end_turn',
      }),
    });

    const sessionRes = await fetch(`${baseUrl}/channels/web/${channelId}/sessions`, {
      method: 'POST',
    });
    const { sessionId } = (await sessionRes.json()) as { sessionId: string };

    // ข้อความที่ไม่ match rule ใดๆ (ไม่มี "สวัสดี"/"แอดมิน") → no_match → AI fallback
    const inbound = await postJson<{ conversationId: string }>(
      `/channels/web/${channelId}/messages`,
      { sessionId, text: 'ร้านเปิดกี่โมงคะ', contactName: 'ลูกค้า AI' },
    );
    const conversationId = inbound.json.conversationId;

    // bot ตอบข้อความจาก AI (outbound sender bot) → persist จริง
    const afterAi = await waitForRows(
      () => msgRows(workspaceId),
      (rows) => rows.some((r) => r.direction === 'outbound'),
    );
    const aiReply = afterAi.find((r) => r.direction === 'outbound');
    expect(aiReply?.sender).toEqual({ kind: 'bot' });
    expect(aiReply?.content).toEqual({
      type: 'text',
      text: 'ร้านเราเปิดทุกวัน 9 โมงถึง 6 โมงเย็นครับ 😊',
    });

    // สายใหม่ → bot รับสาย (assignee=bot) เพราะ AI ตอบได้ (ไม่ escalate)
    const [conv] = await waitForRows(
      () => convRow(conversationId),
      (rows) => (rows[0]?.assignee as Assignee | null)?.kind === 'bot',
    );
    expect(conv?.assignee).toEqual({ kind: 'bot' });
  });

  // ── Phase 6: entitlement บังคับที่ server จริง (ADR-0007) ──

  it('bot config เปิด แต่ไม่ได้ซื้อโมดูล bot → ไม่ตอบ (fail-closed ทะลุ pipeline จริง)', async () => {
    const { workspaceId, channelId } = await seedBotWorkspace(false, null); // ไม่มี entitlement row

    const sessionRes = await fetch(`${baseUrl}/channels/web/${channelId}/sessions`, {
      method: 'POST',
    });
    const { sessionId } = (await sessionRes.json()) as { sessionId: string };
    await postJson(`/channels/web/${channelId}/messages`, { sessionId, text: 'สวัสดีครับ' });

    // rule "สวัสดี" match และ botEnabled=true — ถ้า gate ไม่ทำงาน bot จะตอบ canned
    await new Promise((r) => setTimeout(r, 300));
    const rows = await msgRows(workspaceId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.direction).toBe('inbound');
  });

  it('ซื้อ bot แต่ไม่ซื้อ ai (aiEnabled=true) → escalate แทน โดยไม่ยิง Anthropic เลย', async () => {
    const { workspaceId, channelId } = await seedBotWorkspace(true, ['bot']); // ไม่มี 'ai'
    let aiCalled = false;
    anthropicFetchImpl = async () => {
      aiCalled = true;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ type: 'text', text: 'ไม่ควรถูกเรียก' }],
          stop_reason: 'end_turn',
        }),
      };
    };

    const sessionRes = await fetch(`${baseUrl}/channels/web/${channelId}/sessions`, {
      method: 'POST',
    });
    const { sessionId } = (await sessionRes.json()) as { sessionId: string };
    const inbound = await postJson<{ conversationId: string }>(
      `/channels/web/${channelId}/messages`,
      { sessionId, text: 'ร้านเปิดกี่โมงคะ' }, // ไม่ match rule → no_match
    );

    // ได้ notice escalate (ข้อความ static) ไม่ใช่คำตอบจาก AI
    const after = await waitForRows(
      () => msgRows(workspaceId),
      (rows) => rows.some((r) => r.direction === 'outbound'),
    );
    const outbound = after.find((r) => r.direction === 'outbound');
    expect(outbound?.content).toMatchObject({ type: 'text' });
    expect((outbound?.content as { text: string }).text).not.toBe('ไม่ควรถูกเรียก');
    expect(aiCalled).toBe(false); // ไม่ได้ซื้อ = ไม่ยิง API (ไม่เสียเงินเราด้วย)

    // escalate → assignee = null (เข้า queue รอ human)
    const [conv] = await convRow(inbound.json.conversationId);
    expect(conv?.assignee).toBeNull();
  });
});
