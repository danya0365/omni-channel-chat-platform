import {
  agents,
  channels,
  createChannelCredentialRepository,
  createDb,
  loadEncryptionKey,
  runMigrations,
  workspaces,
} from '@omni/db';
import { hashPassword } from './auth/password';
import { DEV_CHANNEL_ENCRYPTION_KEY } from './wiring';

/**
 * Seed dev — สร้าง workspace + web channel + LINE channel + demo agent สำหรับ demo (idempotent)
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

// LINE demo channel — ⚠️ ค่าสมมติ dev เท่านั้น · channelSecret ใช้เซ็น webhook ทดสอบในเครื่อง
// accessToken เป็น placeholder → outbound push ไป LINE จริงจะ fail (ไม่มี bot จริง — ทดสอบได้แค่ inbound)
const DEMO_LINE_CHANNEL_ID = 'chn_line_demo';
const DEMO_LINE_CHANNEL_SECRET = 'line-dev-channel-secret';
const DEMO_LINE_ACCESS_TOKEN = 'line-dev-access-token-placeholder';

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
      .insert(channels)
      .values({
        id: DEMO_LINE_CHANNEL_ID,
        workspaceId: DEMO_WORKSPACE_ID,
        type: 'line',
        displayName: 'LINE OA (demo)',
      })
      .onConflictDoNothing();
    // LINE credential (encrypted at rest) — key เดียวกับ server dev default → route decrypt เจอ
    const encryptionKey = loadEncryptionKey(
      process.env.CHANNEL_ENCRYPTION_KEY ?? DEV_CHANNEL_ENCRYPTION_KEY,
    );
    const credentials = createChannelCredentialRepository(handle.db, encryptionKey);
    await credentials.upsert(DEMO_WORKSPACE_ID, DEMO_LINE_CHANNEL_ID, {
      channelAccessToken: DEMO_LINE_ACCESS_TOKEN,
      channelSecret: DEMO_LINE_CHANNEL_SECRET,
    });
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
      `seed ok · workspaceId=${DEMO_WORKSPACE_ID} · webChannel=${DEMO_CHANNEL_ID} · ` +
        `lineChannel=${DEMO_LINE_CHANNEL_ID} (secret=${DEMO_LINE_CHANNEL_SECRET}) · ` +
        `agent login: ${DEMO_AGENT_EMAIL} / ${DEMO_AGENT_PASSWORD}`,
    );
  } finally {
    await handle.close();
  }
}

void main();
