import { expect, test } from '@playwright/test';

import { LCP_PROTECTION_MS } from '../src/components/ventures/wathba/wathba-timing';

/**
 * Batch SPOTLIGHT-PLUS P0 — the showcase plays its videos.
 *
 * /spotlight rendered zero <video> and zero ▶ glyphs while the homepage
 * trending grid has had hover-video since Stage 1. Measured in the audit:
 * WathbaCardVideo appeared 4× in trending and 0× here.
 */
const GLYPH = '[aria-label="هذا المشروع يحتوي على فيديو"]';

test('SV1: cards with a video advertise it, and hovering plays one', async ({ page }) => {
  await page.goto('/spotlight');

  // The glyph marks the cards that HAVE a video — a card without one must not
  // claim it, which is the per-project poster choice being respected.
  const glyphs = page.locator(GLYPH);
  const n = await glyphs.count();
  expect(n, '/spotlight advertises no card video at all').toBeGreaterThan(0);

  // A CARD, explicitly — `glyphs.first()` used to be hovered directly, and the
  // hero also renders this glyph when its project has a video. Which one came
  // first was therefore a property of the DATA, and on a catalogue where the
  // hero's project has a video this test hovered the hero and failed.
  //
  // It is not hoverable in the way this test means: the hero's copy block sits
  // over the cover, so a hover at the section's centre lands on the <h1> and
  // never reaches the WathbaCardVideo wrapper. Playwright says so outright —
  // "<h1 id="spotlight-hero-title"> from <div>…</div> subtree intercepts
  // pointer events".
  //
  // WORTH KNOWING, and deliberately NOT asserted here: that means the hero can
  // advertise a video the reader cannot start by hovering the obvious part of
  // it. Whether the hero should play on hover at all is a design question about
  // the LCP element, not something this test should decide by accident.
  const cardGlyphs = page.locator(`a:has(${GLYPH}) ${GLYPH}`);
  expect(await cardGlyphs.count(), 'no CARD advertises a video — only the hero does').toBeGreaterThan(0);

  // Nothing is fetched before hover.
  await expect(page.locator('video')).toHaveCount(0);

  // Past the LCP guard, or the hover is correctly ignored.
  await page.waitForTimeout(LCP_PROTECTION_MS + 100);

  const card = cardGlyphs.first().locator('xpath=..');
  await card.scrollIntoViewIfNeeded();
  await card.hover();

  await expect.poll(() => page.locator('video').count(), {
    message: 'hovering a spotlight card never mounted a video',
    timeout: 15_000,
  }).toBeGreaterThan(0);

  const v = page.locator('video').first();
  // Muted and looping, or it is an autoplaying advert rather than a preview.
  expect(await v.evaluate((el: HTMLVideoElement) => el.muted)).toBe(true);
  expect(await v.evaluate((el: HTMLVideoElement) => el.loop)).toBe(true);
});

test('SV2: one video at a time', async ({ page }) => {
  await page.goto('/spotlight');
  const glyphs = page.locator(GLYPH);
  test.skip((await glyphs.count()) < 2, 'need two cards with video');
  await page.waitForTimeout(LCP_PROTECTION_MS + 100);

  for (const i of [0, 1]) {
    const c = glyphs.nth(i).locator('xpath=..');
    await c.scrollIntoViewIfNeeded();
    await c.hover();
    await page.waitForTimeout(900);
  }
  // PLAYING videos, not mounted ones — the same rule home-card-video V7 uses.
  // The component deliberately leaves the previous <video> in the DOM, paused,
  // so returning to a card does not re-fetch it. Counting elements therefore
  // reports two for correct behaviour, which is what this asserted at first.
  await expect
    .poll(
      () => page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => !(v as HTMLVideoElement).paused).length),
      { message: 'more than one spotlight card was playing at once', timeout: 5000 },
    )
    .toBeLessThanOrEqual(1);
});

test('SV3: a touch device gets no video', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('/spotlight');
  await page.waitForTimeout(LCP_PROTECTION_MS + 300);
  const g = page.locator(GLYPH).first();
  if (await g.count()) {
    await g.locator('xpath=..').tap().catch(() => {});
    await page.waitForTimeout(700);
  }
  expect(await page.locator('video').count(), 'a tap started a video on a phone').toBe(0);
  await ctx.close();
});
