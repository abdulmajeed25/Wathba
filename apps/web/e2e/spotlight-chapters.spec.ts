import { expect, test } from '@playwright/test';

/**
 * Batch SPOTLIGHT-PLUS P1/P2 — the cinematic hero and chapter variety.
 *
 * The audit measured three consecutive chapters at 756px each, rendered
 * through one structure, distinguished only by background colour. It also
 * found the hero was a 560px contained banner on a page whose whole job is to
 * be the most alive surface on the site.
 *
 * These guard the two structural claims that fix is built on. They deliberately
 * do NOT assert exact pixel heights — that would fail the first time anyone
 * edits a lede. They assert the invariants: the hero reaches the viewport
 * edges, the chapters do not all share one shape, and the section that escapes
 * its container does not take a phone with it.
 */

test('SC1: the hero is a full-bleed stage, and its cover is not lazy', async ({ page }) => {
  await page.goto('/spotlight');

  const hero = page.locator('section[aria-labelledby="spotlight-hero-title"]');
  await expect(hero).toBeVisible();

  const m = await hero.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const img = el.querySelector('img');
    return {
      width: Math.round(r.width),
      viewport: document.documentElement.clientWidth,
      height: Math.round(r.height),
      hasImg: !!img,
      lazy: img?.getAttribute('loading') ?? null,
      // The cover must fill the section rather than sit in a column beside it.
      imgWidth: img ? Math.round(img.getBoundingClientRect().width) : 0,
    };
  });

  // Full-bleed: the section reaches both edges. Body margin, a stray container
  // or a re-introduced max-width would all show up here.
  expect(m.width, 'hero must span the viewport').toBeGreaterThanOrEqual(m.viewport - 1);

  // A stage, not a banner. The old hero clamped to 560px at its largest.
  expect(m.height, 'hero must be taller than the old contained banner').toBeGreaterThan(560);

  if (m.hasImg) {
    // It is the LCP element: eager, and filling the stage.
    expect(m.lazy, 'the hero cover must not be lazy — it is the LCP element').not.toBe('lazy');
    expect(m.imgWidth, 'the cover must fill the stage, not sit in a column').toBeGreaterThanOrEqual(
      m.viewport - 1,
    );
  }
});

test('SC2: the chapters do not all share one structure', async ({ page }) => {
  await page.goto('/spotlight');

  const heights = await page.evaluate(() =>
    ['biggest', 'staff-picks', 'inventive']
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el)
      .map((el) => Math.round(el.getBoundingClientRect().height)),
  );

  // Needs at least two rendered chapters to say anything. Sections with no data
  // render nothing at all by design, so this is a real possibility.
  test.skip(heights.length < 2, 'not enough chapters rendered to compare');

  // THE ACTUAL FINDING: 756 / 756 / 756. Identical heights are the symptom of
  // one structure serving every chapter.
  expect(new Set(heights).size, `all chapters are the same height: ${heights.join(' / ')}`).toBeGreaterThan(1);

  // And the full-bleed chapter must genuinely escape the contained grid, which
  // is what makes it a different SHAPE rather than a different colour.
  const band = page.locator('#inventive .wathba-spotlight-band');
  if (await band.count()) {
    const w = await band.evaluate((el) => ({
      band: Math.round(el.getBoundingClientRect().width),
      contained: Math.round(
        (el.closest('section')!.querySelector('h2')!.closest('div') as HTMLElement).getBoundingClientRect()
          .width,
      ),
    }));
    expect(w.band, 'the full-bleed band must be wider than the contained column').toBeGreaterThan(
      w.contained,
    );
  }
});

test('SC3: nothing escapes the viewport on a phone', async ({ page }) => {
  // The full-bleed band is a multi-track grid that deliberately breaks its
  // container — historically the exact shape that hides content off-screen at
  // 360. auto-fit is what should collapse it to one column; this proves it.
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/spotlight');

  const o = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    // Any card squeezed below a usable width means the grid kept its tracks.
    narrowest: Math.min(
      ...[...document.querySelectorAll('.wathba-spotlight-band > a, .wathba-spotlight-trio > a')].map(
        (el) => Math.round(el.getBoundingClientRect().width),
      ),
      Infinity,
    ),
  }));

  expect(o.scrollW, 'the page must not scroll horizontally at 360').toBeLessThanOrEqual(o.clientW + 1);
  if (Number.isFinite(o.narrowest)) {
    expect(o.narrowest, 'cards must collapse to one column, not shrink').toBeGreaterThan(200);
  }
});
