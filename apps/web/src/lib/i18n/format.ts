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

/**
 * Batch POLISH Unit 5 — the API stores money in HALALAS (integer minor units),
 * so almost every caller was doing `(h / 100).toLocaleString(...) + ' ر.س'` by
 * hand. Nine files had defined their own local `fmtSAR` doing exactly that, and
 * they had drifted: three passed 'ar-SA' (Arabic-Indic digits) while the rest
 * passed 'en-US' (Western), so the same platform showed money two different ways.
 * One function, one numeral system.
 */
export function formatSarFromHalalas(locale: Locale, halalas: number | bigint): string {
  return formatSar(locale, Number(halalas) / 100);
}

/**
 * Batch POLISH Unit 5 — compact SAR for stat tiles and card ribbons, where the
 * full grouped number is too long to sit next to a label.
 *
 *   312_000_000 → «312 مليون ر.س»      (not "$312M")
 *     1_940_000 → «1.9 مليون ر.س»
 *        45_000 → «45 ألف ر.س»
 *           850 → «850 ر.س»
 *
 * Wathba is SAR-only, so there is no currency argument: a caller cannot pick the
 * wrong one. The abbreviations are Arabic words rather than transliterated M/K,
 * which is what an Arabic reader expects and what the rest of the copy uses.
 * Digits stay Western per the numeral policy documented on formatSar above.
 */
export function formatSarCompact(locale: Locale, amount: number): string {
  const abs = Math.abs(amount);
  const num = (v: number, decimals: number) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', {
      maximumFractionDigits: decimals,
    }).format(v);

  if (abs >= 1e6) {
    const v = amount / 1e6;
    // One decimal below 10M ("1.9 مليون"), none above ("312 مليون").
    const n = num(v, abs >= 1e7 ? 0 : 1);
    return locale === 'ar' ? `${n} مليون ر.س` : `SAR ${n}M`;
  }
  if (abs >= 1e3) {
    const n = num(Math.round(amount / 1e3), 0);
    return locale === 'ar' ? `${n} ألف ر.س` : `SAR ${n}K`;
  }
  return formatSar(locale, amount);
}
