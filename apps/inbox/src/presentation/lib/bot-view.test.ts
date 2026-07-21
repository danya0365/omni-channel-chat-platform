import { describe, expect, it } from 'vitest';
import type { WireBotRule } from '../../domain/types';
import { buildAction, canSubmitRule, describeAction, replyTextOf, sortRules } from './bot-view';

const rule = (over: Partial<WireBotRule>): WireBotRule => ({
  id: 'botr_1',
  channelId: null,
  matchType: 'contains',
  pattern: 'สวัสดี',
  action: { kind: 'escalate' },
  enabled: true,
  priority: 10,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('bot-view (pure)', () => {
  it('describeAction: escalate → ข้อความโอน · reply → ข้อความที่จะตอบ', () => {
    expect(describeAction({ kind: 'escalate' })).toBe('โอนให้ทีมงาน');
    expect(describeAction({ kind: 'reply', content: { type: 'text', text: 'สวัสดีครับ' } })).toBe(
      'ตอบ: สวัสดีครับ',
    );
  });

  it('replyTextOf: reply → ข้อความ · escalate → ว่าง', () => {
    expect(replyTextOf({ kind: 'reply', content: { type: 'text', text: 'hi' } })).toBe('hi');
    expect(replyTextOf({ kind: 'escalate' })).toBe('');
  });

  it('buildAction: ประกอบ action จากค่าฟอร์ม', () => {
    expect(buildAction('escalate', 'ไม่ใช้')).toEqual({ kind: 'escalate' });
    expect(buildAction('reply', 'ตอบนะ')).toEqual({
      kind: 'reply',
      content: { type: 'text', text: 'ตอบนะ' },
    });
  });

  it('canSubmitRule: ต้องมี pattern · ถ้าเลือกตอบต้องมีข้อความตอบ', () => {
    expect(canSubmitRule('', 'escalate', '')).toBe(false);
    expect(canSubmitRule('  ', 'reply', 'hi')).toBe(false);
    expect(canSubmitRule('ราคา', 'escalate', '')).toBe(true);
    expect(canSubmitRule('ราคา', 'reply', '  ')).toBe(false);
    expect(canSubmitRule('ราคา', 'reply', 'ดูที่เว็บ')).toBe(true);
  });

  it('sortRules: priority น้อยก่อน · เท่ากันเรียงตามเวลาสร้าง (ไม่แก้ array เดิม)', () => {
    const input = [
      rule({ id: 'botr_c', priority: 20 }),
      rule({ id: 'botr_b', priority: 10, createdAt: '2026-01-02T00:00:00.000Z' }),
      rule({ id: 'botr_a', priority: 10, createdAt: '2026-01-01T00:00:00.000Z' }),
    ];
    expect(sortRules(input).map((r) => r.id)).toEqual(['botr_a', 'botr_b', 'botr_c']);
    expect(input[0]?.id).toBe('botr_c'); // ของเดิมไม่ถูกแก้
  });
});
