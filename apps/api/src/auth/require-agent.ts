import type { FastifyRequest } from 'fastify';
import type { AuthContext, AuthService } from './service';

const BEARER = 'Bearer ';

/** ดึง Bearer token จาก Authorization header → verify → AuthContext (null ถ้าไม่มี/ไม่ผ่าน) */
export function authFromHeader(req: FastifyRequest, auth: AuthService): AuthContext | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith(BEARER)) return null;
  return auth.authenticate(header.slice(BEARER.length));
}

/**
 * ดึง token จาก query string → verify (สำหรับ WS ที่ browser ตั้ง header ไม่ได้)
 * ⚠️ token ใน URL อาจติด log ของ proxy — MVP รับได้ · prod ควรใช้ subprotocol/cookie (ทีหลัง)
 */
export function authFromToken(token: string | undefined, auth: AuthService): AuthContext | null {
  if (!token) return null;
  return auth.authenticate(token);
}
