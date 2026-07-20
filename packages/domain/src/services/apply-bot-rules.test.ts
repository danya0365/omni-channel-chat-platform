import { describe, expect, it } from 'vitest';
import { applyBotRules } from './apply-bot-rules';
import type { BotRule } from '../schema/bot-rule';

const base: Omit<BotRule, 'id' | 'pattern' | 'action' | 'priority'> = {
  workspaceId: 'ws_1',
  channelId: null,
  matchType: 'contains',
  enabled: true,
  createdAt: new Date(Date.UTC(2026, 0, 1)),
};

const reply = (id: string, pattern: string, text: string, priority: number): BotRule => ({
  ...base,
  id: `botr_${id}`,
  pattern,
  priority,
  action: { kind: 'reply', content: { type: 'text', text } },
});

const escalate = (id: string, pattern: string, priority: number): BotRule => ({
  ...base,
  id: `botr_${id}`,
  pattern,
  priority,
  action: { kind: 'escalate' },
});

describe('applyBotRules', () => {
  it('match rule แบบ contains (case-insensitive) → reply พร้อม content', () => {
    const rules = [reply('hi', 'สวัสดี', 'ยินดีต้อนรับครับ', 10)];
    const d = applyBotRules('สวัสดีครับ อยากสอบถาม', rules);
    expect(d).toEqual({ kind: 'reply', content: { type: 'text', text: 'ยินดีต้อนรับครับ' } });
  });

  it('case-insensitive (pattern EN ตัวเล็ก match ข้อความตัวใหญ่)', () => {
    const d = applyBotRules('HELLO there', [reply('h', 'hello', 'hi!', 10)]);
    expect(d).toEqual({ kind: 'reply', content: { type: 'text', text: 'hi!' } });
  });

  it('priority น้อยกว่าชนะเมื่อ match หลาย rule', () => {
    const rules = [
      reply('lo', 'ราคา', 'ตอบ B (priority 20)', 20),
      reply('hi', 'ราคา', 'ตอบ A (priority 5)', 5),
    ];
    const d = applyBotRules('ขอราคาหน่อย', rules);
    expect(d).toEqual({ kind: 'reply', content: { type: 'text', text: 'ตอบ A (priority 5)' } });
  });

  it('rule action=escalate ที่ match → escalate', () => {
    const d = applyBotRules('ขอคุยกับแอดมิน', [escalate('adm', 'แอดมิน', 10)]);
    expect(d).toEqual({ kind: 'escalate' });
  });

  it('ไม่ match rule ไหนเลย → no_match (ให้ layer บนตัดสิน AI/escalate)', () => {
    const d = applyBotRules('xyz ไม่ตรงอะไร', [reply('hi', 'สวัสดี', 'ตอบ', 10)]);
    expect(d).toEqual({ kind: 'no_match' });
  });

  it('rule ที่ disabled ถูกข้าม (แม้ pattern จะ match)', () => {
    const disabled = { ...reply('off', 'สวัสดี', 'ไม่ควรตอบ', 1), enabled: false };
    const d = applyBotRules('สวัสดี', [disabled]);
    expect(d).toEqual({ kind: 'no_match' });
  });

  it('rules ว่าง → no_match', () => {
    expect(applyBotRules('อะไรก็ได้', [])).toEqual({ kind: 'no_match' });
  });
});
