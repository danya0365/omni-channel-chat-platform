import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Session token = compact HMAC-SHA256 signed token (`<payloadB64url>.<sigB64url>`)
 * payload อ่านได้ (ไม่เข้ารหัส) แต่แก้ไม่ได้ (signature) — พอสำหรับ auth ขั้นต่ำ MVP
 * ⚠️ ไม่ใช่ JWT มาตรฐาน (ตั้งใจ zero-dep) · upgrade เป็น jose/Auth.js + OIDC ทีหลัง (ดู ADR-0003)
 */
export interface SessionClaims {
  workspaceId: string;
  agentId: string;
  /** เวลาหมดอายุ (unix seconds) */
  exp: number;
}

const b64url = (input: string): string => Buffer.from(input).toString('base64url');
const sign = (data: string, secret: string): string =>
  createHmac('sha256', secret).update(data).digest('base64url');

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/** ออก signed token — ฝัง workspaceId+agentId + exp (นับจาก now + ttl) */
export function signSession(
  claims: Omit<SessionClaims, 'exp'>,
  secret: string,
  ttlSec: number,
  now: number = nowSeconds(),
): string {
  const payload: SessionClaims = { ...claims, exp: now + ttlSec };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

/** verify token → claims · null ถ้า signature ผิด / หมดอายุ / รูปแบบผิด */
export function verifySession(
  token: string,
  secret: string,
  now: number = nowSeconds(),
): SessionClaims | null {
  const [body, sig] = token.split('.');
  if (body === undefined || sig === undefined) return null;

  const expected = sign(body, secret);
  const sigBuf = Buffer.from(sig, 'base64url');
  const expBuf = Buffer.from(expected, 'base64url');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionClaims;
    if (
      typeof claims.workspaceId !== 'string' ||
      typeof claims.agentId !== 'string' ||
      typeof claims.exp !== 'number' ||
      claims.exp < now
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}
