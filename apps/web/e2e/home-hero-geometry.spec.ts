import { expect, test, type Page } from '@playwright/test';

/**
 * HERO-METRICS — the hero's geometry, as numbers rather than as a screenshot.
 *
 * Four defects were measured on the live page and all four are pinned here.
 * Each assertion states the number it failed at, because a threshold with no
 * failing case behind it is a guess.
 *
 *  G1  The stat row fell past the fold. 31px past at 1280x680, 82px on a phone.
 *  G2  The card's height moved between slides — six distinct heights spanning
 *      98px among ten slides at one viewport. The page never shifted (all ten
 *      share one grid cell, which takes the tallest), so CLS was clean and
 *      nothing caught it; the card's bottom edge and its 70px shadow simply
 *      landed somewhere new on every rotation.
 *  G3  «4,820 / مشروع مموَّل» sat at x = -11 on a 390px phone and x = -41 at
 *      360. [data-pillar] sets overflow-x:clip, so scrollWidth == clientWidth
 *      and every page-level overflow check read a clean 0px while the number
 *      was being sliced by the viewport edge.
 *  G4  The two columns differed by 42px, none of it the card.
 *
 * WHY offsetHeight AND NOT getBoundingClientRect. Idle slides carry
 * `transform: scale(.985)`, and a rect includes transforms — it reports 485 for
 * a 492px box. A rect-based uniformity check therefore sees a 7px spread that
 * is not real, and would keep "failing" after the defect is fixed while missing
 * the 98px one that is. offsetHeight is layout-only.
 */

const HOME = '/projects';
const STATS = '[data-testid="wathba-hero-stats"]';
const CURRENT = '[data-testid="wathba-hero-slide-current"]';

/** Every slide's laid-out card height, transform-free. */
async function cardHeights(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const rot = document.querySelector('[data-testid="wathba-hero-rotator"]');
    if (!rot) return [];
    return [...rot.children].map((el) => {
      const link = el.querySelector('[data-testid="wathba-hero-link"]') as HTMLElement | null;
      return link ? link.offsetHeight : -1;
    });
  });
}

/** Worst horizontal escape by anything inside the hero, in px. */
async function worstEscape(page: Page): Promise<{ px: number; what: string }> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sec = document.querySelector('.wathba-home-hero');
    let px = 0;
    let what = '';
    sec?.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      const over = Math.max(0 - r.left, r.right - vw);
      if (over > px) {
        px = over;
        what = `${el.tagName}.${String(el.className).slice(0, 24)} «${(el.textContent ?? '').trim().slice(0, 20)}»`;
      }
    });
    return { px: Math.round(px), what };
  });
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('G1: the credibility stats are inside the first viewport at 1440', async ({ page }) => {
    await page.goto(HOME);
    const stats = page.locator(STATS);
    await expect(stats).toBeVisible();

    const m = await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: document.documentElement.clientHeight };
    }, STATS);

    // The whole row, not merely its first pixel. 16px of clearance so this
    // fails before a reader has to guess whether the number is complete.
    expect(m.bottom, `stats bottom ${m.bottom} against a ${m.vh} fold`).toBeLessThanOrEqual(m.vh - 16);
    expect(m.top, 'the stats must not be scrolled off the top either').toBeGreaterThan(0);
  });

  test('G2: every slide renders the same card, and the card does not resize on a swap', async ({
    page,
  }) => {
    await page.goto(HOME);
    await expect(page.locator(CURRENT)).toBeVisible();

    const all = await cardHeights(page);
    test.skip(all.length < 2, 'no hero pool in this environment');
    expect(all.every((h) => h > 0), `a slide had no card: ${all.join('/')}`).toBe(true);
    // Exactly equal. This is a declared height, not a coincidence of content —
    // "within a few px" would pass against the 9px variant of the same bug.
    expect(
      Math.max(...all) - Math.min(...all),
      `card heights across the pool: ${all.join('/')}`,
    ).toBe(0);

    // And prove it across an actual rotation, on two demonstrably different
    // slides — the pool being uniform at rest says nothing about the swap.
    const before = await page.locator(`${CURRENT} h2`).innerText();
    const hBefore = (await cardHeights(page))[0]!;
    await page.getByRole('button', { name: 'المشروع التالي' }).click();
    await expect.poll(async () => page.locator(`${CURRENT} h2`).innerText()).not.toBe(before);
    const after = await page.locator(`${CURRENT} h2`).innerText();
    expect(after, 'the swap must land on a different project').not.toBe(before);
    expect((await cardHeights(page))[0]!, 'the card resized across the swap').toBe(hBefore);
  });

  test('G4: the two hero columns are the same height', async ({ page }) => {
    await page.goto(HOME);
    await expect(page.locator(CURRENT)).toBeVisible();

    const cols = await page.evaluate(() => {
      const sec = document.querySelector('.wathba-home-hero') as HTMLElement;
      const [text, card] = [...sec.children] as HTMLElement[];
      return { text: text!.offsetHeight, card: card!.offsetHeight };
    });
    // It was 42px, and the whole 42 was the control row sitting under the card.
    expect(
      Math.abs(cols.card - cols.text),
      `text ${cols.text} vs card ${cols.card}`,
    ).toBeLessThanOrEqual(8);
  });
});

test.describe('short laptop', () => {
  // 1280x680 is a 1366x768 Windows laptop once browser chrome is removed, and
  // it is the viewport the row actually failed on: bottom 711 against a 680
  // fold. At 1440x900 the row cleared the fold before this change too, so G1
  // alone could not have failed — a gate with no failing case behind it proves
  // nothing, and this is the case that gives the pair its teeth.
  test.use({ viewport: { width: 1280, height: 680 } });

  test('G1b: the hero spends its height budget so the stats clear a 680px fold', async ({
    page,
  }) => {
    await page.goto(HOME);
    await expect(page.locator(STATS)).toBeVisible();

    const m = await page.evaluate((sel) => {
      const sec = document.querySelector('.wathba-home-hero') as HTMLElement;
      const r = (document.querySelector(sel) as HTMLElement).getBoundingClientRect();
      const s = sec.getBoundingClientRect();
      return {
        budget: Math.round(r.bottom - s.top),
        bottom: Math.round(r.bottom),
        headerH: Math.round(s.top),
        vh: document.documentElement.clientHeight,
      };
    }, STATS);

    // Measured from the SECTION's top, not from the viewport's.
    //
    // The absolute form of this assertion failed once in a full-suite run and
    // passed in every isolated run, and the difference was not the hero: the
    // header above it is API-driven, and a suite that has spent 150 tests
    // creating categories renders a taller category strip, which moves the
    // whole page down. That is a real thing to know about and it is not this
    // change's to fix; asserting on it here would make a hero gate fail for a
    // header reason, which is the kind of guard that gets deleted rather than
    // read.
    //
    // 540 is what the hero now spends: 40px of padding plus a 500px column. It
    // was 588 — 64 + 502 plus the centring offset the 42px column mismatch
    // forced — so this fails against the old geometry by 48px.
    // With the 123px header this page ships, 540 puts the row's bottom edge at
    // 663 against a 680 fold. The absolute form of that is NOT asserted here —
    // see above — it is asserted in G1, at 1440x900, where 237px of clearance
    // survives a header that grew.
    expect(
      m.budget,
      `hero spends ${m.budget}px above the stat row (bottom ${m.bottom}, header ${m.headerH}, fold ${m.vh})`,
    ).toBeLessThanOrEqual(560);
  });
});

test.describe('tablet', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('G3: nothing in the hero escapes the viewport at 1024', async ({ page }) => {
    await page.goto(HOME);
    await expect(page.locator(CURRENT)).toBeVisible();
    // Let text metrics settle — a min-content-driven track re-resolves late.
    await page.waitForTimeout(1200);

    const worst = await worstEscape(page);
    expect(worst.px, `${worst.what} escapes by ${worst.px}px`).toBeLessThanOrEqual(1);
  });

  test('G5: the stat row is one line on tablet', async ({ page }) => {
    await page.goto(HOME);
    const stats = page.locator(STATS);
    await expect(stats).toBeVisible();

    // It measured 112px at 1024 and 157px below 900 — «312 مليون ر.س» wrapping
    // to three lines inside a fixed 30px type size. One line of a ~24px figure
    // plus a ~12px label is under 60px; 76px leaves room for the clamp without
    // admitting a second wrapped line.
    const h = await stats.evaluate((el) => (el as HTMLElement).offsetHeight);
    expect(h, `stat row is ${h}px — it has wrapped`).toBeLessThanOrEqual(76);
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });

  test('G6: the stats are not sliced by the viewport edge at 360', async ({ page }) => {
    await page.goto(HOME);
    await expect(page.locator(STATS)).toBeVisible();
    await page.waitForTimeout(1200);

    // This is the assertion home-hero-fit.spec.ts does not make: it measures the
    // ROTATOR, and the escape was in the text column beside it.
    const worst = await worstEscape(page);
    expect(worst.px, `${worst.what} escapes by ${worst.px}px`).toBeLessThanOrEqual(1);
  });
});
