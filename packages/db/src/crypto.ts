import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Envelope encryption สำหรับ credential ต่อ channel (LINE access token/secret ฯลฯ) — เก็บ **encrypted at rest** ใน DB
 * AES-256-GCM (authenticated) · key 32 byte จาก env `CHANNEL_ENCRYPTION_KEY` · decrypt เฉพาะใน adapter ตอน verify/send
 *
 * ⚠️ plaintext credential ห้ามหลุด log/console (ดู AGENTS.md → PII/secret) — util นี้รับ/คืน string ตรงๆ ไม่ log อะไร
 * ⚠️ key rotation = ต้อง re-encrypt ทุกแถว (ยังไม่ทำ MVP) — version prefix `v1` เผื่อเปลี่ยน algorithm/format ภายหลัง
 */

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_BYTES = 12; // recommended nonce size ของ GCM
const KEY_BYTES = 32; // AES-256
const TAG_BYTES = 16; // GCM auth tag

/**
 * decode `CHANNEL_ENCRYPTION_KEY` (hex 64 ตัว หรือ base64) → Buffer 32 byte
 * length ผิด = throw ทันที (boot จะล้ม แทนที่จะเข้ารหัสด้วย key พัง) — เรียกครั้งเดียวตอน compose root
 */
export function loadEncryptionKey(raw: string): Buffer {
  const isHex = /^[0-9a-fA-F]{64}$/.test(raw);
  const key = isHex ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.byteLength !== KEY_BYTES) {
    throw new Error(
      `CHANNEL_ENCRYPTION_KEY ต้อง decode ได้ ${KEY_BYTES} byte (hex 64 ตัว หรือ base64) — ได้ ${key.byteLength} byte`,
    );
  }
  return key;
}

/**
 * encrypt plaintext → payload string `v1.<iv>.<tag>.<ciphertext>` (แต่ละส่วน base64)
 * random iv ต่อครั้ง → ciphertext ต่างกันทุกครั้งแม้ plaintext เดิม (semantic security)
 */
export function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

/**
 * decrypt payload string ที่ `encryptSecret` สร้าง → plaintext
 * auth tag ไม่ผ่าน (ciphertext/tag ถูกแก้ หรือ key ผิด) = throw (GCM verify) — ไม่คืน plaintext พัง
 */
export function decryptSecret(payload: string, key: Buffer): string {
  const [version, ivB64, tagB64, ctB64] = payload.split('.');
  if (version !== VERSION || !ivB64 || !tagB64 || !ctB64) {
    throw new Error('ciphertext format ไม่ถูกต้อง (คาดหวัง v1.<iv>.<tag>.<ct>)');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');
  if (iv.byteLength !== IV_BYTES || tag.byteLength !== TAG_BYTES) {
    throw new Error('ciphertext เสียหาย (iv/tag ขนาดผิด)');
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
