import type { FastifyRequest } from 'fastify';
import type { AuthContext, AuthService } from './service';

const BEARER = 'Bearer ';

/**
 * verify auth จาก request → AuthContext (null ถ้าไม่ผ่าน)
 * ลำดับ: httpOnly cookie (หลัก — ADR-0005) → Authorization: Bearer (fallback: server-to-server / ระหว่าง migrate)
 */
export function authFromRequest(
  req: FastifyRequest,
  auth: AuthService,
  cookieName: string,
): AuthContext | null {
  const cookieToken = req.cookies?.[cookieName];
  if (cookieToken) {
    const ctx = auth.authenticate(cookieToken);
    if (ctx) return ctx;
  }
  const header = req.headers.authorization;
  if (header?.startsWith(BEARER)) return auth.authenticate(header.slice(BEARER.length));
  return null;
}

/**
 * ดึง token จาก query string → verify (WS fallback — browser ตั้ง header ไม่ได้ · cookie มากับ handshake อยู่แล้ว)
 * ⚠️ token ใน URL อาจติด log proxy — ใช้เป็น fallback ระหว่าง migrate เท่านั้น
 */
export function authFromToken(token: string | undefined, auth: AuthService): AuthContext | null {
  if (!token) return null;
  return auth.authenticate(token);
}

/**
 * CSRF Origin check (defense-in-depth ร่วมกับ SameSite=Strict) สำหรับ state-changing request
 * - ไม่มี Origin header (server-to-server / test) → ผ่าน
 * - allowedOrigins ว่าง (ไม่ตั้ง config) → ผ่าน (dev/test)
 * - มี Origin + ไม่อยู่ allowlist → บล็อก (cross-site browser forge)
 */
export function isOriginAllowed(req: FastifyRequest, allowedOrigins: string[]): boolean {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.length === 0) return true;
  return allowedOrigins.includes(origin);
}
