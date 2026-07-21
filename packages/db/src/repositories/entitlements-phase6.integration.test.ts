import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { hasEntitlement } from '@omni/domain';
import { createDb } from '../client';
import type { DbHandle } from '../client';
import { createIdGenerator } from '../id';
import { runMigrations } from '../migrate';
import { workspaceEntitlements, workspaces } from '../schema';
import { createWorkspaceEntitlementsRepository } from './workspace-entitlements-repository';

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

async function seedWorkspace() {
  const workspaceId = gen('ws');
  await handle.db.insert(workspaces).values({ id: workspaceId, name: 'WS entitlements' });
  return workspaceId;
}

describe('Phase 6 entitlements repo (integration — ต้อง pnpm db:up)', () => {
  it('ไม่มี row → null = ไม่มีสิทธิ์อะไรเลย (fail-closed)', async () => {
    const workspaceId = await seedWorkspace();
    const repo = createWorkspaceEntitlementsRepository(handle.db);

    const result = await repo.get(workspaceId);

    expect(result).toBeNull();
    expect(hasEntitlement(result, 'reports')).toBe(false);
  });

  it('row ที่ไม่ได้ระบุ modules → default [] (มี row แต่ยังไม่ซื้ออะไร)', async () => {
    const workspaceId = await seedWorkspace();
    await handle.db.insert(workspaceEntitlements).values({ workspaceId });
    const repo = createWorkspaceEntitlementsRepository(handle.db);

    const result = await repo.get(workspaceId);

    expect(result?.modules).toEqual([]);
    expect(hasEntitlement(result, 'bot')).toBe(false);
  });

  it('อ่านโมดูลที่ซื้อไว้กลับมาครบ · โมดูลที่ไม่ได้ซื้อยังปิด', async () => {
    const workspaceId = await seedWorkspace();
    await handle.db
      .insert(workspaceEntitlements)
      .values({ workspaceId, modules: ['bot', 'reports'] });
    const repo = createWorkspaceEntitlementsRepository(handle.db);

    const result = await repo.get(workspaceId);

    expect(result?.modules).toEqual(['bot', 'reports']);
    expect(hasEntitlement(result, 'bot')).toBe(true);
    expect(hasEntitlement(result, 'reports')).toBe(true);
    expect(hasEntitlement(result, 'ai')).toBe(false);
  });

  it('แยกตาม workspace — ไม่รั่วข้าม tenant', async () => {
    const wsA = await seedWorkspace();
    const wsB = await seedWorkspace();
    await handle.db.insert(workspaceEntitlements).values([
      { workspaceId: wsA, modules: ['ai'] },
      { workspaceId: wsB, modules: ['integrations'] },
    ]);
    const repo = createWorkspaceEntitlementsRepository(handle.db);

    expect(hasEntitlement(await repo.get(wsA), 'ai')).toBe(true);
    expect(hasEntitlement(await repo.get(wsA), 'integrations')).toBe(false);
    expect(hasEntitlement(await repo.get(wsB), 'integrations')).toBe(true);
    expect(hasEntitlement(await repo.get(wsB), 'ai')).toBe(false);
  });

  it('โมดูลที่ไม่รู้จักใน DB → ตัดทิ้ง ไม่ throw (เวอร์ชันเก่าไม่เสียสิทธิ์ทั้งใบ)', async () => {
    const workspaceId = await seedWorkspace();
    // จำลอง row ที่เขียนโดยเวอร์ชันใหม่กว่า (มีโมดูลที่โค้ดนี้ยังไม่รู้จัก)
    await handle.db.execute(
      sql`insert into ${workspaceEntitlements} (workspace_id, modules)
          values (${workspaceId}, '["bot","teleporter","reports"]'::jsonb)`,
    );
    const repo = createWorkspaceEntitlementsRepository(handle.db);

    const result = await repo.get(workspaceId);

    expect(result?.modules).toEqual(['bot', 'reports']);
  });

  it('ลบ workspace → entitlements ถูกลบตาม (cascade)', async () => {
    const workspaceId = await seedWorkspace();
    await handle.db.insert(workspaceEntitlements).values({ workspaceId, modules: ['bot'] });

    await handle.db.execute(sql`delete from ${workspaces} where id = ${workspaceId}`);

    const rows = await handle.db.select().from(workspaceEntitlements);
    expect(rows).toHaveLength(0);
  });
});
