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
  expect(
    new Set(heights).size,
    `all chapters are the same height: ${heights.join(' / ')}`,
  ).toBeGreaterThan(1);

  // And the full-bleed chapter must genuinely escape the contained grid, which
  // is what makes it a different SHAPE rather than a different colour.
  const band = page.locator('#inventive .wathba-spotlight-band');
  if (await band.count()) {
    const w = await band.evaluate((el) => ({
      band: Math.round(el.getBoundingClientRect().width),
      contained: Math.round(
        (
          el.closest('section')!.querySelector('h2')!.closest('div') as HTMLElement
        ).getBoundingClientRect().width,
      ),
    }));
    expect(w.band, 'the full-bleed band must be wider than the contained column').toBeGreaterThan(
      w.contained,
    );
  }
});

/**
 * SC4 — the hero's contrast, measured against the pixels it actually paints.
 *
 * batch-polish-public-contrast.spec.ts cannot answer this and says so: it
 * composites CSS background-colours, and this hero's ground is an <img> layer.
 * It is excluded there by the same rule that excludes any text over a
 * photograph, which means the guarantee has to live here instead.
 *
 * Method: blank the ink, screenshot, read the PNG back through a canvas as a
 * data: URL — same-origin, unlike the cross-origin cover, so nothing taints —
 * then sample every pixel under each GLYPH RUN and keep the worst.
 *
 * The glyph run matters. Sampling an element's bounding rect reads the corners
 * of rounded buttons and pills, which lie outside the border-radius and show
 * whatever is behind them: that reported the CTA at 1.02:1 against a ground
 * its text never touches.
 */
// BOTH THEMES, and the theme axis is not decoration. The hero pins its own
// white ink over a photographic ground, so most of it cannot change with the
// palette — but the CTA does not: it paints var(--cta-grad) under
// var(--on-accent), and both move. Running only the default theme left the one
// theme-dependent pair in this section unmeasured by anything, since the
// DOM-walking spec excludes the hero entirely.
for (const [w, h] of [
  [1440, 900],
  [360, 740],
] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`SC4(${w}, ${theme}): hero copy clears WCAG AA over the real cover pixels`, async ({
      page,
    }) => {
      const HERO = 'section[aria-labelledby="spotlight-hero-title"]';

      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: theme });
      await page.addInitScript((t) => {
        try {
          localStorage.setItem('wathba:theme', t);
        } catch {
          /* private mode — the colour-scheme emulation above still applies */
        }
      }, theme);
      await page.goto('/spotlight');
      // Assert the palette actually switched. Writing the WRONG STORAGE KEY is
      // how a dark-mode screenshot pass produced two byte-identical files: the
      // key is `wathba:theme`, not `wathba-theme`, and nothing complains.
      await expect(page.locator(`[data-theme="${theme}"]`).first()).toBeAttached();
      await expect(page.locator('#spotlight-hero-title')).toBeVisible();

      // THE GROUND HAS TO BE THERE BEFORE IT IS SAMPLED. Waiting only for the
      // heading made this flaky under parallel workers: the screenshot landed
      // before the cover decoded, so the pixels behind the copy were whatever
      // sits under the image rather than the image, and white ink over the light
      // page surface fails every threshold.
      //
      // naturalWidth, not `complete`. A blocked image reports complete === true
      // with naturalWidth === 0, which reads exactly like a decoded one — so a
      // CSP or storage failure would otherwise be measured as a real contrast
      // result. If this never resolves the hero genuinely has no ground, and
      // failing loudly here is correct.
      await page.waitForFunction(
        (sel) => {
          const img = document.querySelector(sel)?.querySelector('img');
          return !img || (img.complete && img.naturalWidth > 0);
        },
        HERO,
        { timeout: 15000 },
      );
      // Glyph boxes move when the Arabic webfont swaps in; measure after.
      await page.evaluate(() => document.fonts.ready);
      const boxes = await page.evaluate((sel) => {
        const hero = document.querySelector(sel);
        if (!hero) return [];
        const out: Array<Record<string, number | string | boolean>> = [];
        for (const el of hero.querySelectorAll('h1, p, div, span, a')) {
          const cs = getComputedStyle(el);
          for (const n of el.childNodes) {
            if (n.nodeType !== 3 || !n.textContent!.trim()) continue;
            const rg = document.createRange();
            rg.selectNodeContents(n);
            for (const r of rg.getClientRects()) {
              if (r.width < 4 || r.height < 4 || r.top > innerHeight || r.bottom < 0) continue;
              out.push({
                text: n.textContent!.trim().slice(0, 24),
                color: cs.color,
                fontSize: parseFloat(cs.fontSize),
                bold: (parseInt(cs.fontWeight, 10) || 400) >= 700,
                x: Math.max(0, Math.round(r.x)),
                y: Math.max(0, Math.round(r.y)),
                w: Math.round(r.width),
                h: Math.round(r.height),
              });
            }
          }
        }
        return out;
      }, HERO);

      expect(boxes.length, 'no hero text found to measure').toBeGreaterThan(0);

      await page.evaluate((sel) => {
        for (const el of document.querySelector(sel)!.querySelectorAll('*')) {
          (el as HTMLElement).style.setProperty('color', 'transparent', 'important');
          (el as HTMLElement).style.setProperty('text-shadow', 'none', 'important');
        }
      }, HERO);

      const shot = (await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } })).toString(
        'base64',
      );

      const fails = await page.evaluate(
        async ({ shot, boxes }) => {
          const img = new Image();
          img.src = 'data:image/png;base64,' + shot;
          await img.decode();
          const cv = document.createElement('canvas');
          cv.width = img.width;
          cv.height = img.height;
          const cx = cv.getContext('2d', { willReadFrequently: true })!;
          cx.drawImage(img, 0, 0);

          const lin = (v: number): number => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          };
          const lum = (r: number, g: number, b: number): number =>
            0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
          const ratio = (a: number, b: number): number => {
            const [hi, lo] = a > b ? [a, b] : [b, a];
            return (hi + 0.05) / (lo + 0.05);
          };

          const bad: Array<{ ratio: number; need: number; txt: string }> = [];
          for (const bx of boxes as Array<Record<string, never>>) {
            const b = bx as unknown as {
              color: string;
              fontSize: number;
              bold: boolean;
              x: number;
              y: number;
              w: number;
              h: number;
              text: string;
            };
            const [tr, tg, tb] = b.color.match(/[\d.]+/g)!.map(Number);
            // Text alpha composites onto whatever is behind it.
            const alpha = b.color.startsWith('rgba') ? Number(b.color.match(/[\d.]+/g)![3]) : 1;
            const ww = Math.min(b.w, cv.width - b.x);
            const hh = Math.min(b.h, cv.height - b.y);
            if (ww < 1 || hh < 1) continue;
            const d = cx.getImageData(b.x, b.y, ww, hh).data;
            let worst = Infinity;
            for (let i = 0; i < d.length; i += 4) {
              const gl = lum(d[i], d[i + 1], d[i + 2]);
              const fg = lum(
                Math.round(tr * alpha + d[i] * (1 - alpha)),
                Math.round(tg * alpha + d[i + 1] * (1 - alpha)),
                Math.round(tb * alpha + d[i + 2] * (1 - alpha)),
              );
              const rr = ratio(fg, gl);
              if (rr < worst) worst = rr;
            }
            const need = b.fontSize >= 24 || (b.bold && b.fontSize >= 18.66) ? 3 : 4.5;
            if (worst < need) bad.push({ ratio: Number(worst.toFixed(2)), need, txt: b.text });
          }
          return bad;
        },
        { shot, boxes },
      );

      expect(
        fails,
        `hero copy below WCAG AA over the cover:\n` +
          fails.map((f) => `  ${f.ratio}<${f.need} "${f.txt}"`).join('\n'),
      ).toEqual([]);
    });
  }
}

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
      ...[
        ...document.querySelectorAll('.wathba-spotlight-band > a, .wathba-spotlight-trio > a'),
      ].map((el) => Math.round(el.getBoundingClientRect().width)),
      Infinity,
    ),
  }));

  expect(o.scrollW, 'the page must not scroll horizontally at 360').toBeLessThanOrEqual(
    o.clientW + 1,
  );
  if (Number.isFinite(o.narrowest)) {
    expect(o.narrowest, 'cards must collapse to one column, not shrink').toBeGreaterThan(200);
  }
});
