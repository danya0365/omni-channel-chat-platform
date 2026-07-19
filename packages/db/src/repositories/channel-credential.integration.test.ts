import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createDb } from '../client';
import type { DbHandle } from '../client';
import { loadEncryptionKey } from '../crypto';
import { createIdGenerator } from '../id';
import { runMigrations } from '../migrate';
import { channelCredentials, channels, workspaces } from '../schema';
import { createChannelCredentialRepository } from './channel-credential-repository';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://omni:omni_dev_only@localhost:5432/omni';

// key สมมติสำหรับ test (ไม่ใช่ secret จริง) — 32 byte
const KEY = loadEncryptionKey('a'.repeat(64));

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

async function seedLineChannel() {
  const workspaceId = gen('ws');
  const channelId = gen('chn');
  await handle.db.insert(workspaces).values({ id: workspaceId, name: 'WS line' });
  await handle.db
    .insert(channels)
    .values({ id: channelId, workspaceId, type: 'line', displayName: 'LINE OA (test)' });
  return { workspaceId, channelId };
}

describe('ChannelCredentialRepository (integration — ต้อง pnpm db:up)', () => {
  it('upsert → get: decrypt กลับได้ค่าเดิม (round-trip)', async () => {
    const { workspaceId, channelId } = await seedLineChannel();
    const repo = createChannelCredentialRepository(handle.db, KEY);
    const secrets = { channelAccessToken: 'tok-สมมติ-123', channelSecret: 'sec-สมมติ-456' };

    await repo.upsert(workspaceId, channelId, secrets);
    expect(await repo.get(workspaceId, channelId)).toEqual(secrets);
  });

  it('column ดิบ secret_cipher เป็น ciphertext (ไม่มี plaintext token ใน DB)', async () => {
    const { workspaceId, channelId } = await seedLineChannel();
    const repo = createChannelCredentialRepository(handle.db, KEY);
    await repo.upsert(workspaceId, channelId, { channelAccessToken: 'PLAINTEXT_TOKEN_XYZ' });

    const rows = await handle.db
      .select({ secretCipher: channelCredentials.secretCipher })
      .from(channelCredentials)
      .where(eq(channelCredentials.channelId, channelId));
    const cipher = rows[0]?.secretCipher ?? '';
    expect(cipher).toMatch(/^v1\./); // versioned envelope
    expect(cipher).not.toContain('PLAINTEXT_TOKEN_XYZ'); // encrypted at rest จริง
  });

  it('upsert ซ้ำ → อัปเดตค่า (get สะท้อนค่าใหม่)', async () => {
    const { workspaceId, channelId } = await seedLineChannel();
    const repo = createChannelCredentialRepository(handle.db, KEY);

    await repo.upsert(workspaceId, channelId, { channelAccessToken: 'old' });
    await repo.upsert(workspaceId, channelId, { channelAccessToken: 'new' });
    expect(await repo.get(workspaceId, channelId)).toEqual({ channelAccessToken: 'new' });
  });

  it('get → null ถ้ายังไม่เคยตั้ง credential', async () => {
    const { workspaceId, channelId } = await seedLineChannel();
    const repo = createChannelCredentialRepository(handle.db, KEY);
    expect(await repo.get(workspaceId, channelId)).toBeNull();
  });

  it('get → null ถ้าข้าม workspace (scope กัน cross-tenant)', async () => {
    const { workspaceId, channelId } = await seedLineChannel();
    const repo = createChannelCredentialRepository(handle.db, KEY);
    await repo.upsert(workspaceId, channelId, { channelAccessToken: 'x' });

    // workspace อื่นถาม channelId เดียวกัน → ไม่เห็น (scope ด้วย workspaceId)
    expect(await repo.get('ws_คนอื่น', channelId)).toBeNull();
    // เจ้าของเห็นปกติ
    expect(await repo.get(workspaceId, channelId)).toEqual({ channelAccessToken: 'x' });
  });
});
