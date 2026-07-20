import type { BotRule } from '../schema/bot-rule';
import type { MessageContent } from '../schema/message';

/**
 * BotDecision — ผล match ข้อความลูกค้ากับ bot rules (pure)
 *   reply    = เจอ rule ให้ตอบ canned
 *   escalate = เจอ rule ที่สั่งโอนหา human (เช่น keyword "คุยกับคน")
 *   no_match = ไม่เจอ rule ไหน → layer บนตัดสิน (AI fallback หรือ escalate) ตาม policy ADR-0006
 */
export type BotDecision =
  { kind: 'reply'; content: MessageContent } | { kind: 'escalate' } | { kind: 'no_match' };

const norm = (s: string): string => s.toLowerCase();

/**
 * applyBotRules — pure: หา rule แรก (priority น้อย→มาก) ที่ enabled + pattern ตรงกับข้อความ แล้วคืน action
 * ไม่เจอ = no_match · deterministic (ไม่พึ่ง clock/io) → unit test ได้เต็มทุก branch
 * caller (consumer) ควร filter rules ตาม channel มาก่อน (repo.listEnabled) — ที่นี่ก็กัน disabled ให้อีกชั้น
 */
export function applyBotRules(text: string, rules: readonly BotRule[]): BotDecision {
  const haystack = norm(text);
  const ordered = [...rules].filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);
  for (const rule of ordered) {
    const matched = rule.matchType === 'contains' && haystack.includes(norm(rule.pattern));
    if (!matched) continue;
    return rule.action.kind === 'reply'
      ? { kind: 'reply', content: rule.action.content }
      : { kind: 'escalate' };
  }
  return { kind: 'no_match' };
}
