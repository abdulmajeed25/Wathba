import { expect, test } from '@playwright/test';

/**
 * Project cover images must actually load.
 *
 * Three independent things have to line up for a cover to appear, and two of
 * them fail silently:
 *
 *   1. the project has media                → otherwise the empty-state art
 *   2. the object is publicly readable      → otherwise 403, visible in the log
 *   3. the CSP allows the media origin      → otherwise NOTHING is logged
 *
 * (3) is the one worth a test. `img-src` lists `https:`, so a media host on
 * plain HTTP is blocked, and when the CSP blocks an image the browser issues no
 * request at all: the network tab is empty, `img.complete` is true, and only
 * `naturalWidth === 0` gives it away. It looks exactly like a missing file.
 *
 * So this asserts on the DECODED image, not on the markup or the response.
 */
test('C1: every project cover on the discovery grid decodes', async ({ page }) => {
  await page.goto('/projects/discover-all');
  await page.waitForLoadState('networkidle');
  // Cards below the fold are lazy — walk the page so they are asked for.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1500);

  const imgs = await page.evaluate(() =>
    [...document.querySelectorAll('img')]
      .filter((i) => /demo-covers|\/venture-/.test(i.src))
      .map((i) => ({ src: i.src.slice(-46), w: i.naturalWidth })),
  );

  // Vacuity guard: a grid that renders no covers at all would otherwise pass
  // this test forever, which is the exact state that prompted it.
  expect(imgs.length, 'the discovery grid must render at least one cover').toBeGreaterThan(0);

  const broken = imgs.filter((i) => i.w === 0);
  expect(
    broken,
    `${broken.length}/${imgs.length} cover(s) did not decode. If the network log is ` +
      `empty, the CSP img-src is missing the media origin (NEXT_PUBLIC_MEDIA_URL):\n  ` +
      broken.map((b) => b.src).join('\n  '),
  ).toEqual([]);
});
