import { describe, expect, it, vi } from 'vitest';
import { createConnectionRegistry } from './registry';
import type { RegistrySocket } from './registry';

/** fake socket — คุม readyState ได้ (1 = OPEN) */
function fakeSocket(readyState = 1): RegistrySocket & { sent: string[] } {
  const sent: string[] = [];
  return { readyState, sent, send: (data: string) => sent.push(data) };
}

describe('ConnectionRegistry', () => {
  it('add แล้ว send → ส่งถึงทุก socket ที่ open ของ key เดียวกัน + คืนจำนวนที่ส่ง', () => {
    const registry = createConnectionRegistry();
    const a = fakeSocket();
    const b = fakeSocket();
    registry.add('k1', a);
    registry.add('k1', b);

    const delivered = registry.send('k1', 'hello');

    expect(delivered).toBe(2);
    expect(a.sent).toEqual(['hello']);
    expect(b.sent).toEqual(['hello']);
  });

  it('ส่งเฉพาะ key ที่ตรง — key อื่นไม่โดน', () => {
    const registry = createConnectionRegistry();
    const a = fakeSocket();
    const b = fakeSocket();
    registry.add('k1', a);
    registry.add('k2', b);

    registry.send('k1', 'to-k1');

    expect(a.sent).toEqual(['to-k1']);
    expect(b.sent).toEqual([]);
  });

  it('ข้าม socket ที่ไม่ open (readyState != 1)', () => {
    const registry = createConnectionRegistry();
    const open = fakeSocket(1);
    const closing = fakeSocket(2);
    registry.add('k1', open);
    registry.add('k1', closing);

    const delivered = registry.send('k1', 'x');

    expect(delivered).toBe(1);
    expect(open.sent).toEqual(['x']);
    expect(closing.sent).toEqual([]);
  });

  it('remove → ไม่ได้รับ + size ลดลง · ลบตัวสุดท้ายเคลียร์ key', () => {
    const registry = createConnectionRegistry();
    const a = fakeSocket();
    registry.add('k1', a);
    expect(registry.size('k1')).toBe(1);

    registry.remove('k1', a);
    expect(registry.size('k1')).toBe(0);
    expect(registry.send('k1', 'x')).toBe(0);
    expect(a.sent).toEqual([]);
  });

  it('send ไป key ที่ไม่มี → 0 (ไม่ throw)', () => {
    const registry = createConnectionRegistry();
    expect(registry.send('ไม่มี', 'x')).toBe(0);
  });

  it('remove socket ที่ไม่เคย add → เงียบ (ไม่ throw)', () => {
    const registry = createConnectionRegistry();
    expect(() => registry.remove('k1', fakeSocket())).not.toThrow();
  });

  it('add socket เดิมซ้ำ → นับเป็นตัวเดียว (Set)', () => {
    const registry = createConnectionRegistry();
    const a = fakeSocket();
    registry.add('k1', a);
    registry.add('k1', a);
    expect(registry.size('k1')).toBe(1);
    const spy = vi.spyOn(a, 'send');
    registry.send('k1', 'x');
    expect(spy).toHaveBeenCalledOnce();
  });
});
