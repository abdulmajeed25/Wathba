import { expect, test } from '@playwright/test';

/**
 * Batch POLISH Unit 2 — /spotlight.
 *
 * The motion is the risky part of an art-directed page, so most of this guards
 * the failure modes rather than the choreography: content that only exists if
 * JS ran, and animation forced on a reader who asked for none.
 */

test('S1: the page is complete WITHOUT JavaScript', async ({ browser }) => {
  // A crawler and a reader with JS off must get the finished page. The reveal
  // is built so the server emits no hiding attribute at all — this proves it.
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/spotlight');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const sections = page.locator('section[id]');
  expect(await sections.count(), 'curated sections should be server-rendered').toBeGreaterThan(1);

  // Nothing may be hidden in the server output.
  expect(await page.locator('[data-revealed="0"]').count()).toBe(0);

  const body = await page.locator('body').innerText();
  expect(body).toContain('تحت الأضواء');
  await ctx.close();
});

test('S2: reduced motion means NO hidden state, ever', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/spotlight');
  await page.waitForTimeout(900);

  // The component refuses to arm, and the CSS hidden state lives inside
  // `no-preference` — so neither route can hide anything here.
  expect(
    await page.locator('[data-revealed="0"]').count(),
    'a reduced-motion reader must never be handed opacity:0 content',
  ).toBe(0);

  // And every section is genuinely painted.
  const opacities = await page.locator('section[id]').evaluateAll((els) =>
    els.map((e) => Number(getComputedStyle(e).opacity)),
  );
  expect(opacities.length).toBeGreaterThan(1);
  for (const o of opacities) expect(o).toBeGreaterThan(0.9);
});

test('S3: with motion allowed, below-the-fold sections reveal on scroll', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('/spotlight');
  await page.waitForTimeout(600);

  const last = page.locator('section[id]').last();
  // Armed but not yet revealed while off-screen.
  await expect(last).toHaveAttribute('data-revealed', '0');

  await last.scrollIntoViewIfNeeded();
  await expect(last).toHaveAttribute('data-revealed', '1');
  await page.waitForTimeout(800);
  expect(await last.evaluate((e) => Number(getComputedStyle(e).opacity))).toBeGreaterThan(0.9);
  await ctx.close();
});

test('S4: the hero reserves its height — it is the LCP element and must not move', async ({ page }) => {
  await page.goto('/spotlight');
  const hero = page.locator('section').first();
  const before = await hero.evaluate((e) => e.getBoundingClientRect().height);
  await page.waitForTimeout(1200);
  const after = await hero.evaluate((e) => e.getBoundingClientRect().height);
  // Tolerance, not exact equality: the Arabic webfont swapping in can change the
  // headline's line box by a fraction of a pixel, and asserting BE-exact makes
  // this test flaky for a reason that has nothing to do with layout stability.
  // What matters is that nothing MOVES perceptibly — measured CLS here is 0.0011.
  expect(Math.abs(after - before), 'the hero must not resize after paint').toBeLessThanOrEqual(2);
  expect(after).toBeGreaterThan(400);
});

test('S5: sections render only when they have data, and each card links out', async ({ page }) => {
  await page.goto('/spotlight');

  const ids = await page.locator('section[id]').evaluateAll((els) => els.map((e) => e.id));
  // The inclusion rail has no rows in this dataset, so it must be absent
  // entirely rather than present and empty.
  for (const id of ids) {
    const cards = await page.locator(`section#${id} a[href]`).count();
    expect(cards, `section #${id} rendered with nothing in it`).toBeGreaterThan(0);
  }

  // Every project card points at a real campaign URL.
  const hrefs = await page.locator('section#biggest a[href]').evaluateAll((els) =>
    els.map((e) => (e as HTMLAnchorElement).getAttribute('href') ?? ''),
  );
  expect(hrefs.length).toBeGreaterThan(0);
  for (const h of hrefs) expect(h).toMatch(/^\/(p|projects)\//);
});

test('S6: the curated framing is merit-based, never identity-based', async ({ page }) => {
  await page.goto('/spotlight');
  const body = await page.locator('body').innerText();

  // The design principle, asserted: sections select on the work.
  expect(body).toContain('الأكبر والأنجح');
  expect(body).toContain('مختارات وثبة');
  // And the retired identity framing stays retired.
  expect(body).not.toContain('مبدعات سعوديات');
});
