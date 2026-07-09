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

/**
 * STAKES/S-13 (G10) — currency lives with the other formatters so there is
 * ONE formatting module. Numeral policy (documented here as the single
 * source of truth): Western digits everywhere data is rendered
 * (`nu-latn` / tabular Num), Gregorian calendar; Arabic-Indic glyphs are
 * reserved for purely decorative display type (the ٤٠٤ hero on not-found).
 */
export function formatSar(locale: Locale, amount: number): string {
  const formatter = new Intl.NumberFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', {
    maximumFractionDigits: 0,
  });
  return locale === 'ar' ? `${formatter.format(amount)} ر.س` : `SAR ${formatter.format(amount)}`;
}
