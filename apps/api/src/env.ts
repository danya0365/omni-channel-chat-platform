import { z } from 'zod';

/** env parse ตอน boot — validate ครั้งเดียวที่ boundary (ไม่ให้ untyped env รั่วเข้าโค้ด) */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url().optional(),
  /** secret สำหรับ sign session token — prod ต้องตั้ง (dev มี default + warning ใน server.ts) */
  AUTH_SESSION_SECRET: z.string().min(16).optional(),
});

export type Env = z.infer<typeof envSchema>;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => envSchema.parse(source);
