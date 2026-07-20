import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { agents, createDb, createIdGenerator, runMigrations, workspaces } from '@omni/db';
import type { DbHandle } from '@omni/db';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import { hashPassword } from './auth/password';
import { createContainer } from './wiring';
import type { Container } from './wiring';

/**
 * e2e ของ item (e) — auth httpOnly cookie + CSRF Origin check (integration — ต้อง pnpm db:up):
 *   login → Set-Cookie (httpOnly session) → เข้าถึง protected route ด้วย cookie ·
 *   state-changing request ที่ Origin ไม่อยู่ allowlist → 403 (CSRF defense) · logout → clear cookie
 */
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://omni:omni_dev_only@localhost:5432/omni';
const AUTH_SECRET = 'integration-test-secret-16+';
const AGENT_PASSWORD = 'pw12345';
const ALLOWED_ORIGIN = 'http://inbox.allowed.test';

let seedHandle: DbHandle;
let container: Container;
let app: FastifyInstance;
let baseUrl: string;

beforeAll(async () => {
  seedHandle = createDb(DATABASE_URL);
  await runMigrations(seedHandle.db);
});
afterAll(async () => {
  await seedHandle.close();
});

beforeEach(async () => {
  await seedHandle.db.execute(sql`truncate table ${workspaces} restart identity cascade`);
  const gen = createIdGenerator();
  await seedHandle.db
    .insert(workspaces)
    .values({ id: gen('ws'), name: 'WS cookie' })
    .returning();
  container = createContainer({
    databaseUrl: DATABASE_URL,
    authSecret: AUTH_SECRET,
    cookieSecure: false,
    allowedOrigins: [ALLOWED_ORIGIN],
  });
  app = await buildApp(container.deps);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});
afterEach(async () => {
  await app.close();
  await container.close();
});

async function seedAgent(): Promise<void> {
  const gen = createIdGenerator();
  const [ws] = await seedHandle.db.select().from(workspaces);
  await seedHandle.db.insert(agents).values({
    id: gen('agt'),
    workspaceId: ws?.id ?? gen('ws'),
    email: 'agent@cookie.local',
    passwordHash: await hashPassword(AGENT_PASSWORD),
    displayName: 'Cookie Agent',
  });
}

/** login แล้วดึงค่า session cookie จาก Set-Cookie (คืน `session=<value>` สำหรับส่งต่อเป็น Cookie header) */
async function loginCookie(): Promise<string> {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'agent@cookie.local', password: AGENT_PASSWORD }),
  });
  expect(res.status).toBe(200);
  const setCookie = res.headers.get('set-cookie') ?? '';
  const pair = setCookie.split(';')[0] ?? '';
  expect(pair.startsWith('session=')).toBe(true);
  // ยืนยัน httpOnly (JS อ่านไม่ได้) + SameSite=Strict
  expect(setCookie.toLowerCase()).toContain('httponly');
  expect(setCookie.toLowerCase()).toContain('samesite=strict');
  return pair;
}

describe('auth httpOnly cookie + CSRF Origin check (integration — ต้อง pnpm db:up)', () => {
  it('login set httpOnly cookie → /auth/me ด้วย cookie = 200 · ไม่มี cookie = 401', async () => {
    await seedAgent();
    const cookie = await loginCookie();

    const me = await fetch(`${baseUrl}/auth/me`, { headers: { cookie } });
    expect(me.status).toBe(200);
    const body = (await me.json()) as { agentId: string };
    expect(body.agentId.startsWith('agt_')).toBe(true);

    const noCookie = await fetch(`${baseUrl}/auth/me`);
    expect(noCookie.status).toBe(401);
  });

  it('state-changing (assign) — Origin ไม่อยู่ allowlist → 403 · Origin ที่อนุญาต/ไม่มี Origin → ผ่าน origin check', async () => {
    await seedAgent();
    const cookie = await loginCookie();
    const assignUrl = `${baseUrl}/inbox/conversations/conv_nonexistent/assign`;

    // cross-site Origin → บล็อก (CSRF)
    const evil = await fetch(assignUrl, {
      method: 'POST',
      headers: { cookie, origin: 'http://evil.attacker.test' },
    });
    expect(evil.status).toBe(403);
    expect((await evil.json()) as { error: string }).toEqual({ error: 'forbidden_origin' });

    // Origin ที่อนุญาต → ผ่าน origin check (ไปต่อจน 404 conversation ไม่มีจริง)
    const allowed = await fetch(assignUrl, {
      method: 'POST',
      headers: { cookie, origin: ALLOWED_ORIGIN },
    });
    expect(allowed.status).toBe(404);

    // ไม่มี Origin (server-to-server) → ผ่าน origin check
    const noOrigin = await fetch(assignUrl, { method: 'POST', headers: { cookie } });
    expect(noOrigin.status).toBe(404);

    // ไม่มี cookie → 401 (auth ก่อน)
    const noAuth = await fetch(assignUrl, { method: 'POST', headers: { origin: ALLOWED_ORIGIN } });
    expect(noAuth.status).toBe(401);
  });

  it('logout → clear cookie (Set-Cookie ล้างค่า)', async () => {
    await seedAgent();
    const cookie = await loginCookie();
    const res = await fetch(`${baseUrl}/auth/logout`, { method: 'POST', headers: { cookie } });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('session=');
    // clear = expires ในอดีต หรือ maxAge 0
    expect(setCookie.toLowerCase()).toMatch(/expires=|max-age=0/);
  });
});
