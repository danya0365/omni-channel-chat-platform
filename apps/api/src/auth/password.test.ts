import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password (scrypt)', () => {
  it('hash แล้ว verify ด้วยรหัสเดิม → true', async () => {
    const hash = await hashPassword('s3cret-รหัสผ่าน');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('s3cret-รหัสผ่าน', hash)).toBe(true);
  });

  it('รหัสผิด → false', async () => {
    const hash = await hashPassword('correct');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('hash แต่ละครั้งไม่ซ้ำกัน (salt ต่อ record)', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('รูปแบบ hash ผิด → false (ไม่ throw)', async () => {
    expect(await verifyPassword('x', 'ไม่ใช่รูปแบบ')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$aa$bb')).toBe(false);
  });
});
