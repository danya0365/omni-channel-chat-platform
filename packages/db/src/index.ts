// @omni/db — Drizzle schema + migrations + repositories (implement ports ของ @omni/domain)
// ที่นี่เป็น infrastructure adapter: พึ่ง domain ทางเดียว · raw webhook payload (JSONB) อยู่ที่นี่เท่านั้น
// Phase 2 จะเติม repositories + connection pool (pg) + migrations (drizzle-kit)

export * from './schema';
