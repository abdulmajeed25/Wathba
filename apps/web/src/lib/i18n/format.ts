import { localePresets } from '@/config/locales';
import type { Locale } from '@/lib/i18n/config';

/* Gregorian + Western digits by default (§1.10) — bare ar-SA would pick the Islamic calendar. */
export function formatDate(locale: Locale, iso: string, style: 'long' | 'medium' = 'long'): string {
  const { intlLocale, numberingSystem } = localePresets[locale];
  return new Intl.DateTimeFormat(`${intlLocale}-u-ca-gregory-nu-${numberingSystem}`, {
    dateStyle: style,
  }).format(new Date(iso));
}

export function formatNumber(locale: Locale, value: number): string {
  const { intlLocale, numberingSystem } = localePresets[locale];
  return new Intl.NumberFormat(`${intlLocale}-u-nu-${numberingSystem}`).format(value);
}
