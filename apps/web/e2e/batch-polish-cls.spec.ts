import { expect, test } from '@playwright/test';

/**
 * Batch POLISH — layout stability, guarded.
 *
 * The homepage sat at CLS ~0.75 (the "poor" band starts at 0.25) and nobody
 * noticed, because the shift only happened once you SCROLLED: 0.0034 measured
 * without scrolling, 0.64 with. The cause was `content-visibility: auto` with
 * `contain-intrinsic-size: auto 420px` on every magazine section — each one
 * collapsed from the 420px placeholder to its real 150–335px height as it came
 * into view, dragging the rest of the page up.
 *
 * A test that never scrolls would have called that page perfect, so this one
 * scrolls.
 */

const PAGES = ['/projects', '/projects/discover-all', '/spotlight'];

for (const path of PAGES) {
  test(`CLS: ${path} stays in the "good" band while scrolling`, async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          const s = e as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!s.hadRecentInput) (window as unknown as { __cls: number }).__cls += s.value ?? 0;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });

    await page.goto(path, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    // The scroll is the point: lazily-sized content only misbehaves when reached.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);

    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    // THRESHOLD 0.1 — the Core Web Vitals "good" boundary.
    //
    // Two defects had to go before this could be tightened from 0.25:
    //   · every magazine section collapsed from a 420px content-visibility
    //     placeholder to its real 150–335px height on scroll (homepage, 0.64)
    //   · the header's account slot reserved 42px while the signed-out state
    //     resolves to two CTAs — 94px → 258px wide — which squeezed the nav
    //     until it wrapped, growing the header on EVERY page (~0.11)
    //
    // The second only reproduced at ≤1280px, so it survived every measurement
    // taken at 1366. Playwright's default context is 1280x720, which is exactly
    // why this suite catches it and a hand-run harness did not.
    expect(cls, `${path} shifted ${cls.toFixed(4)} — layout stability regressed`).toBeLessThan(0.1);
  });
}
