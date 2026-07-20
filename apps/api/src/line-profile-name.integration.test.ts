import { createHmac } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { eq, sql } from 'drizzle-orm';
import {
  agents,
  channels,
  contacts,
  createChannelCredentialRepository,
  createDb,
  createIdGenerator,
  loadEncryptionKey,
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
 * e2e ของ item (b) — เติมชื่อ contact จาก LINE profile API (integration — ต้อง pnpm db:up):
 *   LINE inbound จาก user ใหม่ → ingest สร้าง contact (ชื่อ null) → route เรียก profile API
 *   (inject lineFetch คืน displayName ไม่ยิง api.line.me จริง) → backfill displayName ใน DB +
 *   publish conversation.updated → agent WS เห็นชื่อ realtime
 */
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://omni:omni_dev_only@localhost:5432/omni';
const AUTH_SECRET = 'integration-test-secret-16+';
const AGENT_PASSWORD = 'pw12345';
const ENCRYPTION_KEY = 'd'.repeat(64);
const CHANNEL_SECRET = 'line-secret-สมมติ-b';
const PROFILE_NAME = 'คุณสมชาย (จาก LINE)';

/** lineFetch จำลอง profile API — GET /profile/{userId} → คืน displayName (ไม่ยิง network จริง) */
const profileLineFetch: LineFetch = async (url) => {
  if (url.includes('/v2/bot/profile/')) {
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ displayName: PROFILE_NAME }),
    };
  }
  return { ok: false, status: 500, headers: { get: () => null } };
};

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
    lineFetch: profileLineFetch,
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

async function seedLineChannelAgent(): Promise<{ workspaceId: string; channelId: string }> {
  const gen = createIdGenerator();
  const workspaceId = gen('ws');
  const channelId = gen('chn');
  await seedHandle.db.insert(workspaces).values({ id: workspaceId, name: 'WS profile' });
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
    id: gen('agt'),
    workspaceId,
    email: 'agent@prof.local',
    passwordHash: await hashPassword(AGENT_PASSWORD),
    displayName: 'Prof Agent',
  });
  return { workspaceId, channelId };
}

function webhookBody(userId: string): string {
  return JSON.stringify({
    destination: 'U0',
    events: [
      {
        type: 'message',
        source: { type: 'user', userId },
        message: { type: 'text', id: 'lineMsg_b1', text: 'สวัสดีครับ' },
      },
    ],
  });
}

async function login(): Promise<string> {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'agent@prof.local', password: AGENT_PASSWORD }),
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

describe('LINE profile display name backfill (integration — ต้อง pnpm db:up)', () => {
  it('inbound จาก user ใหม่ → backfill displayName ใน DB + agent WS ได้ conversation ชื่อจาก LINE', async () => {
    const { workspaceId, channelId } = await seedLineChannelAgent();
    const token = await login();

    const agentEvents: Array<Record<string, unknown>> = [];
    const agentWs = await openWs(
      `${baseUrl.replace('http', 'ws')}/inbox/ws?token=${token}`,
      agentEvents,
    );

    const body = webhookBody('Uprofile-new');
    const signature = createHmac('sha256', CHANNEL_SECRET).update(body).digest('base64');
    const res = await fetch(`${baseUrl}/channels/line/${channelId}/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-line-signature': signature },
      body,
    });
    expect(res.status).toBe(200);

    // backfill รันใน handler ก่อนตอบ 200 → contact มีชื่อจาก profile API แล้ว
    const rows = await seedHandle.db
      .select()
      .from(contacts)
      .where(eq(contacts.workspaceId, workspaceId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.displayName).toBe(PROFILE_NAME);

    // agent WS ได้ conversation event ที่ contactName = ชื่อจาก LINE (จาก conversation.updated re-emit)
    await waitFor(() =>
      agentEvents.some(
        (e) =>
          e.type === 'conversation' &&
          (e.conversation as { contactName?: string } | undefined)?.contactName === PROFILE_NAME,
      ),
    );

    agentWs.close();
  });
});
