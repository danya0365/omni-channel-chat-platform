'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useThemeStore } from '../stores/theme-store';

/** apply template + dark ลง <html> ตอน runtime (ฟัง store) */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const template = useThemeStore((s) => s.template);
  const dark = useThemeStore((s) => s.dark);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', template);
    root.classList.toggle('dark', dark);
  }, [template, dark]);

  return <>{children}</>;
}

/**
 * inline blocking script — apply ธีมที่ persist ไว้ "ก่อน first paint" กัน FOUC (flash ธีม default)
 * อ่าน localStorage key เดียวกับ Zustand persist ("theme-storage")
 */
export function ThemeScript() {
  const code = `(function(){try{var s=JSON.parse(localStorage.getItem('theme-storage')||'{}');var st=s.state||{};var t=st.template||'violet';var r=document.documentElement;r.setAttribute('data-theme',t);if(st.dark)r.classList.add('dark');}catch(e){document.documentElement.setAttribute('data-theme','violet');}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
