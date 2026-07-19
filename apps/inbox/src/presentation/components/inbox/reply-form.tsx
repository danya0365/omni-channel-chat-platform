'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { TextInput } from '../ui/text-input';

/** กล่องพิมพ์ตอบ · onSend คืน true = ส่งสำเร็จ (เคลียร์ช่อง) · false = คืน draft ให้แก้ต่อ */
export function ReplyForm({ onSend }: { onSend: (text: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setSending(true);
    const ok = await onSend(text);
    if (!ok) setDraft(text);
    setSending(false);
  }

  return (
    <form onSubmit={submit} className="flex gap-2 border-t border-border bg-card px-4 py-3">
      <TextInput
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="พิมพ์ข้อความตอบ…"
        aria-label="ข้อความตอบ"
        className="flex-1"
      />
      <Button type="submit" size="md" disabled={sending || !draft.trim()}>
        ส่ง
      </Button>
    </form>
  );
}
