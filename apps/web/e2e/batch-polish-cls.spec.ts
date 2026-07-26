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
  test(`CLS: ${path} stays out of the "poor" band while scrolling`, async ({ page }) => {
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
    // THRESHOLD 0.25 — the boundary of the "poor" band, not the 0.1 "good" one,
    // and the reason is worth stating rather than hiding behind a round number.
    //
    // The homepage-specific defect this batch fixed is gone: 0.75 → 0.0035 when
    // measured to mid-page. But scrolling all the way to the BOTTOM still costs
    // ~0.11 on EVERY page here — /projects 0.1174, /projects/discover-all
    // 0.1136, /spotlight 0.1131. That uniformity is the tell: it is one shared
    // shift low on the page, not three page-specific bugs, and discover carried
    // it before this batch started (0.108 measured at the outset).
    //
    // So this guard locks in the win — 0.75 can never come back — while being
    // honest that a shared residual remains and is a separate piece of work.
    // Tightening to 0.1 is the follow-up, once that shift is found.
    expect(cls, `${path} shifted ${cls.toFixed(4)} — layout stability regressed`).toBeLessThan(0.25);
  });
}
