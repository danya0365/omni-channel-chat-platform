import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary';
type Size = 'sm' | 'md' | 'block';

// variant = สี+น้ำหนัก (token) · size = padding+ขนาด+กว้าง · cn() merge/dedupe ให้
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand-600 font-semibold text-on-brand hover:bg-brand-700',
  secondary: 'border border-border font-medium text-muted hover:bg-muted-surface',
};

const SIZE: Record<Size, string> = {
  sm: 'px-3 py-1 text-xs',
  md: 'px-5 py-2 text-sm',
  block: 'w-full py-2 text-sm',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/** ปุ่มมาตรฐาน inbox — รวม style ปุ่มที่เคยก๊อปซ้ำหลายที่ (รับเรื่อง/คืนสาย/ปิดสาย/ส่ง/login) */
export function Button({ variant = 'primary', size = 'sm', className, ...props }: Props) {
  return (
    <button
      {...props}
      className={cn(
        'rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
    />
  );
}
