import type { BotRuleAction, WireBotRule } from '../../domain/types';

/** ข้อความอธิบาย action ของ rule (โชว์ในลิสต์) — pure ทดสอบได้ ไม่ต้องมี DOM */
export function describeAction(action: BotRuleAction): string {
  return action.kind === 'escalate'
    ? 'โอนให้ทีมงาน'
    : `ตอบ: ${action.content.type === 'text' ? action.content.text : '(ไม่ใช่ข้อความ)'}`;
}

/** ข้อความตอบของ rule (ว่างถ้าเป็น escalate) — ใช้เติมค่าเริ่มต้นตอนแก้ */
export function replyTextOf(action: BotRuleAction): string {
  return action.kind === 'reply' && action.content.type === 'text' ? action.content.text : '';
}

/** สร้าง action จากค่าในฟอร์ม — kind 'reply' ที่ข้อความว่าง ถือว่าไม่ถูกต้อง (caller เช็ค canSubmit ก่อน) */
export function buildAction(kind: BotRuleAction['kind'], text: string): BotRuleAction {
  return kind === 'escalate'
    ? { kind: 'escalate' }
    : { kind: 'reply', content: { type: 'text', text } };
}

/** ฟอร์มส่งได้ไหม — pattern ต้องมี · ถ้าเลือก "ตอบ" ต้องมีข้อความตอบด้วย */
export function canSubmitRule(pattern: string, kind: BotRuleAction['kind'], text: string): boolean {
  if (pattern.trim().length === 0) return false;
  return kind === 'escalate' || text.trim().length > 0;
}

/** เรียง rule ตามลำดับที่บอทตรวจจริง (priority น้อยก่อน · เท่ากันเรียงตามเวลาสร้าง) */
export function sortRules(rules: WireBotRule[]): WireBotRule[] {
  return [...rules].sort(
    (a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt),
  );
}
