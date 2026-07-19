import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// ⚠️ SYNC: mirror ชื่อ color token ที่ register ใน app/theme.css (twMerge อ่าน CSS ไม่ได้ ต้องบอกเอง)
// ไม่งั้น cn("text-success","text-error") จะไม่ dedupe (เหลือทั้งคู่) เพราะ twMerge ไม่รู้ว่าเป็น "สี"
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        'background',
        'foreground',
        'card',
        'card-foreground',
        'muted',
        'muted-surface',
        'border',
        'ring',
        'on-brand',
        'brand',
        'accent',
        'success',
        'success-surface',
        'warning',
        'warning-surface',
        'error',
        'error-surface',
      ],
    },
  },
});

/** รวม className อย่างปลอดภัย — clsx (conditional) + tailwind-merge (dedupe คลาสที่ชนกัน · class หลังชนะ) */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
