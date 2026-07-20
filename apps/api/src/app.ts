import Fastify, { type FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import type { AppDeps } from './deps';
import { registerAuthRoutes } from './routes/auth';
import { registerInboxRoutes } from './routes/inbox';
import { registerLineRoutes } from './routes/line';
import { registerWebRoutes } from './routes/web';

export type { AppDeps } from './deps';

/**
 * Composition root ของ backend · wire: CORS + WS plugin + /healthz + web channel routes
 * (repositories/services/registry ประกอบมาแล้วใน deps — buildApp แค่ต่อเข้า HTTP/WS)
 */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // cookie plugin — parse req.cookies (auth transport = httpOnly session cookie, ADR-0005) · register ก่อน routes
  await app.register(fastifyCookie);

  // widget + inbox อยู่คนละ origin กับ api → CORS · credentials:true ให้ browser แนบ cookie ข้าม origin
  // origin:true สะท้อน origin ที่ยิงมา (ไม่ใช่ * — จำเป็นเมื่อ credentials) · CSRF กันด้วย SameSite=Strict + Origin check
  await app.register(fastifyCors, { origin: true, credentials: true });

  // WS plugin ต้อง register ก่อนเพิ่ม route ที่ { websocket: true }
  await app.register(fastifyWebsocket);

  app.get('/healthz', () => ({ status: 'ok' }));

  registerAuthRoutes(app, deps);
  registerInboxRoutes(app, deps);
  registerWebRoutes(app, deps);
  registerLineRoutes(app, deps);

  return app;
}
