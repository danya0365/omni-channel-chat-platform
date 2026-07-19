import { defineConfig, devices } from '@playwright/test';

/**
 * e2e ของ agent inbox (headless) — verify browser จริงหลัง refactor hexagonal
 * spin up stack เอง: api (:4001, seed ก่อน) + inbox (:4002, ชี้ api ที่ 4001)
 * ⚠️ ต้อง `pnpm db:up` (Postgres) ก่อนรัน · ใช้ port แยก (4001/4002) กันชนกับ dev server ที่ค้าง (3000/3001)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 40_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4002',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @omni/api seed:dev && pnpm --filter @omni/api start',
      env: { PORT: '4001' },
      url: 'http://localhost:4001/healthz',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'rm -rf .next && pnpm exec next dev -p 4002',
      env: { NEXT_PUBLIC_API_ORIGIN: 'http://localhost:4001' },
      url: 'http://localhost:4002',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
