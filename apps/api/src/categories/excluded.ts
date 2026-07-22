/**
 * Batch SEARCH BUG-2 / Batch OPS (registry completion) — the PERMANENT
 * cultural exclusions (Music, LGBTQIA+, occult/divination, romance
 * showcases), extracted to a runtime module.
 *
 * Until now this list lived only in exclusions-guard.spec.ts, which guards
 * the SEED chain — but a runtime category-create operation could silently
 * re-introduce an excluded category. The content.categories.* operations
 * refuse via isExcludedCategory() as a precondition; the spec imports the
 * same constants so the two guards can never drift.
 */

/** Excluded slugs — matched exactly after kebab-casing. */
export const EXCLUDED_SLUGS: readonly string[] = [
  'music',
  'music-videos',
  'musical',
  'romance',
  'lgbt',
  'lgbtq',
  'queer',
  'tarot',
  'occult',
  'astrology',
  'divination',
];

/** Arabic name fragments that must never appear in a category name. */
export const EXCLUDED_NAME_FRAGMENTS: readonly string[] = ['موسيق', 'رومانس', 'تنجيم', 'تاروت', 'أبراج', 'مثلي'];

/** Same kebab rule the seed guard uses — keep in lockstep with the spec. */
export const kebab = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * True when a proposed category (any of slug / Arabic name / English name)
 * hits the permanent-exclusion list. Callers refuse the whole write.
 */
export function isExcludedCategory(candidate: { slug?: string | null; nameAr?: string | null; nameEn?: string | null }): boolean {
  const slugs = [candidate.slug, candidate.nameEn]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .map(kebab);
  if (slugs.some((s) => EXCLUDED_SLUGS.includes(s))) return true;
  const names = [candidate.nameAr, candidate.nameEn].filter((v): v is string => typeof v === 'string');
  return names.some((n) => EXCLUDED_NAME_FRAGMENTS.some((frag) => n.includes(frag)));
}
