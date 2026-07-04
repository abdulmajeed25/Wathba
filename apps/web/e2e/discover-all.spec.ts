import { expect, test } from '@playwright/test';
import { signInUI, signUpAndVerify, uniqueEmail } from './helpers';

/**
 * Batch DISC — advanced discover page journeys.
 *  (1) filters + sort encode to the URL, and a reload restores the state.
 *  (2) a signed-in user bookmarks a card then filters by "المشاريع المحفوظة".
 */

test('discover-all: two categories + percent radio + sort encode to URL and survive reload', async ({ page }) => {
  await page.goto('/projects/discover-all');
  await expect(page.getByTestId('discover-total')).toBeVisible();

  // Two category checkboxes (both in the default first-8 list). Wait for each
  // soft-nav re-render (aria-checked) before the next click to avoid a stale
  // closure on the previous filter set.
  const art = page.getByTestId('cat-art');
  await art.click();
  await expect(art).toHaveAttribute('aria-checked', 'true');
  await expect(page).toHaveURL(/cat=art/);
  const food = page.getByTestId('cat-food');
  await food.click();
  await expect(food).toHaveAttribute('aria-checked', 'true');
  await expect(page).toHaveURL(/cat=art%2Cfood|cat=art,food/);

  // A percent-raised radio.
  const pctRadio = page.getByTestId('pct-lt25');
  await pctRadio.click();
  await expect(pctRadio).toHaveAttribute('aria-checked', 'true');
  await expect(page).toHaveURL(/pct=lt25/);

  // Change the sort.
  await page.getByTestId('discover-sort').selectOption('newest');
  await expect(page).toHaveURL(/sort=newest/);

  // Reload the shareable URL → state restored (boxes still checked).
  await page.reload();
  await expect(page.getByTestId('cat-art')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('pct-lt25')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('discover-sort')).toHaveValue('newest');
});

test('discover-all: signed-in user bookmarks a card then filters by saved', async ({ page }) => {
  const email = uniqueEmail('disc');
  await signUpAndVerify(page, 'داعم إي٢إي', email, '2298765432');
  await signInUI(page, email);

  await page.goto('/projects/discover-all');
  const firstCard = page.locator('[data-testid="discover-card"]').first();
  await expect(firstCard).toBeVisible();
  await firstCard.getByTestId('bookmark-toggle').click();

  // Enable the "saved only" filter (visible only when signed in).
  await page.getByTestId('only-saved').click();
  await expect(page).toHaveURL(/only=saved/);
  await expect(page.locator('[data-testid="discover-card"]')).toHaveCount(1);
});
