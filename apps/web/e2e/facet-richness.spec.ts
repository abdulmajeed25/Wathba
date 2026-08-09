import { expect, test } from '@playwright/test';

import { API } from './helpers';

/**
 * Batch DISCOVERY-ENGINE Unit 3 — the facets that had no data, and the two
 * semantic defects the audit found.
 *
 * Unit 2 made the category facet deep. This unit is about the OTHER dimensions
 * being real: tags, has-video, campaign length, and a location facet that
 * actually has something to count. Plus «قريبة منك», which was a dead link on
 * every surface it appeared on, and `?q=` on /projects/discover-all, which was
 * silently dropped by the page's own param whitelist.
 *
 * The shape of every assertion here is the same: ask the facet for a count,
 * then ask the LIST for the same filter and require the two to agree. A facet
 * that reports a number it cannot produce rows for is the exact failure this
 * batch keeps finding — plausible numbers, wrong query.
 */

interface Facets {
  tags: { slug: string; nameAr: string; count: number }[];
  video: number;
  duration: Record<string, number>;
  regions: Record<string, number>;
}

async function facets(qs = ''): Promise<Facets> {
  const r = await fetch(`${API}/v1/discover/facets${qs}`);
  return r.json() as Promise<Facets>;
}

/**
 * Read a rendered count.
 *
 * The heading prints Arabic-Indic digits (`arabicCount`), so the obvious
 * `replace(/\D/g, '')` strips EVERY character and yields the empty string —
 * a test written that way reads zero, compares it against a real total, and
 * fails for a reason that has nothing to do with the facet.
 */
function renderedCount(text: string): number {
  const digits = [...text].filter((ch) => ch >= '\u0660' && ch <= '\u0669');
  if (digits.length === 0) return -1;
  return Number(digits.map((ch) => String(ch.charCodeAt(0) - 0x0660)).join(''));
}

async function total(qs: string): Promise<number> {
  const r = await fetch(`${API}/v1/discover?${qs}&take=1`);
  return ((await r.json()) as { total: number }).total;
}

test('FR1: the tag facet counts match what the tag filter returns', async () => {
  const f = await facets();
  expect(f.tags.length, 'no tags on the facet payload').toBeGreaterThan(0);

  // Top three only: the point is that the count and the filter agree, and
  // asserting all thirty would be thirty round-trips for the same statement.
  for (const t of f.tags.slice(0, 3)) {
    expect(t.count, `tag ${t.slug} is on the facet with a zero count`).toBeGreaterThan(0);
    expect(await total(`tag=${encodeURIComponent(t.slug)}`), `tag ${t.slug}`).toBe(t.count);
  }
});

test('FR2: tags are OR within the group, not AND', async () => {
  const f = await facets();
  test.skip(f.tags.length < 2, 'need two tags');
  const [a, b] = [f.tags[0]!, f.tags[1]!];

  const both = await total(`tag=${a.slug},${b.slug}`);
  // Tags are cross-cutting: ANDing them would return almost nothing and the
  // section would read as broken. Union means at least the larger arm, and at
  // most the sum (equal only when nothing carries both).
  expect(both).toBeGreaterThanOrEqual(Math.max(a.count, b.count));
  expect(both).toBeLessThanOrEqual(a.count + b.count);
});

test('FR3: has-video counts only projects whose card actually shows a video', async () => {
  const f = await facets();
  test.skip(f.video === 0, 'no project has a card video');
  expect(await total('hasVideo=1')).toBe(f.video);

  // The facet must follow the SAME rule the card follows — videoUrl set AND
  // cardMedia === VIDEO. A creator who set a video and then chose the poster
  // is not "has video" as far as a reader browsing cards is concerned.
  const r = await fetch(`${API}/v1/discover?hasVideo=1&take=12`);
  const j = (await r.json()) as { items: { videoUrl?: string | null }[] };
  for (const p of j.items) {
    // `videoUrl` on a discover row is already the CARD decision — the mapper
    // runs it through cardVideoUrl(rawCardMedia(...)), so a project that set a
    // video and then chose the poster arrives here as null. If that ever
    // becomes the raw column again, this row would carry a url the card will
    // never play and the facet would be counting something invisible.
    expect(p.videoUrl, 'a has-video row with no card video url').toBeTruthy();
  }
});

test('FR4: duration buckets partition the catalogue', async () => {
  const f = await facets();
  const buckets = Object.entries(f.duration);
  expect(buckets.length).toBe(4);

  const all = await total('');
  const summed = buckets.reduce((n, [, c]) => n + c, 0);
  // Every campaign has a durationDays, so the four buckets are a partition —
  // not a filter set that happens to overlap. If this drifts, a project is
  // either double-counted or invisible to the length facet.
  expect(summed, 'buckets do not sum to the catalogue').toBe(all);

  for (const [key, count] of buckets) {
    if (count === 0) continue;
    expect(await total(`duration=${key}`), `bucket ${key}`).toBe(count);
  }
});

test('FR5: the region facet has real data behind it', async () => {
  const f = await facets();
  const regions = Object.entries(f.regions).filter(([, c]) => c > 0);

  // The audit measured region set on 2% of projects, which is why the location
  // section rendered thirteen options against a handful of counts. Fewer than
  // five populated regions means the backfill did not run.
  expect(regions.length, 'run prisma/seed-regions.mjs').toBeGreaterThanOrEqual(5);
  const [slug, count] = regions[0]!;
  expect(await total(`region=${slug}`), `region ${slug}`).toBe(count);
});

test('FR6: «قريبة منك» goes somewhere that has results', async ({ page }) => {
  await page.goto('/projects/discover/technology');
  const chip = page.getByRole('link', { name: /قريبة منك/ }).first();
  test.skip((await chip.count()) === 0, 'chip not rendered on this category');

  // It used to point at ?filter=near_you, which requires a region the signed-out
  // reader cannot have, so it returned an empty list every single time. Nothing
  // failed; the page just said "no projects" forever.
  await chip.click();
  // waitForURL, not waitForLoadState: a soft navigation has nothing pending on
  // the network by the time `networkidle` resolves, so the assertion would read
  // the OLD url and fail for a reason that has nothing to do with the chip.
  await page.waitForURL(/\/projects\/discover-all/);
  await expect(page.getByTestId('zero-results')).toHaveCount(0);
});

test('FR7: ?q= is honoured on /projects/discover-all', async ({ page }) => {
  await page.goto('/projects/discover-all?q=تقنية');
  await page.waitForLoadState('networkidle');

  // The param was absent from that page's whitelist, so the search box round-
  // tripped a query the server never saw and the reader got the full catalogue
  // back with their own words still in the field.
  const all = await total('');
  const shown = renderedCount(await page.getByTestId('discover-total').innerText());
  expect(shown).toBeGreaterThan(0);
  expect(shown, 'the query did not narrow anything — ?q= is being dropped').toBeLessThan(all);
});

test('FR8: the new facets survive a reload and compose with each other', async ({ page }) => {
  const f = await facets();
  test.skip(f.tags.length === 0 || f.video === 0, 'need a tag and a video');
  const tag = f.tags[0]!;

  await page.goto('/projects/discover-all');
  await page.getByTestId(`tag-${tag.slug}`).click();
  // Wait for the URL to actually carry the first filter before adding the
  // second. `navigate` merges the NEXT filter onto the `sp` the server last
  // rendered, so clicking again before that round-trip lands merges onto stale
  // state and silently drops the first choice.
  await page.waitForURL(new RegExp(`tag=${tag.slug}`));
  await page.getByTestId('has-video').click();
  await page.waitForURL(/hasVideo=1/);

  const url = new URL(page.url());
  expect(url.searchParams.get('tag')).toBe(tag.slug);
  expect(url.searchParams.get('hasVideo')).toBe('1');

  await page.reload();
  await page.waitForLoadState('networkidle');
  // Both boxes must come back checked. The sidebar reads its state from the
  // URL, so a param that round-trips but does not restore means the reader
  // loses their filters on every back-navigation.
  await expect(page.getByTestId(`tag-${tag.slug}`)).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('has-video')).toHaveAttribute('aria-checked', 'true');

  expect(await total(`tag=${tag.slug}&hasVideo=1`)).toBe(
    renderedCount(await page.getByTestId('discover-total').innerText()),
  );
});
