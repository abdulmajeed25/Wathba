export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ar';

export const LOCALE_COOKIE = 'locale';

const rtlLocales: ReadonlySet<string> = new Set(['ar']);

export type Dir = 'rtl' | 'ltr';

export function getDir(locale: Locale): Dir {
  return rtlLocales.has(locale) ? 'rtl' : 'ltr';
}

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (locales as readonly string[]).includes(value);
}
