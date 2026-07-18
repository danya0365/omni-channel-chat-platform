import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema';

/** drizzle instance ผูกกับ schema ทั้งหมด (typed queries) */
export type Database = NodePgDatabase<typeof schema>;

export interface DbHandle {
  db: Database;
  pool: Pool;
  /** ปิด pool ตอน shutdown */
  close: () => Promise<void>;
}

/**
 * สร้าง connection pool (pg) + drizzle instance
 * เรียกที่ composition root (apps/api) จุดเดียว แล้ว inject db/repos เข้า service
 */
export function createDb(
  connectionString: string,
  config: Omit<PoolConfig, 'connectionString'> = {},
): DbHandle {
  const pool = new Pool({ connectionString, ...config });
  const db = drizzle(pool, { schema });
  return { db, pool, close: () => pool.end() };
}
