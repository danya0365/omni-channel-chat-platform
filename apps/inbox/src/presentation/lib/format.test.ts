import { describe, expect, it } from 'vitest';
import { contentText, timeLabel } from './format';

describe('timeLabel', () => {
  it('iso ที่ parse ไม่ได้ → คืน empty string', () => {
    expect(timeLabel('not-a-date')).toBe('');
    expect(timeLabel('')).toBe('');
  });
  it('iso ที่ถูกต้อง → รูปแบบ HH:mm (robust ต่อ timezone ของ runner)', () => {
    expect(timeLabel('2026-07-19T10:30:00.000Z')).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('contentText', () => {
  it('text content → คืน text', () => {
    expect(contentText({ type: 'text', text: 'สวัสดีครับ' })).toBe('สวัสดีครับ');
  });
});
