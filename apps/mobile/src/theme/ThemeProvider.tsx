import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palettes, type Palette, type ThemeName, fonts, spacing, radii, fontSizes, lineHeights } from '@wathba/ui-tokens';

interface ThemeContextValue {
  name: ThemeName;
  colors: Palette;
  fonts: typeof fonts;
  spacing: typeof spacing;
  radii: typeof radii;
  fontSizes: typeof fontSizes;
  lineHeights: typeof lineHeights;
  setTheme: (next: ThemeName) => void;
  toggle: () => void;
}

const STORAGE_KEY = '@wathba/theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const sysScheme: ColorSchemeName = Appearance.getColorScheme();
  const [name, setName] = useState<ThemeName>(sysScheme === 'dark' ? 'dark' : 'light');

  // Load persisted preference on mount.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'light' || v === 'dark') setName(v);
    });
  }, []);

  // Follow system changes only if user hasn't explicitly chosen.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      AsyncStorage.getItem(STORAGE_KEY).then((v) => {
        if (!v && colorScheme) setName(colorScheme === 'dark' ? 'dark' : 'light');
      });
    });
    return () => sub.remove();
  }, []);

  const setTheme = useCallback((next: ThemeName) => {
    setName(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const toggle = useCallback(() => {
    setName((curr) => {
      const next: ThemeName = curr === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      name,
      colors: palettes[name],
      fonts,
      spacing,
      radii,
      fontSizes,
      lineHeights,
      setTheme,
      toggle,
    }),
    [name, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
