import Fastify, { type FastifyInstance } from 'fastify';

/**
 * Composition root ของ backend — Phase 1 มีแค่ /healthz
 * Phase 2 จะ wire: webhook routes (channel adapters) + WS gateway + repositories (@omni/db)
 */
export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get('/healthz', () => ({ status: 'ok' }));

  return app;
}
