import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/** input มาตรฐาน inbox — รวม style ที่เคยก๊อประหว่าง login form กับ reply box */
export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground outline-none focus:border-ring',
        className,
      )}
    />
  );
}
