import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { eq, sql } from 'drizzle-orm';
import {
  createDb,
  createIdGenerator,
  runMigrations,
  channels,
  messages,
  workspaces,
} from '@omni/db';
import type { DbHandle } from '@omni/db';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import { createContainer } from './wiring';
import type { Container } from './wiring';

/**
 * e2e ของ web channel (integration — ต้อง pnpm db:up):
 *   POST sessions → เชื่อม WS → POST messages (ลง Postgres จริง) → POST reply → widget รับ outbound ทาง WS จริง
 * พิสูจน์ทั้ง persist จริง + realtime delivery ผ่าน network จริง (listen บน port จริง + ws client จริง)
 */
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://omni:omni_dev_only@localhost:5432/omni';

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
    authSecret: 'integration-test-secret-16+',
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

/** seed workspace + web channel ตรงเข้า DB (คืน channelId ที่ใช้ยิง endpoint) */
async function seedChannel(): Promise<{ workspaceId: string; channelId: string }> {
  const gen = createIdGenerator();
  const workspaceId = gen('ws');
  const channelId = gen('chn');
  await seedHandle.db.insert(workspaces).values({ id: workspaceId, name: 'WS e2e' });
  await seedHandle.db
    .insert(channels)
    .values({ id: channelId, workspaceId, type: 'web', displayName: 'Web e2e' });
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

async function waitFor(cond: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('web channel e2e (integration — ต้อง pnpm db:up)', () => {
  it('พิมพ์จาก widget → ลง DB → ตอบ outbound → เด้งเข้า widget ทาง WS realtime', async () => {
    const { workspaceId, channelId } = await seedChannel();

    // 1. mint session
    const sessionRes = await fetch(`${baseUrl}/channels/web/${channelId}/sessions`, {
      method: 'POST',
    });
    expect(sessionRes.status).toBe(200);
    const { sessionId } = (await sessionRes.json()) as { sessionId: string };
    expect(sessionId).toMatch(/^web_/);

    // 2. widget เชื่อม WS ด้วย sessionId (รับ outbound realtime)
    const received: Array<Record<string, unknown>> = [];
    const client = new WebSocket(
      `${baseUrl.replace('http', 'ws')}/channels/web/${channelId}/ws?sessionId=${sessionId}`,
    );
    client.on('message', (raw: Buffer) => received.push(JSON.parse(raw.toString())));
    await new Promise<void>((resolve, reject) => {
      client.on('open', () => resolve());
      client.on('error', reject);
    });

    // 3. inbound: พิมพ์ข้อความ → ต้องลง Postgres จริง
    const inbound = await postJson<{ conversationId: string; messageId: string }>(
      `/channels/web/${channelId}/messages`,
      { sessionId, text: 'สวัสดีครับ ช่วยดูออเดอร์ให้หน่อย', contactName: 'ลูกค้า e2e' },
    );
    expect(inbound.status).toBe(200);
    const conversationId = inbound.json.conversationId;
    expect(conversationId).toMatch(/^conv_/);

    const inboundRows = await seedHandle.db
      .select()
      .from(messages)
      .where(eq(messages.workspaceId, workspaceId));
    expect(inboundRows).toHaveLength(1);
    expect(inboundRows[0]?.direction).toBe('inbound');
    expect(inboundRows[0]?.content).toEqual({
      type: 'text',
      text: 'สวัสดีครับ ช่วยดูออเดอร์ให้หน่อย',
    });

    // 4. outbound: agent/bot ตอบ → ต้อง delivered + เด้งเข้า WS ของ widget
    const reply = await postJson<{ messageId: string; delivered: boolean }>(
      `/channels/web/${channelId}/reply`,
      { conversationId, text: 'ได้เลยครับ ขอเลขออเดอร์หน่อยนะครับ' },
    );
    expect(reply.status).toBe(200);
    expect(reply.json.delivered).toBe(true);

    // 5. widget รับ outbound ทาง WS จริง
    await waitFor(() => received.some((m) => m.direction === 'outbound'));
    const outboundEvent = received.find((m) => m.direction === 'outbound');
    expect(outboundEvent).toMatchObject({
      type: 'message',
      conversationId,
      sender: { kind: 'bot' },
      content: { type: 'text', text: 'ได้เลยครับ ขอเลขออเดอร์หน่อยนะครับ' },
    });

    // outbound ลง DB ด้วย (persist จริง)
    const allRows = await seedHandle.db
      .select()
      .from(messages)
      .where(eq(messages.workspaceId, workspaceId));
    expect(allRows).toHaveLength(2);
    expect(allRows.filter((r) => r.direction === 'outbound')).toHaveLength(1);

    client.close();
  });

  it('ตอบเข้า conversation ที่ไม่มีจริง → 404 (ไม่ยิงมั่ว)', async () => {
    const { channelId } = await seedChannel();
    const reply = await postJson<{ error: string }>(`/channels/web/${channelId}/reply`, {
      conversationId: 'conv_ไม่มีจริง',
      text: 'x',
    });
    expect(reply.status).toBe(404);
    expect(reply.json.error).toBe('conversation_not_found');
  });
});
