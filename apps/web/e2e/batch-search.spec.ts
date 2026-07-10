import { expect, test } from '@playwright/test';

/**
 * Batch SEARCH — live suggestions + unified search/discover:
 *  S1 focus (empty) → recent searches or curated chips
 *  S2 typing → grouped live results, project rows carry a thumbnail slot
 *  S3 ↓↓ + Enter opens the highlighted row
 *  S4 Enter with no selection → /projects/search?q= pre-filled («نتيجة عن»)
 *  S5 filters on the search page are URL-encoded, combinable with q and
 *     reload-safe
 *  S6 the old «استكشف» route permanently redirects to discover-all
 */

test('S1+S2: focus shows suggestions; typing shows grouped image-rich rows', async ({ page }) => {
  await page.goto('/projects');
  const box = page.getByRole('combobox', { name: 'بحث' });
  await box.click();
  // Fresh profile: no recent history → the curated chips.
  await expect(page.getByText('اقتراحات')).toBeVisible();
  await expect(page.getByRole('link', { name: 'تقنية' }).first()).toBeVisible();

  await box.fill('سرب');
  const listbox = page.locator('#wathba-suggest');
  await expect(listbox.getByText('مشاريع')).toBeVisible();
  // Project row: thumbnail slot (real cover img or the placeholder block).
  const firstProject = listbox.locator('a[id^="wathba-opt-prj-"]').first();
  await expect(firstProject).toBeVisible();
  await expect(firstProject.locator('img, .wathba-ph')).toHaveCount(1);
  // Funded-% is part of the row.
  await expect(firstProject.locator('text=/٪/').first()).toBeVisible();
  // The last row is always «عرض كل النتائج».
  await expect(listbox.getByText(/عرض كل النتائج عن/)).toBeVisible();
});

test('S3: ArrowDown + Enter opens the highlighted suggestion', async ({ page }) => {
  await page.goto('/projects');
  const box = page.getByRole('combobox', { name: 'بحث' });
  await box.click();
  await box.fill('سرب');
  await expect(page.locator('a[id^="wathba-opt-prj-"]').first()).toBeVisible();
  await box.press('ArrowDown');
  // aria-activedescendant tracks the highlight.
  await expect(box).toHaveAttribute('aria-activedescendant', /wathba-opt-/);
  await box.press('Enter');
  await page.waitForURL(/\/(projects|p)\//);
});

test('S4: Enter with no selection lands on the search page pre-filled', async ({ page }) => {
  await page.goto('/projects');
  const box = page.getByRole('combobox', { name: 'بحث' });
  await box.click();
  await box.fill('درون');
  await box.press('Enter');
  await page.waitForURL(/\/projects\/search\?q=/);
  await expect(page.getByTestId('discover-total')).toContainText('نتيجة عن «درون»');
});

test('S5: search filters are URL-encoded, combinable with q, reload-safe', async ({ page }) => {
  await page.goto('/projects/search?q=مشروع');
  await expect(page.getByTestId('discover-total')).toContainText('نتيجة عن');
  // The discover sidebar renders on the SEARCH page (unified component).
  await expect(page.getByLabel('عوامل التصفية')).toBeVisible();

  // Apply a status filter → URL gains it and keeps q.
  await page.getByLabel('عوامل التصفية').getByText('نشطة').click();
  await page.waitForURL((u) => u.searchParams.get('status') === 'live' && u.searchParams.get('q') === 'مشروع');

  // Reload restores both.
  await page.reload();
  await expect(page.getByTestId('discover-total')).toContainText('نتيجة عن «مشروع»');
  await expect(page).toHaveURL(/status=live/);

  // Sort is combinable too.
  await page.getByTestId('discover-sort').selectOption('newest');
  await page.waitForURL((u) => u.searchParams.get('sort') === 'newest' && u.searchParams.get('q') === 'مشروع');
});

test('S6: the retired «استكشف» route permanently redirects to discover-all', async ({ page, request }) => {
  const res = await request.get('/projects/discover', { maxRedirects: 0 });
  expect([301, 308]).toContain(res.status());
  expect(res.headers()['location']).toContain('/projects/discover-all');

  await page.goto('/projects/discover');
  await page.waitForURL('**/projects/discover-all');
  await expect(page.getByTestId('discover-total')).toBeVisible();
});
