import { createHmac } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { eq, sql } from 'drizzle-orm';
import {
  agents,
  channels,
  createChannelCredentialRepository,
  createDb,
  createIdGenerator,
  loadEncryptionKey,
  messages,
  runMigrations,
  workspaces,
} from '@omni/db';
import type { DbHandle } from '@omni/db';
import type { LineFetch } from '@omni/channel-line';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import { hashPassword } from './auth/password';
import { createContainer } from './wiring';
import type { Container } from './wiring';

/**
 * e2e ของ item (6) — outbound deliver ล้ม → agent เห็นสถานะ 'failed' realtime (integration — ต้อง pnpm db:up):
 *   agent ตอบสาย LINE → persist (status 'sent', ยิง outbound_message.sent) → deliver LINE push **ล้ม**
 *   (inject lineFetch คืน 500 ไม่ยิง api.line.me จริง) → mark 'failed' + publish outbound_message.failed →
 *   drain → agent WS ได้ message event ที่ status='failed'
 * พิสูจน์ทั้ง path ล้ม บน HTTP+Postgres+WS จริง โดยไม่พึ่ง external
 */
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://omni:omni_dev_only@localhost:5432/omni';
const AUTH_SECRET = 'integration-test-secret-16+';
const AGENT_PASSWORD = 'pw12345';
const ENCRYPTION_KEY = 'c'.repeat(64);
const CHANNEL_SECRET = 'line-secret-สมมติ-6';

/** LINE fetch ที่ล้มเสมอ (500) — deliver จะ retry แล้ว fail โดยไม่ยิง network จริง */
const failingLineFetch: LineFetch = async () => ({
  ok: false,
  status: 500,
  headers: { get: () => null },
});

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
  container = createContainer({
    databaseUrl: DATABASE_URL,
    authSecret: AUTH_SECRET,
    channelEncryptionKey: ENCRYPTION_KEY,
    lineFetch: failingLineFetch,
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

/** seed workspace + LINE channel + credential + agent (คืน ids) */
async function seedLineChannelAgent() {
  const gen = createIdGenerator();
  const workspaceId = gen('ws');
  const channelId = gen('chn');
  const agentId = gen('agt');
  await seedHandle.db.insert(workspaces).values({ id: workspaceId, name: 'WS failed-rt' });
  await seedHandle.db
    .insert(channels)
    .values({ id: channelId, workspaceId, type: 'line', displayName: 'LINE' });
  const credentials = createChannelCredentialRepository(
    seedHandle.db,
    loadEncryptionKey(ENCRYPTION_KEY),
  );
  await credentials.upsert(workspaceId, channelId, {
    channelAccessToken: 'tok-สมมติ',
    channelSecret: CHANNEL_SECRET,
  });
  await seedHandle.db.insert(agents).values({
    id: agentId,
    workspaceId,
    email: 'agent@frt.local',
    passwordHash: await hashPassword(AGENT_PASSWORD),
    displayName: 'FRT Agent',
  });
  return { workspaceId, channelId, agentId };
}

/** ยิง LINE inbound webhook (สร้าง contact+identity+conversation) แล้วคืน conversationId */
async function seedLineConversation(workspaceId: string, channelId: string): Promise<string> {
  const body = JSON.stringify({
    destination: 'U0',
    events: [
      {
        type: 'message',
        source: { type: 'user', userId: 'Ucustomer1' },
        message: { type: 'text', id: 'lineMsg_frt1', text: 'ทักจาก LINE' },
      },
    ],
  });
  const signature = createHmac('sha256', CHANNEL_SECRET).update(body).digest('base64');
  const res = await fetch(`${baseUrl}/channels/line/${channelId}/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-line-signature': signature },
    body,
  });
  expect(res.status).toBe(200);
  const rows = await seedHandle.db
    .select()
    .from(messages)
    .where(eq(messages.workspaceId, workspaceId));
  const conversationId = rows[0]?.conversationId;
  if (!conversationId) throw new Error('seed conversation failed');
  return conversationId;
}

async function login(): Promise<string> {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'agent@frt.local', password: AGENT_PASSWORD }),
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

async function waitFor(cond: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('outbound deliver ล้ม → agent เห็น status failed realtime (integration — ต้อง pnpm db:up)', () => {
  it('reply สาย LINE ที่ push ล้ม → 502 + message status=failed ใน DB + agent WS ได้ status failed', async () => {
    const { workspaceId, channelId } = await seedLineChannelAgent();
    const conversationId = await seedLineConversation(workspaceId, channelId);
    const token = await login();

    const agentEvents: Array<Record<string, unknown>> = [];
    const agentWs = await openWs(
      `${baseUrl.replace('http', 'ws')}/inbox/ws?token=${token}`,
      agentEvents,
    );

    // agent ตอบ → persist สำเร็จ แต่ LINE push ล้ม (retry หมด) → route คืน 502
    const replyRes = await fetch(`${baseUrl}/inbox/conversations/${conversationId}/reply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: 'ขอบคุณครับ' }),
    });
    expect(replyRes.status).toBe(502);

    // message ยัง persist (source of truth) + status ถูกอัปเป็น failed
    const rows = await seedHandle.db
      .select()
      .from(messages)
      .where(eq(messages.workspaceId, workspaceId));
    const outbound = rows.find((r) => r.direction === 'outbound');
    expect(outbound?.status).toBe('failed');

    // agent WS ได้ message event ที่ status='failed' (จาก outbound_message.failed → drain)
    await waitFor(() =>
      agentEvents.some(
        (e) =>
          e.type === 'message' &&
          (e.message as { status?: string } | undefined)?.status === 'failed',
      ),
    );

    agentWs.close();
  });
});
