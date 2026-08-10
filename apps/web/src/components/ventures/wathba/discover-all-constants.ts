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
  { key: 'lt25', ar: 'أقل من ٢٥٪' },
  { key: 'p25_50', ar: '٢٥٪ – ٥٠٪' },
  { key: 'p50_75', ar: '٥٠٪ – ٧٥٪' },
  { key: 'p75_100', ar: '٧٥٪ – ١٠٠٪' },
  { key: 'gt100', ar: 'أكثر من ١٠٠٪' },
];

/** SAR brackets (facet keys match the API's MONEY_BRACKETS). */
export const MONEY_BRACKETS: Array<{ key: string; ar: string; min?: number; max?: number }> = [
  { key: 'lt10k', ar: 'أقل من ١٠٬٠٠٠ ر.س', max: 10_000 },
  { key: '10k_100k', ar: '١٠٬٠٠٠ – ١٠٠٬٠٠٠ ر.س', min: 10_000, max: 100_000 },
  { key: '100k_1m', ar: '١٠٠٬٠٠٠ – ١٬٠٠٠٬٠٠٠ ر.س', min: 100_000, max: 1_000_000 },
  { key: 'gt1m', ar: 'أكثر من ١٬٠٠٠٬٠٠٠ ر.س', min: 1_000_000 },
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

export function toArabicDigits(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);
}

/** Arabic thousands-separated integer (e.g. ١٧٬٦٣٣). */
export function arabicCount(n: number): string {
  return toArabicDigits(n.toLocaleString('en-US')).replace(/,/g, '٬');
}


/**
 * Campaign-length buckets. Labels in days, Arabic-Indic digits come from
 * toArabicDigits at the call site — <Num> is a typeface, not a converter.
 *
 * The spread is narrow today — 503 of 517 live projects run 30-45 days — so
 * this facet mostly says "everyone picks the default". The boundaries are set
 * for the range the platform ALLOWS (7-120 by policy), not for the range it
 * currently uses, so it starts discriminating as soon as creators vary.
 */
export const DURATION_OPTS: ReadonlyArray<{ key: string; labelAr: string }> = [
  { key: 'lt30', labelAr: 'أقل من ٣٠ يوماً' },
  { key: 'd30_45', labelAr: '٣٠ – ٤٥ يوماً' },
  { key: 'd45_60', labelAr: '٤٥ – ٦٠ يوماً' },
  { key: 'gte60', labelAr: '٦٠ يوماً فأكثر' },
];
