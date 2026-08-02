import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Batch CAT / Part 3 — golden journey:
 * open the mega-menu → pick a subcategory → apply the "الرائجة" (trending)
 * filter → land on the filtered discover page WITH results.
 *
 * globalSetup attaches the seeded LIVE project to Technology → Apps, so the
 * technology/apps subcategory page has at least one card.
 */
test('mega-menu → subcategory → trending filter → filtered discover page with results', async ({
  page,
}) => {
  await page.goto('/projects');

  // The live category bar loads from /api/categories. Waiting on the BUTTON with
  // the default 5s timeout is a race under full-suite load — this spec has been
  // the suite's one flake for exactly that reason. POLISH Unit 3 exposes a
  // readiness signal on the strip, so wait for the bar to be ready first and
  // then for the pill, both with explicit headroom.
  await expect(page.locator('[data-cat-nav-ready="1"]')).toBeAttached({ timeout: 20000 });
  const techBtn = page.locator('button[role="menuitem"][data-cat-slug="technology"]');
  await expect(techBtn).toBeVisible({ timeout: 15000 });
  await techBtn.click();

  // Pick the "Apps" subcategory from the open panel.
  const appsLink = page.locator('a[href="/projects/discover/technology/apps"]').first();
  await expect(appsLink).toBeVisible();
  await navigateVia(page, appsLink, /\/projects\/discover\/technology\/apps/);

  // Subcategory page renders with its breadcrumb + at least one card.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('[data-testid="discover-card"]').first()).toBeVisible();

  // Apply the trending filter chip → URL reflects it, results still present.
  await navigateVia(page, page.locator('a[data-filter="trending"]'), /filter=trending/);
  await expect(page.locator('[data-testid="discover-card"]').first()).toBeVisible();
});

/**
 * Click a `<Link>` and insist the navigation actually happens.
 *
 * These chips are real anchors, so this is not a hydration problem — it is the
 * App Router dropping a soft navigation issued while it is still settling the
 * previous one. Observed in CI as the URL simply never changing:
 *
 *   Expected pattern: /filter=trending/
 *   Received string:  ".../projects/discover/technology/apps"
 *   13 × unexpected value
 *
 * `toHaveURL` alone cannot rescue that: it polls for a transition that the lost
 * click will never start. Re-clicking is safe here precisely BECAUSE these are
 * links to a fixed href — unlike the filter toggles in discover-all.spec.ts,
 * clicking twice cannot undo anything.
 */
async function navigateVia(page: Page, link: Locator, url: RegExp): Promise<void> {
  await expect(async () => {
    if (!url.test(page.url())) await link.click();
    await expect(page).toHaveURL(url, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}
