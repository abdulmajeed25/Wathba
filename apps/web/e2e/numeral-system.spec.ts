import { expect, test } from '@playwright/test';

/**
 * Batch PAGE-PARITY U3 — one numeral system, held.
 *
 * The platform's rule is three-way and deliberate:
 *   · counts + percentages → Arabic-Indic (`toArabicDigits` / `arabicCount`)
 *   · money                → Latin, on purpose (`formatSar` pins `ar-SA-u-nu-latn`)
 *   · ids, refs, dates     → Latin, or already localised by Intl
 *
 * rtl-arabic-override's requirement is not "use Arabic-Indic everywhere" — it
 * is "decide once and do not mix systems in one surface". Money in Latin is an
 * explicit, defensible choice for a Gulf business UI.
 *
 * What broke it was a misreading: `<Num>` was believed to convert digits. It is
 * a Latin TYPEFACE wrapper and converts nothing, so three /spotlight stats
 * rendered «964 داعم» directly above a card rendering «٨٤٧ داعم» — two systems,
 * one screen.
 *
 * This asserts the COUNT surfaces only, which is where the rule is unambiguous.
 */
const COUNT_PAGES = ['/spotlight', '/projects', '/projects/discover-all'];

/*
 * LINE-BOUNDED, and that is not a detail.
 *
 * These were written with `\s*`, which crosses a newline. innerText puts each
 * card field on its own line, so «١٤٠٬٠٠٠» followed by «%٨٨» matched as
 * `"000\n%"` — the money's trailing digits joined to the next line's percent
 * sign — and the guard reported a Latin percentage that did not exist. Money is
 * deliberately Latin here, so a rule that can reach across lines will keep
 * finding it next to something Arabic.
 */
/** A Latin digit run immediately before a counting noun, same line. */
const LATIN_COUNT = /(?<![\d٠-٩])\d[\d,]*[ \t\u00a0]*(داعم|مشروع|مشروعاً|يوم|عرض|عروض)\b/g;
/** A Latin percentage, same line. */
const LATIN_PCT = /(?<![\d٠-٩])\d+[ \t\u00a0]*%|%[ \t\u00a0]*\d+(?![\d٠-٩])/g;

for (const route of COUNT_PAGES) {
  test(`NS1 ${route}: counts and percentages render in Arabic-Indic`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'networkidle' });

    // innerText, not HTML: this is about what a reader sees, and attributes
    // (slugs, ids, data-*) legitimately carry Latin digits.
    const text = await page.locator('main, body').first().innerText();

    const counts = text.match(LATIN_COUNT) ?? [];
    const pcts = text.match(LATIN_PCT) ?? [];

    expect(
      counts,
      `${route} renders Latin digits on a count — the platform counts in Arabic-Indic.\n` +
        `  ${counts.join('\n  ')}\n` +
        `  <Num> does not convert digits; wrap the value in toArabicDigits().`,
    ).toEqual([]);
    expect(
      pcts,
      `${route} renders a Latin percentage:\n  ${pcts.join('\n  ')}`,
    ).toEqual([]);
  });
}
