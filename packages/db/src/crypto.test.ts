import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, loadEncryptionKey } from './crypto';

const KEY = randomBytes(32);

describe('encryptSecret / decryptSecret', () => {
  it('round-trip: decrypt(encrypt(x)) === x (รวม unicode/emoji)', () => {
    const plain = 'line-channel-access-token-สมมติ-😀';
    expect(decryptSecret(encryptSecret(plain, KEY), KEY)).toBe(plain);
  });

  it('ciphertext ต่างกันทุกครั้ง (random iv) แต่ decrypt ได้ค่าเดิม', () => {
    const plain = 'same-secret';
    const a = encryptSecret(plain, KEY);
    const b = encryptSecret(plain, KEY);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, KEY)).toBe(plain);
    expect(decryptSecret(b, KEY)).toBe(plain);
  });

  it('payload มี version prefix v1 + 4 ส่วนคั่นด้วยจุด', () => {
    const parts = encryptSecret('x', KEY).split('.');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');
  });

  it('decrypt ด้วย key ผิด → throw (auth tag ไม่ผ่าน ไม่คืน plaintext พัง)', () => {
    const payload = encryptSecret('secret', KEY);
    const wrongKey = randomBytes(32);
    expect(() => decryptSecret(payload, wrongKey)).toThrow();
  });

  it('decrypt payload ที่ถูก tamper (แก้ ciphertext) → throw', () => {
    const [version, iv, tag] = encryptSecret('secret', KEY).split('.');
    const tamperedCt = Buffer.from('ของปลอม', 'utf8').toString('base64');
    const tampered = [version, iv, tag, tamperedCt].join('.');
    expect(() => decryptSecret(tampered, KEY)).toThrow();
  });

  it('decrypt format ผิด (ไม่ครบ 4 ส่วน / version ไม่ตรง) → throw', () => {
    expect(() => decryptSecret('not-a-valid-payload', KEY)).toThrow();
    expect(() => decryptSecret('v2.a.b.c', KEY)).toThrow();
  });
});

describe('loadEncryptionKey', () => {
  it('รับ hex 64 ตัว → Buffer 32 byte', () => {
    const hex = randomBytes(32).toString('hex');
    expect(loadEncryptionKey(hex).byteLength).toBe(32);
  });

  it('รับ base64 ของ 32 byte → Buffer 32 byte', () => {
    const b64 = randomBytes(32).toString('base64');
    expect(loadEncryptionKey(b64).byteLength).toBe(32);
  });

  it('key ที่ decode แล้วไม่ครบ 32 byte → throw', () => {
    expect(() => loadEncryptionKey('deadbeef')).toThrow();
    expect(() => loadEncryptionKey(randomBytes(16).toString('hex'))).toThrow();
  });

  it('key ที่ load ได้ ใช้ encrypt/decrypt ได้จริง', () => {
    const key = loadEncryptionKey(randomBytes(32).toString('hex'));
    expect(decryptSecret(encryptSecret('ok', key), key)).toBe('ok');
  });
});
