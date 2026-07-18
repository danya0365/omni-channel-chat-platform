import { buildApp } from './app';
import { loadEnv } from './env';

const env = loadEnv();
const app = buildApp();

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then((address) => {
    // log แค่ address ของ server เอง — ห้าม log PII/ข้อความลูกค้า (ดู AGENTS.md)
    console.log(`api listening on ${address}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
