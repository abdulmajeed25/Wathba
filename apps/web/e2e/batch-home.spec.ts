import { expect, test } from '@playwright/test';

import { API } from './helpers';

const ADMIN_EMAIL = 'admin@wathba.demo';
const ADMIN_PASS = 'Wathba!2026';

/**
 * Batch HOME — the magazine homepage:
 *  H1 sections render in the admin-defined order (HomepageSection.sortOrder)
 *  H2 carousels scroll with the keyboard-accessible arrow buttons (RTL)
 *  H3 an editorial card navigates to its /stories article
 *  H4 an admin toggle hides the section from the public homepage (and the
 *     tagged cache busts immediately — no 60s ISR wait)
 */

test('H1: homepage sections render in admin order', async ({ page }) => {
  const payload = (await (await fetch(`${API}/v1/home`)).json()) as {
    sections: Array<{ key: string }>;
  };
  const expected = payload.sections.map((s) => s.key);
  expect(expected.length).toBeGreaterThanOrEqual(10);

  await page.goto('/projects');
  const rendered = await page
    .locator('[data-section]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-section')));
  // Every rendered section must appear, in exactly the admin order (data-empty
  // sections may be skipped, but nothing may render out of order or unlisted).
  expect(rendered.length).toBeGreaterThanOrEqual(10);
  const orderOf = new Map(expected.map((k, i) => [k, i]));
  for (const key of rendered) expect(orderOf.has(key!)).toBe(true);
  const positions = rendered.map((k) => orderOf.get(k!)!);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
});

test('H2: the «مفضلات جديدة» carousel scrolls via its arrow buttons', async ({ page }) => {
  await page.goto('/projects');
  const section = page.locator('[data-section="fresh_favorites"]');
  await section.scrollIntoViewIfNeeded();
  const track = section.locator('.wathba-carousel-track');
  // CLOSEOUT C5 — a track that does not overflow has nothing to scroll, and
  // asserting a scroll then measures the dataset, not the carousel. This section
  // is «مفضلات جديدة» (recently favourited), which on a minimal seed can hold a
  // single card: scrollLeft stays 0 and the test fails for a reason that is not a
  // defect. Gate on the precondition, keep the behaviour assertion below.
  const overflows = await track.evaluate((el) => el.scrollWidth > el.clientWidth + 100);
  test.skip(!overflows, 'carousel track does not overflow with this dataset — nothing to scroll');
  const before = await track.evaluate((el) => el.scrollLeft);

  await section.getByRole('button', { name: 'التالي' }).click();
  await expect
    .poll(async () => Math.abs((await track.evaluate((el) => el.scrollLeft)) - before))
    .toBeGreaterThan(100);

  // And back — the «السابق» arrow returns toward the start.
  const mid = await track.evaluate((el) => el.scrollLeft);
  await section.getByRole('button', { name: 'السابق' }).click();
  await expect
    .poll(async () => Math.abs((await track.evaluate((el) => el.scrollLeft)) - mid))
    .toBeGreaterThan(100);
});

test('H3: a success-story card links through to its /stories article', async ({ page }) => {
  await page.goto('/projects');
  const section = page.locator('[data-section="success_stories"]');
  await section.scrollIntoViewIfNeeded();
  await section.locator('a[href^="/stories/"]').first().click();
  await page.waitForURL(/\/stories\/.+/);
  await expect(page.getByTestId('story-article')).toBeVisible();
  await expect(page.locator('h1')).toHaveCount(1);
});

test('H4: admin toggle hides a section from the public homepage', async ({ page }) => {
  await page.goto('/sign-in');
  await page.locator('input[name="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[name="password"]').fill(ADMIN_PASS);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'));

  await page.goto('/projects/admin');
  await page.getByRole('tab', { name: 'إدارة الرئيسية' }).click();
  const toggle = page.getByTestId('section-toggle-funding_tips');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  try {
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    await page.goto('/projects');
    await expect(page.locator('[data-section="funding_tips"]')).toHaveCount(0);
    // Neighbours are untouched.
    await expect(page.locator('[data-section="trust_duo"]')).toHaveCount(1);
  } finally {
    // Restore server-side regardless of assertion outcome (spec-order safety).
    await page.goto('/projects/admin');
    await page.getByRole('tab', { name: 'إدارة الرئيسية' }).click();
    const t = page.getByTestId('section-toggle-funding_tips');
    if ((await t.getAttribute('aria-checked')) === 'false') {
      await t.click();
      await expect(t).toHaveAttribute('aria-checked', 'true');
    }
  }

  await page.goto('/projects');
  await expect(page.locator('[data-section="funding_tips"]')).toHaveCount(1);
});
