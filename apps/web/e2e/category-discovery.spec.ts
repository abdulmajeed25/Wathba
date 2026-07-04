import { test, expect } from '@playwright/test';

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

  // The live category bar loads from /api/categories — wait for it, then open
  // the Technology mega-menu.
  const techBtn = page.locator('button[role="menuitem"][data-cat-slug="technology"]');
  await expect(techBtn).toBeVisible();
  await techBtn.click();

  // Pick the "Apps" subcategory from the open panel.
  const appsLink = page.locator('a[href="/projects/discover/technology/apps"]').first();
  await expect(appsLink).toBeVisible();
  await appsLink.click();

  await expect(page).toHaveURL(/\/projects\/discover\/technology\/apps/);
  // Subcategory page renders with its breadcrumb + at least one card.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('[data-testid="discover-card"]').first()).toBeVisible();

  // Apply the trending filter chip → URL reflects it, results still present.
  await page.locator('a[data-filter="trending"]').click();
  await expect(page).toHaveURL(/filter=trending/);
  await expect(page.locator('[data-testid="discover-card"]').first()).toBeVisible();
});
