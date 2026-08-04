import { expect, test } from '@playwright/test';

import { API } from './helpers';

/**
 * Batch CONTENT Part 1A — the «قواعدنا» hub.
 *
 * The five rules pages are EditorialCards of kind RULE, edited through the ops
 * CONTENT surface, so these assertions are written against what the API serves
 * rather than against hardcoded copy — a spec that pinned the wording would
 * fail the first time someone legitimately edited a rule in the console, which
 * is the whole point of making them ops-editable.
 */

test('R1: the hub lists every rules page, and each link resolves', async ({ page, request }) => {
  const res = await request.get(`${API}/v1/rules`);
  expect(res.ok(), 'GET /v1/rules').toBe(true);
  const rules = (await res.json()) as Array<{ slug: string; titleAr: string }>;
  expect(rules.length, 'the hub should have pages to index').toBeGreaterThanOrEqual(5);

  await page.goto('/rules');
  const links = page.getByTestId('rules-toc-link');
  await expect(links).toHaveCount(rules.length);

  // Every entry in the contents list must actually open its page — a hub whose
  // links 404 is worse than no hub.
  for (const rule of rules) {
    const slug = rule.slug.replace(/^rules-/, '');
    const resp = await page.goto(`/rules/${slug}`);
    expect(resp?.status(), `/rules/${slug}`).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: rule.titleAr })).toBeVisible();
  }
});

test('R2: the prohibited list renders as a real list, with its rationale', async ({ page }) => {
  await page.goto('/rules/prohibited');

  // Asserted on structure, not on any single prohibited item: the list is
  // ops-editable and its exact entries are expected to change.
  const items = page.locator('article li');
  await expect
    .poll(async () => items.count(), { message: 'prohibited items should render as list items' })
    .toBeGreaterThan(10);

  // Each item carries an emphasised subject followed by its reason — the
  // "one-line rationale" rule. If inline bold silently stopped rendering, the
  // page would still look fine but read as a wall of asterisks.
  await expect(page.locator('article strong').first()).toBeVisible();
  const body = await page.locator('article').innerText();
  expect(body, 'unrendered markdown emphasis').not.toContain('**');
});

test('R3: a rules page has one main landmark and no heading-level skip', async ({ page }) => {
  await page.goto('/rules/creators');

  expect(await page.locator('main').count(), 'exactly one main landmark').toBe(1);

  const skips = await page.evaluate(() => {
    const out: string[] = [];
    let prev = 1;
    for (const h of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
      const lvl = Number(h.tagName[1]);
      if (lvl > prev + 1) out.push(`${h.tagName} after h${prev}`);
      prev = lvl;
    }
    return out;
  });
  expect(skips).toEqual([]);

  // The in-page contents list must point at headings that exist.
  const toc = page.locator('nav[aria-label="محتويات الصفحة"] a');
  if ((await toc.count()) > 0) {
    const broken = await page.evaluate(
      () =>
        [...document.querySelectorAll('nav[aria-label="محتويات الصفحة"] a')].filter(
          (a) => !document.querySelector(a.getAttribute('href')!),
        ).length,
    );
    expect(broken, 'contents links must resolve').toBe(0);
  }
});

test('R4: an unknown rules slug 404s rather than rendering an empty page', async ({ page }) => {
  const resp = await page.goto('/rules/not-a-real-rule');
  expect(resp?.status()).toBe(404);
});
