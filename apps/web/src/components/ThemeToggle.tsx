'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="تبديل النمط"
      className="btng grid h-[42px] w-[42px] place-items-center rounded-(--radius-brand) border border-[rgba(var(--ink-rgb),0.12)]"
    >
      {theme === 'dark' ? (
        <Sun className="h-[21px] w-[21px] text-muted" />
      ) : (
        <Moon className="h-[21px] w-[21px] text-muted" />
      )}
    </button>
  );
}
