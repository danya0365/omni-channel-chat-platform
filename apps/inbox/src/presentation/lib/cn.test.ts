import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('รวม class ปกติ', () => {
    expect(cn('flex', 'gap-2')).toBe('flex gap-2');
  });
  it('conditional (clsx) — falsy ถูกตัดทิ้ง', () => {
    const yes = true as boolean;
    const no = false as boolean;
    expect(cn('p-2', false, null, undefined, 'text-sm')).toBe('p-2 text-sm');
    expect(cn('a', yes && 'b', no && 'c')).toBe('a b');
  });
  it('dedupe custom color token ที่ชนกัน → class หลังชนะ (extendTailwindMerge)', () => {
    // vanilla twMerge จะ fail ข้อนี้ (ไม่รู้จัก text-success/text-error ว่าเป็นสี)
    expect(cn('text-success', 'text-error')).toBe('text-error');
    expect(cn('bg-card', 'bg-brand-600')).toBe('bg-brand-600');
    expect(cn('bg-brand-100', 'bg-brand-500')).toBe('bg-brand-500');
  });
  it('conditional override — base + branch ชนกัน merge ถูก', () => {
    const on = true as boolean;
    expect(cn('bg-muted-surface', on ? 'bg-brand-600' : 'bg-muted-surface')).toBe('bg-brand-600');
  });
});
