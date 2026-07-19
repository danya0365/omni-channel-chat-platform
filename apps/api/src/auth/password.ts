import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;

/**
 * hash รหัสผ่านด้วย scrypt (built-in Node — ไม่เพิ่ม dependency, เลี่ยง native build)
 * รูปแบบเก็บ: `scrypt$<saltHex>$<hashHex>` (salt ต่อ record)
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(plain, salt, KEY_LEN)) as Buffer;
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** verify รหัสผ่าน · constant-time compare · false ถ้ารูปแบบ hash ผิด */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || saltHex === undefined || hashHex === undefined) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const derived = (await scryptAsync(plain, salt, expected.length)) as Buffer;
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
