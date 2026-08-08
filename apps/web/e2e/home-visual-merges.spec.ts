import { expect, test, type Page } from '@playwright/test';

/**
 * HOME-REVIEW — the three visual merges.
 *
 * The audit's fourth weakness was layout monotony: 13 of 15 sections shared one
 * container and one card, with no full-bleed moment and no change of ground
 * anywhere except a single green bar. Four consecutive editorial sections ran
 * ~1350px with no image between them, and two of the pairs were
 * indistinguishable — a reader cannot tell «قصص نجاح» from «حوارات مع
 * المبدعين» when both are four identical cards in the same box, so the second
 * heading does no work.
 *
 * M1-M2 pin the merges. M3 pins the STAGE, which is the part that carries a
 * real risk: it paints a dark ground in BOTH themes, so it is the one place on
 * the page where a light-theme reader meets light-on-dark text.
 */

const HOME = '/projects';

async function sectionKeys(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-section]')].map((n) => n.getAttribute('data-section') ?? ''),
  );
}

test('M1: stories and interviews are one block, not two look-alikes', async ({ page }) => {
  await page.goto(HOME);
  const keys = await sectionKeys(page);

  // Exactly one of the pair survives as a section; the other is absorbed.
  const present = keys.filter((k) => k === 'success_stories' || k === 'creator_interviews');
  expect(present, `both halves still rendered as sections: ${present.join(', ')}`).toHaveLength(1);

  const block = page.locator(`[data-section="${present[0]}"]`);
  await expect(block.getByRole('heading', { level: 2 })).toHaveText('من الفكرة إلى التسليم');

  // Both halves are still ON the page — a merge folds, it does not delete.
  await expect(block.locator('[data-section-part="success_stories"]')).toBeVisible();
  await expect(block.locator('[data-section-part="creator_interviews"]')).toBeVisible();
});

test('M2: creator resources are one block', async ({ page }) => {
  await page.goto(HOME);
  const keys = await sectionKeys(page);

  const present = keys.filter((k) => k === 'creators_corner' || k === 'funding_tips');
  expect(present, `both halves still rendered as sections: ${present.join(', ')}`).toHaveLength(1);

  const block = page.locator(`[data-section="${present[0]}"]`);
  await expect(block.getByRole('heading', { level: 2 })).toHaveText('مصادر المبدعين');
  await expect(block.locator('[data-section-part="creators_corner"]')).toBeVisible();
  await expect(block.locator('[data-section-part="funding_tips"]')).toBeVisible();
});

test('M3: the stage is the only full-bleed section, and it is dark in both themes', async ({
  page,
}) => {
  await page.goto(HOME);

  // Exactly one stage. Scarcity is the whole mechanism the review argued for —
  // a second full-bleed moment on this page makes both of them ordinary.
  const stages = page.locator('[data-stage="1"]');
  await expect(stages).toHaveCount(1);
  // toHaveCount proves the element EXISTS; it says nothing about layout, and
  // measuring straight after it read a width of 0 against a 1280 viewport.
  // toBeVisible requires a non-empty bounding box, so it is the assertion that
  // actually waits for the thing being measured.
  await expect(stages).toBeVisible();

  const geom = await page.evaluate(() => {
    const s = document.querySelector('[data-stage="1"]') as HTMLElement;
    const r = s.getBoundingClientRect();
    return { width: Math.round(r.width), viewport: document.documentElement.clientWidth };
  });
  // Full bleed means the SECTION spans the viewport; its inner container is
  // still 1320-capped, which is what keeps the copy readable.
  expect(geom.width, 'the stage must span the viewport').toBe(geom.viewport);

  // Reads the CURRENT computed ground; the theme is whatever the page is in at
  // the time of the call. It took a `theme` argument that nothing inside used,
  // which was only ever a label — and the assertion messages below already say
  // which mode is being checked.
  const ground = () =>
    page.evaluate(() => {
      const s = document.querySelector('[data-stage="1"]') as HTMLElement;
      return getComputedStyle(s).backgroundColor;
    });

  const light = await ground();
  // #131210
  expect(light, 'the stage stays dark in LIGHT mode — that is the point').toBe('rgb(19, 18, 16)');

  await page.getByTitle('تبديل النمط').first().click();
  await expect
    .poll(async () =>
      page.evaluate(() => document.querySelector('[data-pillar="ventures"]')?.getAttribute('data-theme')),
    )
    .toBe('dark');
  expect(await ground(), 'and the same dark in dark mode').toBe('rgb(19, 18, 16)');
});

test('M5: the stage fits the phone', async ({ browser }) => {
  // NOT a page-level scrollWidth check. [data-pillar="ventures"] sets
  // `overflow-x: clip`, which makes documentElement.scrollWidth equal
  // clientWidth — so the usual "does the page scroll sideways" assertion reads
  // a clean 0px while content is being cut off. This walks the stage's own
  // boxes instead, which clip cannot hide.
  for (const width of [360, 390, 414]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(HOME);
    await expect(page.locator('[data-stage="1"]')).toBeVisible();

    const worst = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      let over = 0;
      document.querySelectorAll('[data-stage="1"] *').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0) return;
        over = Math.max(over, 0 - r.left, r.right - vw);
      });
      return Math.round(over);
    });
    expect(worst, `stage content escapes the viewport at ${width}px`).toBeLessThanOrEqual(1);
    await ctx.close();
  }
});

test('M4: the stage carries the conversion CTA at peak conviction', async ({ page }) => {
  await page.goto(HOME);
  const stage = page.locator('[data-stage="1"]');
  await expect(stage.getByText('ادعم هذا المشروع')).toBeVisible();

  // The whole feature card is the link; the CTA must NOT be a nested anchor.
  // An <a> inside an <a> is invalid and screen readers announce it
  // unpredictably, which is exactly the kind of thing that looks fine.
  const nested = await page.evaluate(
    () => document.querySelectorAll('[data-stage="1"] a a').length,
  );
  expect(nested, 'nested anchors inside the stage').toBe(0);
});
