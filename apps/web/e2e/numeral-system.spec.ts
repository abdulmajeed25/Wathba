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
/*
 * `متابِع`, `متابِعون` and the plural `مشاريع` were missing, and that is not a
 * detail: they are the nouns the PROFILE surfaces count in, so the rule read
 * as satisfied on the only two pages that were breaking it.
 */
/*
 * NO TRAILING \b, and that is the fix NS0 forced.
 *
 * `\b` is defined on ASCII word characters. Arabic letters are not word
 * characters in JS regex, so `…داعم\b` asserts a boundary between two
 * non-word positions and never matches — the guard had been weaker than it
 * read for as long as it existed. A negative lookahead for another Arabic
 * letter does the job the \b was there for: it stops «مشروع» matching inside
 * «مشروعات» without depending on a word class that excludes the script.
 *
 * Longest alternative first, too: with «متابِع» ahead of «متابِعون» the shorter
 * one wins and the lookahead then rejects the trailing «ون».
 */
const COUNT_NOUN = '(?:متابِعون|متابِع|مشروعاً|مشاريع|مشروع|داعم|عروض|عرض|يوم)';
const LATIN_COUNT = new RegExp(
  `(?<![\\d٠-٩])\\d[\\d,]*[ \\t\\u00a0]*${COUNT_NOUN}(?![\\u0600-\\u06FF])`,
  'g',
);
/** A Latin percentage, same line. */
const LATIN_PCT = /(?<![\d٠-٩])\d+[ \t\u00a0]*%|%[ \t\u00a0]*\d+(?![\d٠-٩])/g;

/**
 * NS0 — the patterns are proved against known-bad text, not only against pages
 * that happen to be clean.
 *
 * A regex guard that matches nothing passes on every page, including the broken
 * ones. These are the exact strings the profile shipped before the fix:
 * «142 متابِعون» beside «4 مشاريع أنشأها», and a project card at «130%». If a
 * future edit narrows the noun list or the digit class, this fails here rather
 * than going quiet on the pages it is meant to police.
 */
test('NS0: the guards match the text they exist to catch', () => {
  expect('142 متابِعون'.match(LATIN_COUNT), 'must catch a Latin follower count').not.toBeNull();
  expect('4 مشاريع أنشأها'.match(LATIN_COUNT), 'must catch a Latin project count').not.toBeNull();
  expect('٥ مشروع'.match(LATIN_COUNT), 'must NOT flag an Arabic-Indic count').toBeNull();
  expect('130%'.match(LATIN_PCT), 'must catch a Latin percentage').not.toBeNull();
  expect('%١٣٠'.match(LATIN_PCT), 'must NOT flag an Arabic-Indic percentage').toBeNull();
});

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

/**
 * NS2 — the two surfaces the list above never reached.
 *
 * COUNT_PAGES is a list of static routes, and both of these carry an id in the
 * path, so neither was ever checked. That is the whole reason they drifted: the
 * public profile rendered «142 متابِعون» in Latin directly beneath an
 * Intl-localised «انضم يوليو ٢٠٢٦» in Arabic-Indic — two numeral systems in one
 * card — while /projects three clicks away rendered «٥ مشروع».
 *
 * The ids are DISCOVERED, not pinned: the e2e purge deletes fixtures between
 * runs, so a hardcoded id would 404 and this would skip its way to green.
 */
test('NS2: the id-bearing profile surfaces count in Arabic-Indic too', async ({ page }) => {
  await page.goto('/projects/discover-all', { waitUntil: 'networkidle' });
  // Scan every href for one that actually carries an id. Taking `.first()`
  // matched the nav's own /projects/discover-all link and yielded undefined —
  // which failed loudly here rather than skipping, and that is the only reason
  // it was noticed at all.
  const projectId = await page.evaluate(
    () =>
      [...document.querySelectorAll('a[href]')]
        .map((a) => a.getAttribute('href')?.match(/^\/projects\/([0-9a-f-]{36})/)?.[1])
        .find(Boolean) ?? null,
  );
  expect(projectId, 'no live project to open a creator tab on').toBeTruthy();

  // The public profile route comes from the API, not from a link on the page:
  // the creator tab only renders a /u/ link when the creator has a HANDLE, and
  // the seeded creator does not — so link-following found nothing and timed
  // out. /u/<userId> is a valid profile URL either way, which is exactly why
  // the component falls back to it.
  const api = process.env.E2E_API_URL ?? 'http://127.0.0.1:4000';
  const createdBy = await fetch(`${api}/v1/projects/${projectId}`)
    .then((r) => r.json())
    .then((j) => j?.createdBy ?? j?.createdById ?? null)
    .catch(() => null);
  expect(createdBy, 'the project must expose its creator to reach a profile').toBeTruthy();

  for (const route of [`/projects/${projectId}/creator`, `/u/${createdBy}`]) {
    await page.goto(route, { waitUntil: 'networkidle' });
    const text = await page.locator('main, body').first().innerText();
    const counts = text.match(LATIN_COUNT) ?? [];
    expect(
      counts,
      `${route} renders Latin digits on a count — the platform counts in Arabic-Indic.\n` +
        `  ${counts.join('\n  ')}\n` +
        `  arabicCount() is toLocaleString('en-US') plus the conversion.`,
    ).toEqual([]);

    // PERCENTAGES TOO. The first version of this test checked only counts and
    // passed while the profile still rendered a project card at «130%» in
    // Latin — a rule half-enforced reads exactly like a rule enforced.
    const pcts = text.match(LATIN_PCT) ?? [];
    expect(pcts, `${route} renders a Latin percentage:\n  ${pcts.join('\n  ')}`).toEqual([]);
  }
});
