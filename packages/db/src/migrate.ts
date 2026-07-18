import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database } from './client';

/** โฟลเดอร์ migration (source of truth ของ DB) — อยู่ที่ packages/db/migrations */
export const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/** รัน migration ทั้งหมด · idempotent (drizzle track migration ที่ apply แล้วใน __drizzle_migrations) */
export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder });
}
