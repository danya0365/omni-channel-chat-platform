'use client';

import type { WireBotConfig } from '../../../domain/types';
import { cn } from '../../lib/cn';

interface ToggleProps {
  label: string;
  hint: string;
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
}

/** สวิตช์ 1 ตัว (ปุ่มธรรมดา + สถานะชัดด้วย token) — ไม่พึ่ง lib ภายนอก */
function Toggle({ label, hint, on, disabled, onToggle }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={on}
      className={cn(
        'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
        on ? 'border-brand-600 bg-brand-600 text-on-brand' : 'border-border bg-card text-muted',
      )}
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs opacity-80">{hint}</span>
      </span>
      <span className="text-xs font-semibold">{on ? 'เปิด' : 'ปิด'}</span>
    </button>
  );
}

/**
 * สวิตช์ automation ของ workspace — เปิดบอท / ให้ AI ช่วยตอบ
 * ⚠️ AI ต้องซื้อโมดูล `ai` ด้วย: เปิดที่นี่แล้วแต่ไม่ได้ซื้อ server จะไม่เรียก AI (บอกผู้ใช้ตรงๆ ผ่าน hint)
 */
export function BotSwitches({
  config,
  busy,
  aiPurchased,
  onChange,
}: {
  config: WireBotConfig;
  busy: boolean;
  aiPurchased: boolean;
  onChange: (next: { botEnabled: boolean; aiEnabled: boolean }) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Toggle
        label="เปิดบอทตอบอัตโนมัติ"
        hint="บอทรับสายใหม่และตอบตามกติกาด้านล่าง"
        on={config.botEnabled}
        disabled={busy}
        onToggle={() => onChange({ botEnabled: !config.botEnabled, aiEnabled: config.aiEnabled })}
      />
      <Toggle
        label="ให้ AI ช่วยตอบเมื่อไม่มีกติกาตรง"
        hint={aiPurchased ? 'ใช้ AI ตอบคำถามที่กติกาไม่ครอบคลุม' : 'ยังไม่ได้ซื้อแพ็กเกจ AI'}
        on={config.aiEnabled}
        disabled={busy || !aiPurchased}
        onToggle={() => onChange({ botEnabled: config.botEnabled, aiEnabled: !config.aiEnabled })}
      />
    </div>
  );
}
