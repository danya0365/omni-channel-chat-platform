import { describe, expect, it } from 'vitest';
import { idSchema, makeId } from './ids';

describe('ids', () => {
  it('makeId ประกอบ prefix + uuid เป็น `<prefix>_<uuid>`', () => {
    expect(makeId('ws', 'abc')).toBe('ws_abc');
    expect(makeId('msg', '018f-uuid')).toBe('msg_018f-uuid');
  });

  it('idSchema ผ่านเมื่อ prefix ตรง', () => {
    expect(idSchema('ws').safeParse('ws_123').success).toBe(true);
    expect(idSchema('conv').safeParse('conv_abc').success).toBe(true);
  });

  it('idSchema ไม่ผ่านเมื่อ prefix ผิด / ไม่มีส่วน uuid / ไม่ใช่ string', () => {
    expect(idSchema('ws').safeParse('chn_123').success).toBe(false); // prefix ผิด
    expect(idSchema('ws').safeParse('ws_').success).toBe(false); // ไม่มี uuid
    expect(idSchema('ws').safeParse('ws').success).toBe(false); // ไม่มี separator
    expect(idSchema('ws').safeParse(123).success).toBe(false); // ไม่ใช่ string
  });
});
