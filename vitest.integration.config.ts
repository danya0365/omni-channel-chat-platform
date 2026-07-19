import { defineConfig } from 'vitest/config';

/**
 * Integration test config — รันด้วย `pnpm test:integration` (ต้อง `pnpm db:up` ก่อน)
 * ต่อ Postgres จริงตาม DATABASE_URL (default = dev credentials ของ docker-compose)
 */
export default defineConfig({
  test: {
    include: ['**/*.integration.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 30000,
    // ต่อ DB เดียวกัน — รันทีละไฟล์กัน state ชนกัน
    fileParallelism: false,
  },
});
