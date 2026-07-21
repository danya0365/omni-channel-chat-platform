'use client';

import type { UseBotAdmin } from '../../hooks/use-bot-admin';
import { sortRules } from '../../lib/bot-view';
import { Button } from '../ui/button';
import { BotRuleForm } from './bot-rule-form';
import { BotRuleRow } from './bot-rule-row';
import { BotSwitches } from './bot-switches';

/**
 * จอจัดการบอท (Phase 6) — drawer ขวา: สวิตช์ bot/AI + กติกา (เพิ่ม/เปิดปิด/ลบ)
 * แสดงเฉพาะ workspace ที่ซื้อโมดูล `bot` (ผู้เรียกเช็คแล้ว) — **server ยังบังคับสิทธิ์ซ้ำทุก request**
 * ไฟล์นี้เป็นตัวประกอบ: state มาจาก useBotAdmin · ชิ้นย่อยแยกไฟล์ (form/row/switches) กัน God component
 */
export function BotPanel({
  bot,
  aiPurchased,
  onClose,
}: {
  bot: UseBotAdmin;
  aiPurchased: boolean;
  onClose: () => void;
}) {
  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-card-foreground">ตั้งค่าบอท</p>
          <p className="text-xs text-muted">บอทตอบเองเมื่อลูกค้าทักตามคำที่กำหนด</p>
        </div>
        <Button variant="secondary" onClick={onClose} type="button">
          ปิด
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        {bot.error ? <p className="text-xs text-error">{bot.error}</p> : null}

        {bot.config ? (
          <BotSwitches
            config={bot.config}
            busy={bot.busy}
            aiPurchased={aiPurchased}
            onChange={(next) => void bot.setSwitches(next)}
          />
        ) : (
          <p className="text-xs text-muted">กำลังโหลด…</p>
        )}

        <BotRuleForm busy={bot.busy} onCreate={(input) => void bot.create(input)} />

        <ul className="flex flex-col gap-2">
          {sortRules(bot.rules).map((rule) => (
            <BotRuleRow
              key={rule.id}
              rule={rule}
              busy={bot.busy}
              onUpdate={(id, patch) => void bot.update(id, patch)}
              onRemove={(id) => void bot.remove(id)}
            />
          ))}
        </ul>
        {bot.rules.length === 0 && bot.config ? (
          <p className="text-xs text-muted">ยังไม่มีกติกา — เพิ่มข้อแรกด้านบนได้เลย</p>
        ) : null}
      </div>
    </aside>
  );
}
