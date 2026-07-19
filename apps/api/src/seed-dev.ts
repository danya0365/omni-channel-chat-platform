import { agents, channels, createDb, runMigrations, workspaces } from '@omni/db';
import { hashPassword } from './auth/password';

/**
 * Seed dev — สร้าง workspace + web channel + demo agent สำหรับ demo (idempotent)
 * รัน: `pnpm --filter @omni/api seed:dev` (ต้อง `pnpm db:up` ก่อน)
 * ใช้ id อ่านง่ายแบบคงที่ (idSchema ตรวจแค่ prefix) → demo/index.html + inbox login อ้างถึงได้ตรงๆ
 * ⚠️ credential ด้านล่างเป็นข้อมูลสมมติสำหรับ dev เท่านั้น (ไม่ใช่ secret จริง)
 */
const DEV_DATABASE_URL = 'postgresql://omni:omni_dev_only@localhost:5432/omni';
const DEMO_WORKSPACE_ID = 'ws_demo';
const DEMO_CHANNEL_ID = 'chn_web_demo';
const DEMO_AGENT_ID = 'agt_demo';
const DEMO_AGENT_EMAIL = 'agent@demo.local';
const DEMO_AGENT_PASSWORD = 'demo1234';

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
    await handle.db
      .insert(agents)
      .values({
        id: DEMO_AGENT_ID,
        workspaceId: DEMO_WORKSPACE_ID,
        email: DEMO_AGENT_EMAIL,
        passwordHash: await hashPassword(DEMO_AGENT_PASSWORD),
        displayName: 'ทีมงาน Demo',
      })
      .onConflictDoNothing();
    console.log(
      `seed ok · workspaceId=${DEMO_WORKSPACE_ID} · channelId=${DEMO_CHANNEL_ID} · ` +
        `agent login: ${DEMO_AGENT_EMAIL} / ${DEMO_AGENT_PASSWORD}`,
    );
  } finally {
    await handle.close();
  }
}

void main();
