import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { sql } from 'drizzle-orm';
import { agents, channels, createDb, createIdGenerator, runMigrations, workspaces } from '@omni/db';
import type { DbHandle } from '@omni/db';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import { hashPassword } from './auth/password';
import { createContainer } from './wiring';
import type { Container } from './wiring';

/**
 * e2e ของ agent inbox realtime (integration — ต้อง pnpm db:up):
 *   ลูกค้าทัก (inbound) → outbox (tx) → immediate drain → agent WS รับ event realtime
 *   agent ตอบผ่าน inbox (authed) → sender=agent ลง DB + เด้งเข้า widget WS
 * ไม่เปิด pg-boss relay (ไม่เรียก container.start) — realtime มาจาก immediate drain
 */
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://omni:omni_dev_only@localhost:5432/omni';
const AUTH_SECRET = 'integration-test-secret-16+';
const AGENT_PASSWORD = 'pw12345';

let seedHandle: DbHandle;
let container: Container;
let app: FastifyInstance;
let baseUrl: string;

beforeAll(async () => {
  seedHandle = createDb(DATABASE_URL);
  await runMigrations(seedHandle.db);
});

afterAll(async () => {
  await seedHandle.close();
});

beforeEach(async () => {
  await seedHandle.db.execute(sql`truncate table ${workspaces} restart identity cascade`);
  container = createContainer({ databaseUrl: DATABASE_URL, authSecret: AUTH_SECRET });
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

async function seedWsChannelAgent() {
  const gen = createIdGenerator();
  const workspaceId = gen('ws');
  const channelId = gen('chn');
  const agentId = gen('agt');
  await seedHandle.db.insert(workspaces).values({ id: workspaceId, name: 'WS realtime' });
  await seedHandle.db
    .insert(channels)
    .values({ id: channelId, workspaceId, type: 'web', displayName: 'Web' });
  await seedHandle.db.insert(agents).values({
    id: agentId,
    workspaceId,
    email: 'agent@rt.local',
    passwordHash: await hashPassword(AGENT_PASSWORD),
    displayName: 'RT Agent',
  });
  return { workspaceId, channelId, agentId };
}

async function login(): Promise<string> {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'agent@rt.local', password: AGENT_PASSWORD }),
  });
  return ((await res.json()) as { token: string }).token;
}

async function openWs(url: string, sink: Array<Record<string, unknown>>): Promise<WebSocket> {
  const ws = new WebSocket(url);
  ws.on('message', (raw: Buffer) =>
    sink.push(JSON.parse(raw.toString()) as Record<string, unknown>),
  );
  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => resolve());
    ws.on('error', reject);
  });
  return ws;
}

async function waitFor(cond: () => boolean, timeoutMs = 4000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('agent inbox realtime (integration — ต้อง pnpm db:up)', () => {
  it('ลูกค้าทัก (inbound) → outbox → drain → agent WS รับ message event realtime', async () => {
    const { channelId } = await seedWsChannelAgent();
    const token = await login();

    const agentEvents: Array<Record<string, unknown>> = [];
    const agentWs = await openWs(
      `${baseUrl.replace('http', 'ws')}/inbox/ws?token=${token}`,
      agentEvents,
    );

    // ลูกค้าส่ง inbound
    const sessionRes = await fetch(`${baseUrl}/channels/web/${channelId}/sessions`, {
      method: 'POST',
    });
    const { sessionId } = (await sessionRes.json()) as { sessionId: string };
    await fetch(`${baseUrl}/channels/web/${channelId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, text: 'สวัสดีทีมงาน', contactName: 'ลูกค้า' }),
    });

    // agent WS ต้องได้รับ event (immediate drain fan-out)
    await waitFor(() => agentEvents.some((e) => e.type === 'message'));
    expect(agentEvents.find((e) => e.type === 'message')).toMatchObject({
      type: 'message',
      message: { direction: 'inbound', content: { type: 'text', text: 'สวัสดีทีมงาน' } },
    });

    agentWs.close();
  });

  it('agent ตอบผ่าน inbox → sender=agent ลง DB + เด้งเข้า widget WS', async () => {
    const { channelId, agentId } = await seedWsChannelAgent();
    const token = await login();

    // ลูกค้าเชื่อม widget WS + ส่ง inbound (สร้าง conversation)
    const sessionRes = await fetch(`${baseUrl}/channels/web/${channelId}/sessions`, {
      method: 'POST',
    });
    const { sessionId } = (await sessionRes.json()) as { sessionId: string };
    const widgetReceived: Array<Record<string, unknown>> = [];
    const widgetWs = await openWs(
      `${baseUrl.replace('http', 'ws')}/channels/web/${channelId}/ws?sessionId=${sessionId}`,
      widgetReceived,
    );

    const inbound = await fetch(`${baseUrl}/channels/web/${channelId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, text: 'ทัก', contactName: 'ลูกค้า' }),
    });
    const { conversationId } = (await inbound.json()) as { conversationId: string };

    // agent ตอบผ่าน inbox (authed)
    const replyRes = await fetch(`${baseUrl}/inbox/conversations/${conversationId}/reply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: 'สวัสดีครับ รับเรื่องแล้ว' }),
    });
    expect(replyRes.status).toBe(200);
    const replyBody = (await replyRes.json()) as {
      message: { sender: unknown };
      delivered: boolean;
    };
    expect(replyBody.message.sender).toEqual({ kind: 'agent', agentId });

    // widget รับ outbound (sender agent) ทาง WS realtime
    await waitFor(() => widgetReceived.some((m) => m.direction === 'outbound'));
    expect(widgetReceived.find((m) => m.direction === 'outbound')).toMatchObject({
      sender: { kind: 'agent', agentId },
      content: { type: 'text', text: 'สวัสดีครับ รับเรื่องแล้ว' },
    });

    widgetWs.close();
  });
});
