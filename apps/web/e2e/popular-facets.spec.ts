import { expect, test } from '@playwright/test';

import { API } from './helpers';

/**
 * Batch DISCOVERY-ENGINE Unit 5 — the row the platform learned.
 *
 * The homepage gains a SECOND chip row, computed nightly from what readers
 * actually filtered by. What matters end-to-end is not the ranking — that is
 * unit-tested — but the three things a reader or an operator would notice:
 * the curated row is untouched, the promoted chips lead somewhere real, and
 * clicking a filter is what feeds the thing in the first place.
 */

interface Promoted {
  key: string;
  value: string;
  labelAr: string;
  href: string;
  isPinned: boolean;
}

async function promoted(): Promise<Promoted[]> {
  const r = await fetch(`${API}/v1/discover/popular`);
  return ((await r.json()) as { items: Promoted[] }).items;
}

test('PF1: the promoted list is public, aggregate, and non-empty from day one', async () => {
  const items = await promoted();

  // Cold start is the point: an empty row on launch day would read as broken
  // for the month it takes to gather evidence, so the table ships with seeds.
  expect(items.length, 'no promoted facets — the 0063 seed rows are missing').toBeGreaterThan(0);
  for (const f of items) {
    expect(f.labelAr, 'a chip must be labelled in Arabic, never by its slug').toMatch(/[؀-ۿ]/);
    expect(f.href).toContain('/projects/discover-all?');
  }
});

test('PF2: every promoted chip leads to results, not an empty list', async () => {
  const items = await promoted();

  // The failure this pins is the one «قريبة منك» had for its whole life: a
  // filter offered prominently that always returns nothing. A promoted chip is
  // the platform recommending a filter — recommending a dead end is worse than
  // not recommending at all.
  for (const f of items.slice(0, 6)) {
    const qs = f.href.split('?')[1] ?? '';
    const r = await fetch(`${API}/v1/discover?${qs}&take=1`);
    const { total } = (await r.json()) as { total: number };
    expect(total, `${f.labelAr} (${f.key}=${f.value}) leads to an empty list`).toBeGreaterThan(0);
  }
});

test('PF3: the learned row renders under the curated one, and does not replace it', async ({ page }) => {
  await page.goto('/projects');

  const chips = page.locator('[data-popular-facet]');
  await expect(chips.first()).toBeVisible();
  await expect(page.getByText('الأكثر بحثاً هذا الأسبوع')).toBeVisible();

  // The curated category row is an editorial statement and this addition must
  // not have cost it anything. Eight chips, exactly as before — counted by
  // their own attribute so the learned pills below cannot pad the number.
  await expect(page.getByRole('heading', { name: 'تصفّح حسب الفئة' })).toBeVisible();
  expect(await page.locator('[data-category-chip]').count()).toBe(8);
});

test('PF4: a promoted chip navigates to the filter it names', async ({ page }) => {
  await page.goto('/projects');
  const chip = page.locator('[data-popular-facet]').first();
  const attr = (await chip.getAttribute('data-popular-facet')) ?? '';
  const [key, value] = attr.split(':');

  await chip.click();
  await page.waitForURL(/\/projects\/discover-all/);

  const url = new URL(page.url());
  expect(url.searchParams.get(key!)).toBe(value);
  await expect(page.getByTestId('zero-results')).toHaveCount(0);
});

test('PF5: applying a filter records the pair — and nothing else', async ({ page }) => {
  const posts: Array<Record<string, unknown>> = [];
  await page.route('**/api/events', async (route) => {
    try {
      posts.push(JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>);
    } catch {
      /* a malformed beacon is its own failure, caught by the assertions below */
    }
    await route.fulfill({ status: 200, body: '{"ok":true}' });
  });

  await page.goto('/projects/discover-all');
  await page.getByTestId('has-video').click();
  await page.waitForURL(/hasVideo=1/);

  const filterEvents = posts.filter((p) => p.name === 'filter_applied');
  expect(filterEvents.length, 'the sidebar recorded nothing').toBeGreaterThan(0);

  const props = filterEvents[0]!.props as Record<string, unknown>;
  expect(props.key).toBe('hasVideo');
  expect(props.value).toBe('1');
  // PDPL, from the client side: the event carries a facet pair and a random
  // anonId. No path-derived identity, no user id, and — deliberately — never
  // the words a reader typed. The server drops anything else anyway
  // (sanitizeFacetProps), but a beacon that SENDS more than it should is worth
  // failing on, because the next server change might start keeping it.
  expect(props.q).toBeUndefined();
  expect(filterEvents[0]!.userId).toBeUndefined();
});

test('PF6: the ops discovery page is behind the ops session, like every other ops screen', async ({ page }) => {
  const res = await page.goto('/ops/discovery');
  // Either a redirect to the ops entrance or a refusal — never the table.
  expect(page.url()).not.toContain('/ops/discovery');
  expect(res?.status() ?? 0).toBeLessThan(500);
});
