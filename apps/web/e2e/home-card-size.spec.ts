import { expect, test } from '@playwright/test';

/**
 * Stage 1 item 11 — card size, and the responsive rule «الرائجة» never had.
 *
 * The section's grid was a bare `repeat(4,1fr)` with no media query at any
 * width. Measured on the previous build: 294px cards at 1280, 199px at 900, and
 * 71px at 390 — four columns of a phone — with the cover stuck at 158px
 * throughout. Nothing reported it: the section had no test, and the page-level
 * overflow check is blind here because [data-pillar] sets overflow-x: clip,
 * which makes scrollWidth equal clientWidth while content is being crushed.
 *
 * S2 is the one that matters. The rest guard the shape of the fix.
 */

const TREND = '.wathba-trend-grid';

async function firstTrendCard(page: import('@playwright/test').Page) {
  const card = page.locator(`${TREND} > a`).first();
  await expect(card).toBeVisible();
  return card;
}

test('S1: the discovery hero card is large, and its cover dominates it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/projects');

  const card = await firstTrendCard(page);
  const cardBox = (await card.boundingBox())!;
  const cover = card.locator('div[style*="aspect-ratio"]').first();
  const coverBox = (await cover.boundingBox())!;

  // Was 294px. Three-up on a 1320px container rather than four.
  expect(Math.round(cardBox.width), 'trending card is not the hero of discovery').toBeGreaterThanOrEqual(340);
  // Was a fixed 158px strip. The cover is the product; it must lead the card.
  expect(Math.round(coverBox.height), 'the cover no longer dominates the card').toBeGreaterThanOrEqual(220);
  expect(
    coverBox.height / cardBox.height,
    'the cover is a minor part of the card again',
  ).toBeGreaterThan(0.4);
});

test('S2: the trending grid is not four columns on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects');

  const grid = page.locator(TREND);
  await expect(grid).toBeVisible();
  const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(cols, `phone shows ${cols} columns`).toBe(1);

  const card = await firstTrendCard(page);
  const w = Math.round((await card.boundingBox())!.width);
  // The regression this exists for produced 71px. Anything near that is the
  // media query having been dropped again.
  expect(w, `trending card is ${w}px wide on a 390px viewport`).toBeGreaterThanOrEqual(300);
});

test('S3: the two shelves are deliberately different sizes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/projects');

  const cardIn = async (title: string) => {
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    const c = section.locator('a.lift').first();
    await expect(c, `no card found in «${title}»`).toBeVisible();
    return Math.round((await c.boundingBox())!.width);
  };

  const stretch = await cardIn('على وشك الاكتمال');
  const fresh = await cardIn('مفضلات جديدة');

  // Layout variance IS the rhythm fix: a shelf you stop at, then a strip you
  // scan. Equal widths would mean the same shelf twice.
  expect(stretch, 'the home-stretch shelf is not the larger one').toBeGreaterThan(fresh + 60);
});

test('S4: the larger covers cost no layout shift', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        const s = e as PerformanceEntry & { hadRecentInput?: boolean; value: number };
        if (!s.hadRecentInput) (window as unknown as { __cls: number }).__cls += s.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

  await page.goto('/projects');
  // Shifts below the fold count: the two carousels are down there, and their
  // covers changed shape too.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
  });
  await page.waitForTimeout(600);

  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  // The fixed-ratio boxes are the whole argument for changing height to
  // aspect-ratio. 0.1 is the "good" CWV threshold; this page measures ~0.005.
  expect(cls, `CLS ${cls.toFixed(4)}`).toBeLessThan(0.05);
});
