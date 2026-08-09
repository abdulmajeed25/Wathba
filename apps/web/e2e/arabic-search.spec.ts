import { expect, test } from '@playwright/test';

import { API } from './helpers';

/**
 * Batch DISCOVERY-ENGINE Unit 4 — Arabic search that actually finds things.
 *
 * The audit measured the failure rather than inferring it:
 *
 *     «الاحياء»  →  0 results
 *     «الأحياء»  →  3 results        (the same three projects)
 *     «جدا»      →  0               (3-char prefix of «جداريات»)
 *     «ط»        →  0               (single letter, floored at 2)
 *     «سرب»      →  0 creators      (raw ILIKE, not even diacritic-stripped)
 *
 * Arabic readers routinely omit hamza, so the first of those is the single
 * highest-impact defect on the platform: the most natural way to type the query
 * returned nothing at all.
 */

interface Hit { id: string; titleAr: string }

async function search(q: string): Promise<{ items: Hit[]; suggestions: { terms: string[]; categories: Array<{ nameAr: string }>; tags: Array<{ nameAr: string }> } | null }> {
  const r = await fetch(`${API}/v1/search?q=${encodeURIComponent(q)}&limit=50`);
  return r.json() as never;
}

async function suggest(q: string) {
  const r = await fetch(`${API}/v1/search/suggest?q=${encodeURIComponent(q)}`);
  return r.json() as Promise<{
    projects: Hit[];
    creators: Array<{ name: string }>;
    categories: Array<{ nameAr: string }>;
    tags: Array<{ nameAr: string }>;
  }>;
}

test('AS1: hamza is optional — the headline defect', async () => {
  const [bare, hamza] = await Promise.all([search('الاحياء'), search('الأحياء')]);

  expect(hamza.items.length, 'the reference query returned nothing — the data changed').toBeGreaterThan(0);
  // Not "both non-empty" — the SAME set. A normaliser that merely widened one
  // side would pass a weaker assertion while still ranking differently.
  expect(bare.items.map((i) => i.id).sort()).toEqual(hamza.items.map((i) => i.id).sort());
});

test('AS2: ta-marbuta and alef-maksura fold too', async () => {
  for (const [a, b] of [['تقنية', 'تقنيه'], ['مصطفى', 'مصطفي']]) {
    const [x, y] = await Promise.all([search(a), search(b)]);
    expect(x.items.map((i) => i.id).sort(), `«${a}» and «${b}» disagree`).toEqual(
      y.items.map((i) => i.id).sort(),
    );
  }
});

test('AS3: Arabic-Indic digits find their ASCII twins', async () => {
  const [ar, ascii] = await Promise.all([search('٢٠٣٠'), search('2030')]);
  expect(ar.items.map((i) => i.id).sort()).toEqual(ascii.items.map((i) => i.id).sort());
});

test('AS4: a partial word matches — a typeahead has to be a typeahead', async () => {
  // A tsquery term matches whole lexemes, so without the `:*` on the final
  // token a half-typed word matches nothing at all.
  const full = await search('نخيل');
  test.skip(full.items.length === 0, 'reference project missing');
  const partial = await search('نخي');
  expect(partial.items.length, '3-character prefix returned nothing').toBeGreaterThan(0);
  expect(partial.items.map((i) => i.id)).toEqual(expect.arrayContaining([full.items[0]!.id]));
});

test('AS5: a single character returns results', async () => {
  const r = await search('ن');
  // The floor was 2, so the FIRST keystroke of every Arabic search was dead.
  expect(r.items.length, 'a single Arabic letter returned nothing').toBeGreaterThan(0);
});

test('AS6: only the LAST token is prefixed', async () => {
  // «مشروع نخي» must mean "mashroo3 AND nakhi*", not "mashroo3* AND nakhi*" —
  // the earlier words are complete, the reader typed a space after them.
  const both = await search('نخيل تمور');
  const partialTail = await search('نخيل تمو');
  expect(partialTail.items.length, 'a completed first word plus a partial second found nothing').toBeGreaterThan(0);
  if (both.items.length) {
    expect(partialTail.items.map((i) => i.id)).toEqual(expect.arrayContaining([both.items[0]!.id]));
  }
});

test('AS7: creators are findable without typing the diacritics', async () => {
  // The creator arm was a raw Prisma `contains` → ILIKE with NO normalisation,
  // not even the diacritic stripping the project search already had. A reader
  // had to type the shadda to find «رحّالة».
  const [bare, marked] = await Promise.all([suggest('رحالة'), suggest('رحّالة')]);
  expect(marked.creators.length, 'the reference creator is missing').toBeGreaterThan(0);
  expect(bare.creators.map((c) => c.name).sort()).toEqual(marked.creators.map((c) => c.name).sort());
});

test('AS8: the dropdown groups projects, creators, categories AND tags', async () => {
  const r = await suggest('تراث');
  // Tags are new here; a curated vocabulary nobody can reach from the search
  // box is a vocabulary that does not get used.
  expect(r.tags.length, 'no tag group in the suggest payload').toBeGreaterThan(0);
  expect(r.tags.some((t) => t.nameAr.includes('تراث'))).toBe(true);
  expect(Array.isArray(r.projects) && Array.isArray(r.creators) && Array.isArray(r.categories)).toBe(true);
});

test('AS9: a typo gets "هل تقصد…", not an empty page', async () => {
  const r = await search('نخييل');
  expect(r.items.length, 'the typo unexpectedly matched — pick a worse one').toBe(0);
  expect(r.suggestions, 'zero results came back with no suggestions at all').toBeTruthy();
  const all = [
    ...r.suggestions!.terms,
    ...r.suggestions!.categories.map((c) => c.nameAr),
    ...r.suggestions!.tags.map((t) => t.nameAr),
  ];
  expect(all.length, 'nothing was suggested for a one-letter typo').toBeGreaterThan(0);
  expect(all.join(' ')).toContain('نخيل');
});

test('AS10: a successful search does NOT pay for suggestions', async () => {
  const r = await search('نخيل');
  test.skip(r.items.length === 0, 'reference project missing');
  // Three trigram scans on every successful search would be a cost paid by
  // everyone to help nobody.
  expect(r.suggestions).toBeNull();
});

test('AS11: flagged fixtures do not surface in search', async () => {
  // Search was the ONE public surface that did not exclude them, while
  // discover, the homepage and the sitemap all did.
  const r = await fetch(`${API}/v1/search?q=${encodeURIComponent('مشروع')}&limit=50`);
  const j = (await r.json()) as { items: Array<{ id: string }> };
  const flagged = await Promise.all(
    j.items.slice(0, 10).map(async (i) => {
      const d = await fetch(`${API}/v1/projects/${i.id}`);
      if (!d.ok) return false;
      const p = (await d.json()) as { isTestFixture?: boolean };
      return p.isTestFixture === true;
    }),
  );
  expect(flagged.filter(Boolean).length, 'a flagged test fixture is reachable by search').toBe(0);
});

test('AS12: the header dropdown finds a project by a partial Arabic word', async ({ page }) => {
  await page.goto('/projects');
  const box = page.getByRole('combobox').first();
  await box.click();
  await box.fill('نخي');

  // The whole point of the prefix work, exercised through the real UI: three
  // characters, and the project is offered.
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  await expect(listbox.getByRole('option').first()).toBeVisible({ timeout: 6000 });
  await expect(listbox).toContainText('نخيل', { timeout: 6000 });
});

test('AS13: the results page offers "هل تقصد…" instead of a blank page', async ({ page }) => {
  await page.goto(`/projects/search?q=${encodeURIComponent('نخييل')}`);
  await expect(page.getByTestId('zero-results')).toBeVisible();
  // The suggestion block is fetched after paint, so it must never be what the
  // reader waits for — but it must arrive.
  await expect(page.getByTestId('did-you-mean')).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('did-you-mean')).toContainText('نخيل');
});
