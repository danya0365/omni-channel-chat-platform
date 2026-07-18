import Fastify, { type FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import type { AppDeps } from './deps';
import { registerWebRoutes } from './routes/web';

export type { AppDeps } from './deps';

/**
 * Composition root ของ backend · wire: CORS + WS plugin + /healthz + web channel routes
 * (repositories/services/registry ประกอบมาแล้วใน deps — buildApp แค่ต่อเข้า HTTP/WS)
 */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // widget อยู่คนละ origin กับ api → เปิด CORS
  // dev: สะท้อน origin ที่ยิงมา (origin: true) · prod ต้องจำกัดเป็น allowlist ของ workspace (Phase 3)
  await app.register(fastifyCors, { origin: true });

  // WS plugin ต้อง register ก่อนเพิ่ม route ที่ { websocket: true }
  await app.register(fastifyWebsocket);

  app.get('/healthz', () => ({ status: 'ok' }));

  registerWebRoutes(app, deps);

  return app;
}
