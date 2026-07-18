import { buildApp } from './app';
import { loadEnv } from './env';
import { createContainer } from './wiring';

/** dev-only creds (ตรงกับ docker-compose) — prod ต้องตั้ง DATABASE_URL เอง (ห้ามพึ่ง default นี้) */
const DEV_DATABASE_URL = 'postgresql://omni:omni_dev_only@localhost:5432/omni';

async function main(): Promise<void> {
  const env = loadEnv();
  const databaseUrl = env.DATABASE_URL ?? DEV_DATABASE_URL;
  if (!env.DATABASE_URL) {
    // ไม่ throw เพื่อให้ `pnpm dev` รันได้ทันทีกับ docker-compose · prod ควรตั้ง DATABASE_URL
    console.warn('DATABASE_URL ไม่ได้ตั้ง — ใช้ dev database default (อย่าใช้ใน production)');
  }

  const container = createContainer(databaseUrl);
  const app = await buildApp(container.deps);

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
