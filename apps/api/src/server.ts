import { buildApp } from './app';
import { loadEnv } from './env';
import { createContainer } from './wiring';

/** dev-only creds (ตรงกับ docker-compose) — prod ต้องตั้ง DATABASE_URL เอง (ห้ามพึ่ง default นี้) */
const DEV_DATABASE_URL = 'postgresql://omni:omni_dev_only@localhost:5432/omni';
/** dev-only secret — prod ต้องตั้ง AUTH_SESSION_SECRET (ค่านี้ไม่ปลอดภัย ห้ามใช้จริง) */
const DEV_AUTH_SECRET = 'dev-only-insecure-session-secret-change-me';

/** เตือนถ้า env ที่ควรตั้งใน prod ไม่ได้ตั้ง (ไม่ throw — dev รันได้ด้วย default) — แยกกัน main() ซับซ้อนเกิน */
const warnUnset = (value: string | undefined, message: string): void => {
  if (!value) console.warn(message);
};

async function main(): Promise<void> {
  const env = loadEnv();
  const databaseUrl = env.DATABASE_URL ?? DEV_DATABASE_URL;
  const authSecret = env.AUTH_SESSION_SECRET ?? DEV_AUTH_SECRET;
  const allowedOrigins =
    env.ALLOWED_ORIGINS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  // ไม่ throw เพื่อให้ `pnpm dev` รันได้ทันทีกับ docker-compose · prod ควรตั้งค่าเหล่านี้เอง
  warnUnset(
    env.DATABASE_URL,
    'DATABASE_URL ไม่ได้ตั้ง — ใช้ dev database default (อย่าใช้ใน production)',
  );
  warnUnset(
    env.AUTH_SESSION_SECRET,
    'AUTH_SESSION_SECRET ไม่ได้ตั้ง — ใช้ dev secret default (อย่าใช้ใน production)',
  );
  warnUnset(
    env.CHANNEL_ENCRYPTION_KEY,
    'CHANNEL_ENCRYPTION_KEY ไม่ได้ตั้ง — ใช้ dev key default (อย่าใช้ใน production)',
  );
  warnUnset(
    allowedOrigins[0],
    'ALLOWED_ORIGINS ไม่ได้ตั้ง — CSRF Origin check ปิดอยู่ (prod ต้องตั้ง origin ของ inbox)',
  );
  // ANTHROPIC_API_KEY ไม่มี dev default (ยิง API จริงเสียเงิน) — ไม่ตั้ง = bot ทำงานแบบ rule-only
  warnUnset(
    env.ANTHROPIC_API_KEY,
    'ANTHROPIC_API_KEY ไม่ได้ตั้ง — bot AI fallback ปิด (ทำงานแบบ rule-only)',
  );

  const container = createContainer({
    databaseUrl,
    authSecret,
    channelEncryptionKey: env.CHANNEL_ENCRYPTION_KEY,
    // dev รันบน http localhost — Chromium ยอมส่ง Secure cookie ให้ localhost · ตั้ง COOKIE_SECURE=false ถ้าจำเป็น
    cookieSecure: env.COOKIE_SECURE !== 'false',
    allowedOrigins,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
  });
  const app = await buildApp(container.deps);

  // เริ่ม pg-boss relay (safety net) — ถ้าล้ม realtime ยังทำงานผ่าน immediate drain จึงแค่ warn ไม่ crash
  try {
    await container.start();
  } catch (error) {
    console.warn(
      'outbox relay เริ่มไม่สำเร็จ (realtime ยังทำงานผ่าน immediate drain):',
      error instanceof Error ? error.message : error,
    );
  }

  const shutdown = async () => {
    await app.close();
    await container.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    const address = await app.listen({ port: env.PORT, host: '0.0.0.0' });
    // log แค่ address ของ server เอง — ห้าม log PII/ข้อความลูกค้า (ดู AGENTS.md)
    console.log(`api listening on ${address}`);
  } catch (error) {
    console.error(error);
    await container.close();
    process.exit(1);
  }
}

void main();
