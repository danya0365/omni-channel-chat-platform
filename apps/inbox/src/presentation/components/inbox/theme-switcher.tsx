'use client';

import { cn } from '../../lib/cn';
import { useThemeStore, type ThemeTemplate } from '../../stores/theme-store';

const TEMPLATES: { value: ThemeTemplate; label: string }[] = [
  { value: 'violet', label: 'ม่วง' },
  { value: 'teal', label: 'เขียว' },
];

/** สลับ template + dark — วางในหัว sidebar (ใช้ token utility ล้วน) */
export function ThemeSwitcher() {
  const template = useThemeStore((s) => s.template);
  const dark = useThemeStore((s) => s.dark);
  const setTemplate = useThemeStore((s) => s.setTemplate);
  const toggleDark = useThemeStore((s) => s.toggleDark);

  return (
    <div className="flex items-center gap-0.5 rounded-full bg-muted-surface p-0.5">
      {TEMPLATES.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => setTemplate(t.value)}
          aria-pressed={template === t.value}
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-medium transition',
            template === t.value
              ? 'bg-brand-500 text-on-brand'
              : 'text-muted hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
      <button
        type="button"
        onClick={toggleDark}
        aria-pressed={dark}
        title={dark ? 'โหมดสว่าง' : 'โหมดมืด'}
        className="rounded-full px-2 py-0.5 text-[13px] text-muted transition hover:text-foreground"
      >
        {dark ? '☀' : '☾'}
      </button>
    </div>
  );
}
