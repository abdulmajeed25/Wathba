// Batch DISC — Arabic labels for the advanced discover sidebar + sort.

export const SORTS: Array<{ key: string; ar: string }> = [
  { key: 'relevance', ar: 'الأنسب' },
  { key: 'popular', ar: 'الأكثر رواجاً' },
  { key: 'newest', ar: 'الأحدث' },
  { key: 'ending', ar: 'تاريخ الانتهاء' },
  { key: 'most_funded', ar: 'الأعلى تمويلاً' },
  { key: 'most_backed', ar: 'الأكثر داعمين' },
  { key: 'near_me', ar: 'الأقرب إليّ' },
];

export const PCT_OPTS: Array<{ key: string; ar: string }> = [
  { key: 'lt25', ar: 'أقل من 25٪' },
  { key: 'p25_50', ar: '25٪ – 50٪' },
  { key: 'p50_75', ar: '50٪ – 75٪' },
  { key: 'p75_100', ar: '75٪ – 100٪' },
  { key: 'gt100', ar: 'أكثر من 100٪' },
];

/** SAR brackets (facet keys match the API's MONEY_BRACKETS). */
export const MONEY_BRACKETS: Array<{ key: string; ar: string; min?: number; max?: number }> = [
  { key: 'lt10k', ar: 'أقل من 10,000 ر.س', max: 10_000 },
  { key: '10k_100k', ar: '10,000 – 100,000 ر.س', min: 10_000, max: 100_000 },
  { key: '100k_1m', ar: '100,000 – 1,000,000 ر.س', min: 100_000, max: 1_000_000 },
  { key: 'gt1m', ar: 'أكثر من 1,000,000 ر.س', min: 1_000_000 },
];

/** Saudi's 13 administrative regions (+ a major-city hint), for the location facet. */
export const REGIONS: Array<{ key: string; ar: string }> = [
  { key: 'RIYADH', ar: 'الرياض' },
  { key: 'MAKKAH', ar: 'مكة المكرمة (جدة)' },
  { key: 'MADINAH', ar: 'المدينة المنورة' },
  { key: 'QASSIM', ar: 'القصيم (بريدة)' },
  { key: 'EASTERN', ar: 'المنطقة الشرقية (الدمام)' },
  { key: 'ASIR', ar: 'عسير (أبها)' },
  { key: 'TABUK', ar: 'تبوك' },
  { key: 'HAIL', ar: 'حائل' },
  { key: 'NORTHERN_BORDERS', ar: 'الحدود الشمالية' },
  { key: 'JAZAN', ar: 'جازان' },
  { key: 'NAJRAN', ar: 'نجران' },
  { key: 'BAHAH', ar: 'الباحة' },
  { key: 'JAWF', ar: 'الجوف' },
];

/** The most-active regions shown as a quick-pick strip. */
export const QUICK_REGIONS = ['RIYADH', 'MAKKAH', 'EASTERN', 'QASSIM', 'ASIR'];

/**
 * Batch ACCOUNT / U3 — the platform renders NUMBERS in Latin digits.
 *
 * These two functions used to convert the other way, and they were the entire
 * reason the site showed numerals two ways at once: lib/i18n/format.ts has
 * documented "Western digits everywhere data is rendered" as the single source
 * of truth since STAKES/S-13, and localePresets.ar.numberingSystem is already
 * `latn` — so every Intl path was already Latin while these 55 call sites
 * converted their output back to Arabic-Indic on the way to the screen. The
 * hero read 312 while the discover cards beside it read ٣١٢.
 *
 * It also fixed a legibility problem nobody had named: ٠ (U+0660) is
 * glyphically a DOT, so a zero counter on a profile read as a missing value.
 * That was reported as a bug three times before it was diagnosed.
 *
 * ARABIC TEXT IS UNTOUCHED. This is a numerals-only decision and it is the one
 * place the owner has overridden rtl-arabic-override; direction, mirroring,
 * logical properties, Arabic leading and letter-spacing all remain Layer 1.
 *
 * The names changed with the behaviour. `toDisplayDigits` returning Latin
 * digits would be a lie in every one of its call sites.
 */
export function toDisplayDigits(n: number | string): string {
  return String(n);
}

/** Thousands-separated integer for display (e.g. 17,633). */
export function displayCount(n: number): string {
  return n.toLocaleString('en-US');
}


/**
 * Campaign-length buckets. Labels in days, Arabic-Indic digits come from
 * toDisplayDigits at the call site — <Num> is a typeface, not a converter.
 *
 * The spread is narrow today — 503 of 517 live projects run 30-45 days — so
 * this facet mostly says "everyone picks the default". The boundaries are set
 * for the range the platform ALLOWS (7-120 by policy), not for the range it
 * currently uses, so it starts discriminating as soon as creators vary.
 */
export const DURATION_OPTS: ReadonlyArray<{ key: string; labelAr: string }> = [
  { key: 'lt30', labelAr: 'أقل من 30 يوماً' },
  { key: 'd30_45', labelAr: '30 – 45 يوماً' },
  { key: 'd45_60', labelAr: '45 – 60 يوماً' },
  { key: 'gte60', labelAr: '60 يوماً فأكثر' },
];
