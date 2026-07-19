import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit config — generate migration จาก src/schema.ts → ./migrations
 * DATABASE_URL default เป็น dev credentials ของ docker-compose (ไม่ใช่ secret — dev only)
 */
const url = process.env.DATABASE_URL ?? 'postgresql://omni:omni_dev_only@localhost:5432/omni';

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
