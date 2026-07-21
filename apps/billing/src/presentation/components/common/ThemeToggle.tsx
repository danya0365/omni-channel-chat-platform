'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

/**
 * ThemeToggle Component
 * Toggle between light and dark mode
 */
export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="theme-toggle-btn" aria-label="Toggle theme">
        <span className="text-lg">🌙</span>
      </button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="theme-toggle-btn"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็น Dark Mode'}
    >
      <span className="text-lg transition-transform duration-300 hover:scale-110">
        {isDark ? '☀️' : '🌙'}
      </span>
    </button>
  );
}
