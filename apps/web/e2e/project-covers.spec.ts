import { expect, test } from '@playwright/test';

/**
 * Project cover images must actually load.
 *
 * Three independent things have to line up for a cover to appear, and two of
 * them fail silently:
 *
 *   1. the project has media                → otherwise the empty-state art
 *   2. the object is publicly readable      → otherwise 403, visible in the log
 *   3. the CSP allows the media origin      → otherwise no request is made
 *
 * (3) is the one worth a test. `img-src` lists `https:`, so a media host on
 * plain HTTP is blocked, and a CSP-blocked image produces no network request at
 * all: the network tab is empty, `img.complete` is true, and `naturalWidth` is
 * 0 — indistinguishable from a missing file if you are watching the network.
 * Chromium does log the violation to the console and fires
 * `securitypolicyviolation`, so it is findable; it is just not where you look.
 *
 * So C1 asserts on the DECODED image, not on the markup or the response. C2
 * covers the directive C1 cannot reach: media-src, which governs story video
 * that only a creator's upload can produce.
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

test('C2: the media origin is allowed by media-src as well as img-src', async ({ page }) => {
  // C1 can only ever cover images, because images are the only project media the
  // seed produces. Story VIDEO is uploaded by a creator, so there is nothing to
  // point a test at — but wathba-start.tsx sets <video src> to `res.publicUrl`,
  // the MinIO origin rather than a blob:, so it is governed by media-src and
  // fails the same invisible way. This asserts the policy instead of the pixels.
  //
  // The expected origin is read from media the app ACTUALLY serves, not from
  // NEXT_PUBLIC_MEDIA_URL — the value is baked in at build time and the test
  // runner need not have it, and a test that reads the same env var the config
  // reads would agree with a misconfiguration rather than catch it.
  const res = await page.goto('/projects/discover-all');
  await page.waitForLoadState('networkidle');
  const csp = (await res?.headerValue('content-security-policy')) ?? '';
  expect(csp, 'the page must send a CSP at all').toContain('img-src');

  const sample = await page.evaluate(
    () => [...document.querySelectorAll('img')].map((i) => i.src).find((s) => /demo-covers/.test(s)) ?? null,
  );
  expect(sample, 'need at least one served media URL to derive the origin from').toBeTruthy();
  const origin = new URL(sample as string).origin;

  // An HTTPS origin is already covered by the `https:` source in both
  // directives and needs no explicit entry, so there is nothing to assert.
  test.skip(origin.startsWith('https:'), 'https origins are covered by the https: source');

  for (const directive of ['img-src', 'media-src']) {
    const line = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(directive)) ?? '';
    expect(line, `${directive} must allow the media origin ${origin} — without it the browser makes no request at all`).toContain(origin);
  }
});
