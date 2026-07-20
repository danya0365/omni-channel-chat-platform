import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../deps';
import { authFromRequest } from '../auth/require-agent';

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * routes ของ auth (agent inbox) — auth transport = **httpOnly cookie** (ADR-0005)
 *   POST /auth/login  → verify credential → set httpOnly cookie (+ token ใน body = fallback ระหว่าง migrate)
 *   POST /auth/logout → clear cookie
 *   GET  /auth/me     → (authed via cookie) คืนตัวตน — frontend ใช้ bootstrap session ตอนโหลด
 * ⚠️ ไม่ log email/password/token (PII/secret)
 */
export function registerAuthRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { auth, session } = deps;

  app.post('/auth/login', async (req, reply) => {
    const body = loginBodySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

    const result = await auth.login(body.data.email, body.data.password);
    if (!result) return reply.code(401).send({ error: 'invalid_credentials' });

    // httpOnly = JS อ่านไม่ได้ (กัน XSS ขโมย) · SameSite=Strict = ไม่ถูกส่ง cross-site (กัน CSRF)
    reply.setCookie(session.cookieName, result.token, {
      httpOnly: true,
      secure: session.secure,
      sameSite: 'strict',
      path: '/',
      maxAge: session.maxAgeSec,
    });
    return reply.send({
      // token ใน body = fallback ระหว่าง migrate — frontend ใหม่ใช้ cookie (ไม่เก็บ token)
      token: result.token,
      agent: {
        id: result.agent.id,
        workspaceId: result.agent.workspaceId,
        email: result.agent.email,
        displayName: result.agent.displayName,
      },
    });
  });

  app.post('/auth/logout', async (_req, reply) => {
    reply.clearCookie(session.cookieName, { path: '/' });
    return reply.send({ ok: true });
  });

  app.get('/auth/me', async (req, reply) => {
    const ctx = authFromRequest(req, auth, session.cookieName);
    if (!ctx) return reply.code(401).send({ error: 'unauthorized' });
    return reply.send({ workspaceId: ctx.workspaceId, agentId: ctx.agentId });
  });
}
