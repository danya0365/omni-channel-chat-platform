import { createHmac } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import {
  channels,
  contactIdentities,
  createChannelCredentialRepository,
  createDb,
  createIdGenerator,
  loadEncryptionKey,
  messages,
  runMigrations,
  workspaces,
} from '@omni/db';
import type { DbHandle } from '@omni/db';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import { createContainer } from './wiring';
import type { Container } from './wiring';

/**
 * LINE inbound e2e (integration — ต้อง pnpm db:up):
 *   POST webhook (signed) ผ่าน HTTP จริง → Fastify raw-body parser → verify x-line-signature →
 *   decrypt credential (real) → ingest → ลง Postgres จริง
 *
 * พิสูจน์ inbound path ที่ **เราคุมเองทั้งหมด** end-to-end บน server + DB จริง
 * ⚠️ ไม่ครอบ "LINE ยิงเข้ามาจริง" (ไม่มี public URL/bot) และไม่ครอบ outbound push (ยิง api.line.me จริง) —
 *    signature จำลองด้วยการเซ็นเองด้วย channelSecret เดียวกับที่ store (contract-level ตาม ADR-0004)
 */
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://omni:omni_dev_only@localhost:5432/omni';
// key รู้ค่า (hex 64) — ให้ container + seed encrypt/decrypt ด้วย key เดียวกัน
const ENCRYPTION_KEY = 'b'.repeat(64);
const CHANNEL_SECRET = 'line-channel-secret-สมมติ';
const CHANNEL_ACCESS_TOKEN = 'line-access-token-สมมติ';

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
    channelEncryptionKey: ENCRYPTION_KEY,
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

/** seed workspace + line channel + encrypted credential (คืน ids ที่ใช้ยิง webhook) */
async function seedLineChannel(): Promise<{ workspaceId: string; channelId: string }> {
  const gen = createIdGenerator();
  const workspaceId = gen('ws');
  const channelId = gen('chn');
  await seedHandle.db.insert(workspaces).values({ id: workspaceId, name: 'WS line e2e' });
  await seedHandle.db
    .insert(channels)
    .values({ id: channelId, workspaceId, type: 'line', displayName: 'LINE e2e' });
  // เก็บ credential แบบ encrypted ด้วย key เดียวกับ container → route decrypt เจอ channelSecret ที่ตรงกัน
  const credentials = createChannelCredentialRepository(
    seedHandle.db,
    loadEncryptionKey(ENCRYPTION_KEY),
  );
  await credentials.upsert(workspaceId, channelId, {
    channelAccessToken: CHANNEL_ACCESS_TOKEN,
    channelSecret: CHANNEL_SECRET,
  });
  return { workspaceId, channelId };
}

function webhookBody(text: string, userId: string, messageId: string): string {
  return JSON.stringify({
    destination: 'U0123456789abcdef',
    events: [
      {
        type: 'message',
        mode: 'active',
        timestamp: 1625665242211,
        source: { type: 'user', userId },
        replyToken: '757913772c4646b784d4b7ce46d12671',
        message: { type: 'text', id: messageId, text },
      },
    ],
  });
}

async function postWebhook(channelId: string, rawBody: string, signature: string) {
  return fetch(`${baseUrl}/channels/line/${channelId}/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-line-signature': signature },
    body: rawBody,
  });
}

describe('LINE inbound e2e (integration — ต้อง pnpm db:up)', () => {
  it('webhook signed ถูก → ingest ลง Postgres จริง (message + identity = LINE userId)', async () => {
    const { workspaceId, channelId } = await seedLineChannel();
    const body = webhookBody('ทักจาก LINE ครับ', 'Uabc123def456', 'lineMsg_001');
    const signature = createHmac('sha256', CHANNEL_SECRET).update(body).digest('base64');

    const res = await postWebhook(channelId, body, signature);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    // message inbound ลง DB จริง
    const rows = await seedHandle.db
      .select()
      .from(messages)
      .where(eq(messages.workspaceId, workspaceId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.direction).toBe('inbound');
    expect(rows[0]?.channelId).toBe(channelId);
    expect(rows[0]?.content).toEqual({ type: 'text', text: 'ทักจาก LINE ครับ' });
    expect(rows[0]?.externalId).toBe('lineMsg_001'); // externalMessageId ของ LINE

    // identity ถูกสร้างด้วย externalId = LINE userId (ไว้ route outbound กลับ)
    const identities = await seedHandle.db
      .select()
      .from(contactIdentities)
      .where(eq(contactIdentities.workspaceId, workspaceId));
    expect(identities).toHaveLength(1);
    expect(identities[0]?.externalId).toBe('Uabc123def456');
    expect(identities[0]?.channelId).toBe(channelId);
  });

  it('signature ผิด → 401 · ไม่มีอะไรลง DB', async () => {
    const { workspaceId, channelId } = await seedLineChannel();
    const body = webhookBody('ไม่ควรผ่าน', 'Uxyz', 'm1');
    const badSignature = createHmac('sha256', 'secret-ผิด').update(body).digest('base64');

    const res = await postWebhook(channelId, body, badSignature);
    expect(res.status).toBe(401);

    const rows = await seedHandle.db
      .select()
      .from(messages)
      .where(eq(messages.workspaceId, workspaceId));
    expect(rows).toHaveLength(0);
  });

  it('ข้อความที่สองจาก user เดิม → เข้า conversation เดิม (ingest resolve identity ซ้ำ)', async () => {
    const { workspaceId, channelId } = await seedLineChannel();
    const send = async (text: string, id: string) => {
      const body = webhookBody(text, 'Usame', id);
      const sig = createHmac('sha256', CHANNEL_SECRET).update(body).digest('base64');
      return postWebhook(channelId, body, sig);
    };

    expect((await send('ข้อความ 1', 'm1')).status).toBe(200);
    expect((await send('ข้อความ 2', 'm2')).status).toBe(200);

    const rows = await seedHandle.db
      .select()
      .from(messages)
      .where(eq(messages.workspaceId, workspaceId));
    expect(rows).toHaveLength(2);
    // conversation เดียว (identity เดิม → หา open conversation เจอ ไม่เปิดใหม่)
    const conversationIds = new Set(rows.map((r) => r.conversationId));
    expect(conversationIds.size).toBe(1);
  });
});
