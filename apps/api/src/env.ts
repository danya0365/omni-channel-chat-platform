import { z } from 'zod';

/** env parse ตอน boot — validate ครั้งเดียวที่ boundary (ไม่ให้ untyped env รั่วเข้าโค้ด) */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url().optional(),
  /** secret สำหรับ sign session token — prod ต้องตั้ง (dev มี default + warning ใน server.ts) */
  AUTH_SESSION_SECRET: z.string().min(16).optional(),
  /**
   * key เข้ารหัส channel credential (LINE ฯลฯ) — hex 64 ตัว หรือ base64 ของ 32 byte
   * prod ต้องตั้ง (dev มี default + warning ใน server.ts) · rotate = ต้อง re-encrypt (ดู ADR-0004)
   */
  CHANNEL_ENCRYPTION_KEY: z.string().optional(),
  /** origins ของ inbox ที่ยอมให้ยิง state-changing request (CSRF Origin check) — comma-separated · prod ต้องตั้ง */
  ALLOWED_ORIGINS: z.string().optional(),
  /** ส่ง session cookie เฉพาะ HTTPS — default true · dev http ตั้ง 'false' ได้ (ADR-0005) */
  COOKIE_SECURE: z.string().optional(),
  /** key ของ Claude API — ตั้ง = เปิด AI fallback ของ bot (Phase 5B) · ไม่ตั้ง = bot ทำงาน rule-only */
  ANTHROPIC_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => envSchema.parse(source);
