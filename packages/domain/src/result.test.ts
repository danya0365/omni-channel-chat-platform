import { describe, expect, it } from 'vitest';
import { err, isErr, isOk, ok } from './result';

describe('Result', () => {
  it('ok() → is Ok, value ถูกต้อง', () => {
    const result = ok(42);
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
    if (result.ok) expect(result.value).toBe(42);
  });

  it('err() → is Err, error ถูกต้อง', () => {
    const result = err('boom');
    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
    if (!result.ok) expect(result.error).toBe('boom');
  });
});
