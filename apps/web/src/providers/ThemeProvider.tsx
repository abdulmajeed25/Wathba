'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type ThemeName = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (next: ThemeName) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'wathba.theme';

function applyTheme(theme: ThemeName) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('light');

  useEffect(() => {
    const stored = (typeof window !== 'undefined' &&
      (localStorage.getItem(STORAGE_KEY) as ThemeName | null)) ?? null;
    if (stored === 'light' || stored === 'dark') {
      setThemeState(stored);
      applyTheme(stored);
      return;
    }
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const next: ThemeName = prefersDark ? 'dark' : 'light';
    setThemeState(next);
    applyTheme(next);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem(STORAGE_KEY)) return; // user wins
      const next: ThemeName = e.matches ? 'dark' : 'light';
      setThemeState(next);
      applyTheme(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setThemeState((curr) => {
      const next: ThemeName = curr === 'light' ? 'dark' : 'light';
      applyTheme(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/**
 * Inline boot script — sets data-theme on <html> before React hydrates,
 * eliminating the light→dark flash for dark-mode users.
 */
export const THEME_BOOT_SCRIPT = `
(function(){try{
  var s=localStorage.getItem('${STORAGE_KEY}');
  var t = s==='dark' || s==='light'
    ? s
    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.style.colorScheme = t;
}catch(e){document.documentElement.setAttribute('data-theme','light');}})();
`;
