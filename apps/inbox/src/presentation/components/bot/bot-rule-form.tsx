'use client';

import { useState } from 'react';
import type { BotRuleAction, NewBotRule } from '../../../domain/types';
import { buildAction, canSubmitRule } from '../../lib/bot-view';
import { Button } from '../ui/button';
import { TextInput } from '../ui/text-input';

const KINDS: Array<{ key: BotRuleAction['kind']; label: string }> = [
  { key: 'reply', label: 'ตอบข้อความ' },
  { key: 'escalate', label: 'โอนให้ทีมงาน' },
];

/** ฟอร์มเพิ่มกติกาใหม่ — ถือ state ของฟอร์มเอง แล้วยิง onCreate ตัวเดียว (ไม่แตะ data layer) */
export function BotRuleForm({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (input: NewBotRule) => void;
}) {
  const [pattern, setPattern] = useState('');
  const [kind, setKind] = useState<BotRuleAction['kind']>('reply');
  const [text, setText] = useState('');
  const [priority, setPriority] = useState('100');

  const submit = () => {
    if (!canSubmitRule(pattern, kind, text)) return;
    onCreate({
      pattern: pattern.trim(),
      action: buildAction(kind, text.trim()),
      priority: Number(priority) || 100,
    });
    setPattern('');
    setText('');
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted-surface p-3">
      <p className="text-xs font-semibold text-card-foreground">เพิ่มกติกาใหม่</p>
      <TextInput
        value={pattern}
        onChange={(e) => setPattern(e.target.value)}
        placeholder="ลูกค้าพิมพ์คำว่า… (เช่น ราคา)"
        aria-label="คำที่ต้องเจอในข้อความลูกค้า"
      />
      <div className="flex gap-1">
        {KINDS.map((k) => (
          <Button
            key={k.key}
            variant={kind === k.key ? 'primary' : 'secondary'}
            onClick={() => setKind(k.key)}
            type="button"
          >
            {k.label}
          </Button>
        ))}
      </div>
      {kind === 'reply' ? (
        <TextInput
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ให้บอทตอบว่า…"
          aria-label="ข้อความที่บอทจะตอบ"
        />
      ) : null}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted" htmlFor="bot-rule-priority">
          ลำดับตรวจ (น้อยก่อน)
        </label>
        <TextInput
          id="bot-rule-priority"
          value={priority}
          inputMode="numeric"
          onChange={(e) => setPriority(e.target.value)}
          className="w-20"
        />
      </div>
      <Button
        onClick={submit}
        disabled={busy || !canSubmitRule(pattern, kind, text)}
        size="block"
        type="button"
      >
        เพิ่มกติกา
      </Button>
    </div>
  );
}
