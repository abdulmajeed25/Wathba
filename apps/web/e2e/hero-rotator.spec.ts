import { expect, test } from '@playwright/test';

import { API } from './helpers';

/**
 * NOTE: the slide title is an h2, not an h3. It is the first heading under the
 * page's h1, and an h3 here made the very first entry in a screen reader's
 * heading list skip a level (h1 → h3). These selectors were updated with that
 * fix; the level is semantic and the rendered size is unchanged.
 */
/**
 * Batch HERO — the rotating featured card.
 *
 * The card sits above the fold and changes on a timer, so the things worth
 * asserting are the ones a human would only catch by sitting and watching it:
 * that it actually advances, that it stops when you reach for it, that it does
 * not move the page underneath the reader while it swaps, and that a reader who
 * asked for less motion is not put on a carousel anyway.
 */

const CURRENT = '[data-testid="wathba-hero-slide-current"]';
const DWELL = 10_000;

/** The hero needs a pool; an environment without one has nothing to assert. */
async function heroPool(): Promise<Array<{ titleAr: string; bucket: string; id: string }>> {
  const res = await fetch(`${API}/v1/hero-projects`);
  if (!res.ok) return [];
  const body = (await res.json()) as { slides?: Array<{ titleAr: string; bucket: string; id: string }> };
  return body.slides ?? [];
}

test('H1: the pool is real, bucketed, and never repeats a bucket or category back to back', async () => {
  const slides = await heroPool();
  test.skip(slides.length === 0, 'no hero pool in this environment');

  expect(slides.length, 'a rotator needs more than one slide').toBeGreaterThan(1);

  // No slide may be an automated-test artefact. Two separate rules bite here:
  // the isTestFixture flag (migration 0058) keeps token-titled fixtures out of
  // every public listing, and the hero additionally refuses any title carrying a
  // timestamp. That second rule exists because global-setup's golden-journey
  // project is deliberately PUBLIC — it is the only project CI has — while still
  // being unfit for a showcase once a few hundred have piled up.
  const unpresentable = slides
    .map((s) => s.titleAr)
    .filter((t) => /(E2E|إي٢إي|PAY|SMOKE|TEST|SEED|FIXTURE)/.test(t) || /[0-9]{10,}/.test(t));
  expect(unpresentable, `test artefacts reached the hero:\n${unpresentable.join('\n')}`).toEqual([]);

  const full = (await (await fetch(`${API}/v1/hero-projects`)).json()) as {
    slides: Array<{ bucket: string; categorySlug: string | null; imageUrl: string | null }>;
  };
  const bad: string[] = [];
  for (let i = 1; i < full.slides.length; i++) {
    const a = full.slides[i - 1]!;
    const b = full.slides[i]!;
    if (a.bucket === b.bucket) bad.push(`slides ${i}/${i + 1} share bucket ${b.bucket}`);
    if (a.categorySlug && a.categorySlug === b.categorySlug) {
      bad.push(`slides ${i}/${i + 1} share category ${b.categorySlug}`);
    }
  }
  expect(bad, `the interleave broke:\n${bad.join('\n')}`).toEqual([]);
  // A slide with no cover would render the empty-media art as the biggest thing
  // on the homepage.
  expect(full.slides.every((s) => s.imageUrl), 'every hero slide needs a cover').toBeTruthy();
});

test('H2: it auto-advances, and the slide shown is a real project you can open', async ({ page }) => {
  test.skip((await heroPool()).length < 2, 'no hero pool in this environment');
  await page.goto('/projects');

  const first = await page.locator(`${CURRENT} h2`).innerText();
  expect(first.trim().length, 'the slide must render a title').toBeGreaterThan(0);
  // The bucket badge is what tells a visitor WHY this project is being shown.
  await expect(page.locator(`${CURRENT}`)).toHaveAttribute('data-bucket', /strong|diverse|almost|fresh/);

  await expect
    .poll(async () => page.locator(`${CURRENT} h2`).innerText(), { timeout: DWELL + 6000, intervals: [500] })
    .not.toBe(first);

  // Whatever is showing links to that project, not to a stale id.
  const href = await page.locator(`${CURRENT} [data-testid="wathba-hero-link"]`).getAttribute('href');
  const shown = await page.locator(`${CURRENT} h2`).innerText();
  await page.goto(href!);
  await expect(page.getByRole('heading', { name: shown.trim(), level: 1 }).first()).toBeVisible();
});

test('H3: hovering the card stops the rotation', async ({ page }) => {
  test.skip((await heroPool()).length < 2, 'no hero pool in this environment');
  await page.goto('/projects');

  const before = await page.locator(`${CURRENT} h2`).innerText();
  await page.locator('[data-testid="wathba-hero-rotator"]').hover();
  // Well past a dwell: without the pause this is one to two advances.
  await page.waitForTimeout(DWELL + 4000);
  expect(await page.locator(`${CURRENT} h2`).innerText(), 'hover must hold the slide').toBe(before);

  // And it resumes once the pointer leaves, rather than pausing forever.
  await page.mouse.move(0, 0);
  await expect
    .poll(async () => page.locator(`${CURRENT} h2`).innerText(), { timeout: DWELL + 6000, intervals: [500] })
    .not.toBe(before);
});

test('H4: a swap does not move the page (CLS across a rotation)', async ({ page }) => {
  test.skip((await heroPool()).length < 2, 'no hero pool in this environment');
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/projects');
  await page.waitForLoadState('networkidle');

  const settled = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  const before = await page.locator(`${CURRENT} h2`).innerText();
  // Sit through at least two swaps without touching anything.
  await expect
    .poll(async () => page.locator(`${CURRENT} h2`).innerText(), { timeout: DWELL + 6000, intervals: [500] })
    .not.toBe(before);
  await page.waitForTimeout(DWELL + 1500);

  const after = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  const caused = after - settled;
  // Rotation must contribute essentially nothing. The budget is far below the
  // 0.1 "good" threshold because a timed swap is the one shift a reader can
  // never anticipate — they are not scrolling or clicking when it happens.
  expect(caused, `rotation shifted the page by ${caused.toFixed(4)}`).toBeLessThan(0.01);
});

test('H5: reduced motion gets no auto-rotation, and the controls still work', async ({ browser }) => {
  test.skip((await heroPool()).length < 2, 'no hero pool in this environment');
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/projects');

  const before = await page.locator(`${CURRENT} h2`).innerText();
  await page.waitForTimeout(DWELL + 4000);
  expect(
    await page.locator(`${CURRENT} h2`).innerText(),
    'reduced motion must not put the reader on a carousel',
  ).toBe(before);

  // Manual advance is the escape hatch, so it has to work.
  await page.getByRole('button', { name: 'المشروع التالي' }).click();
  await expect.poll(async () => page.locator(`${CURRENT} h2`).innerText()).not.toBe(before);
  await ctx.close();
});

test('H6: keyboard reaches the controls and hidden slides stay out of the tab order', async ({ page }) => {
  test.skip((await heroPool()).length < 2, 'no hero pool in this environment');
  await page.goto('/projects');

  // Exactly one hero link is focusable — the visible one. Without `inert` on
  // the others, tabbing walks ten invisible cards.
  const reachable = await page.evaluate(() => {
    const links = [...document.querySelectorAll('[data-testid="wathba-hero-link"]')];
    return links.filter((l) => !l.closest('[inert]')).length;
  });
  expect(reachable, 'only the current slide may be focusable').toBe(1);

  const next = page.getByRole('button', { name: 'المشروع التالي' });
  await next.focus();
  await expect(next).toBeFocused();
  const before = await page.locator(`${CURRENT} h2`).innerText();
  await page.keyboard.press('Enter');
  await expect.poll(async () => page.locator(`${CURRENT} h2`).innerText()).not.toBe(before);
});
