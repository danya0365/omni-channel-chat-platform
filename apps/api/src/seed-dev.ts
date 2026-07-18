import { channels, createDb, runMigrations, workspaces } from '@omni/db';

/**
 * Seed dev — สร้าง workspace + web channel สำหรับ demo widget (idempotent)
 * รัน: `pnpm --filter @omni/api seed:dev` (ต้อง `pnpm db:up` ก่อน)
 * ใช้ id อ่านง่ายแบบคงที่ (idSchema ตรวจแค่ prefix `chn_`/`ws_`) → demo/index.html อ้างถึงได้ตรงๆ
 */
const DEV_DATABASE_URL = 'postgresql://omni:omni_dev_only@localhost:5432/omni';
const DEMO_WORKSPACE_ID = 'ws_demo';
const DEMO_CHANNEL_ID = 'chn_web_demo';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL ?? DEV_DATABASE_URL;
  const handle = createDb(databaseUrl);
  try {
    await runMigrations(handle.db);
    await handle.db
      .insert(workspaces)
      .values({ id: DEMO_WORKSPACE_ID, name: 'Demo Workspace' })
      .onConflictDoNothing();
    await handle.db
      .insert(channels)
      .values({
        id: DEMO_CHANNEL_ID,
        workspaceId: DEMO_WORKSPACE_ID,
        type: 'web',
        displayName: 'Web Widget (demo)',
      })
      .onConflictDoNothing();
    console.log(`seed ok · workspaceId=${DEMO_WORKSPACE_ID} · channelId=${DEMO_CHANNEL_ID}`);
  } finally {
    await handle.close();
  }
}

void main();
