import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../deps';
import { authFromHeader } from '../auth/require-agent';

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * routes ของ auth (agent inbox — Phase 3)
 *   POST /auth/login → verify credential → { token, agent }
 *   GET  /auth/me    → (authed) คืนตัวตนจาก token (ไว้ให้ frontend เช็ค session)
 * ⚠️ ไม่ log email/password/token (PII/secret)
 */
export function registerAuthRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { auth } = deps;

  app.post('/auth/login', async (req, reply) => {
    const body = loginBodySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

    const result = await auth.login(body.data.email, body.data.password);
    if (!result) return reply.code(401).send({ error: 'invalid_credentials' });

    return reply.send({
      token: result.token,
      agent: {
        id: result.agent.id,
        workspaceId: result.agent.workspaceId,
        email: result.agent.email,
        displayName: result.agent.displayName,
      },
    });
  });

  app.get('/auth/me', async (req, reply) => {
    const ctx = authFromHeader(req, auth);
    if (!ctx) return reply.code(401).send({ error: 'unauthorized' });
    return reply.send({ workspaceId: ctx.workspaceId, agentId: ctx.agentId });
  });
}
