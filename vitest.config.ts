import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts'],
    // integration test (*.integration.test.ts) รันแยกด้วย `pnpm test:integration` (ต้อง `pnpm db:up` ก่อน)
    // gate/CI จึงเขียวได้โดยไม่ต้องมี Postgres
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/*.integration.test.ts'],
    environment: 'node',
  },
});
