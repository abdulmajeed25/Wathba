import { expect, test, type Locator, type Page } from '@playwright/test';
import { signUpAndVerify, uniqueEmail } from './helpers';

/**
 * Every filter control on this page is a `<div role="checkbox">` with an
 * onClick — there is no native behaviour behind it, so a click before the page
 * hydrates does nothing at all and the assertion that follows fails 5s later.
 * Under full-suite load hydration is slow enough for that to happen, which is
 * what made this spec flaky. `toHaveAttribute` will not help: it waits for a
 * state change that the lost click is never going to produce.
 *
 * So the click is retried until it registers. It is GUARDED on aria-checked —
 * these are toggles, and a blind second click would switch the filter back off
 * and turn a flaky failure into a flaky success, which is worse.
 */
async function check(page: Page, control: Locator, url: RegExp): Promise<void> {
  await expect(async () => {
    if ((await control.getAttribute('aria-checked')) !== 'true') await control.click();
    await expect(control).toHaveAttribute('aria-checked', 'true', { timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
  await expect(page).toHaveURL(url);
}

/**
 * Batch DISC — advanced discover page journeys.
 *  (1) filters + sort encode to the URL, and a reload restores the state.
 *  (2) a signed-in user bookmarks a card then filters by "المشاريع المحفوظة".
 */

test('discover-all: two categories + percent radio + sort encode to URL and survive reload', async ({ page }) => {
  await page.goto('/projects/discover-all');
  await expect(page.getByTestId('discover-total')).toBeVisible();

  // Two category checkboxes (both in the default first-8 list). Each waits for
  // its own soft-nav re-render before the next click, so a filter set is never
  // built on a stale closure.
  await check(page, page.getByTestId('cat-art'), /cat=art/);
  await check(page, page.getByTestId('cat-food'), /cat=art%2Cfood|cat=art,food/);

  // A percent-raised radio.
  await check(page, page.getByTestId('pct-lt25'), /pct=lt25/);

  // Change the sort. Same hydration problem, different control: the <select>
  // has an onChange, so selectOption before hydration sets the value and
  // nothing else. Re-selecting the same option is idempotent, so this one needs
  // no guard.
  await expect(async () => {
    await page.getByTestId('discover-sort').selectOption('newest');
    await expect(page).toHaveURL(/sort=newest/, { timeout: 1_500 });
  }).toPass({ timeout: 20_000 });

  // Reload the shareable URL → state restored (boxes still checked).
  await page.reload();
  await expect(page.getByTestId('cat-art')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('pct-lt25')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('discover-sort')).toHaveValue('newest');
});

test('discover-all: signed-in user bookmarks a card then filters by saved', async ({ page }) => {
  const email = uniqueEmail('disc');
  // signUpAndVerify leaves the user signed in; a redundant signInUI here
  // would now bounce off /sign-in (STAKES/A16 redirects signed-in users away).
  await signUpAndVerify(page, 'داعم إي٢إي', email, '2298765432');

  await page.goto('/projects/discover-all');
  const firstCard = page.locator('[data-testid="discover-card"]').first();
  await expect(firstCard).toBeVisible();
  await firstCard.getByTestId('bookmark-toggle').click();

  // Enable the "saved only" filter (visible only when signed in).
  await page.getByTestId('only-saved').click();
  await expect(page).toHaveURL(/only=saved/);
  await expect(page.locator('[data-testid="discover-card"]')).toHaveCount(1);
});
