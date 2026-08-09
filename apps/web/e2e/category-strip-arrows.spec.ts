import { expect, test, type Page } from '@playwright/test';

/**
 * The category strip's scroll arrows must actually move it, and every category
 * must be reachable with the mouse alone.
 *
 * What was wrong: `nudge()` converted "toward the end" into a POSITIVE scrollBy
 * delta. In RTL, Blink starts scrollLeft at 0 and runs NEGATIVE toward the end,
 * so that delta was clamped at 0 and the strip never moved. At rest only the
 * end arrow is rendered — so the single arrow a reader could see was precisely
 * the one that did nothing, and 13 of the 21 categories could not be reached by
 * mouse at all. «التراث والثقافة» and everything after it were simply cut off.
 *
 * The keyboard path had it right the whole time, which is how this survived:
 * arrow keys moved the strip, the arrows did not. So this asserts the MOUSE
 * path specifically — the arrows are aria-hidden decoration (the keyboard is
 * the accessible route), which is also why no role-based locator finds them.
 */

const ARROW = '.wathba-cat-arrow';
const STRIP = '.wathba-catstrip';
const PILL = '.wathba-cat-pill';

async function stripState(page: Page) {
  return page.evaluate(
    ([stripSel, pillSel]) => {
      const el = document.querySelector(stripSel) as HTMLElement | null;
      if (!el) return null;
      const pills = [...el.querySelectorAll(pillSel)];
      const last = pills[pills.length - 1] as HTMLElement | undefined;
      const r = last?.getBoundingClientRect();
      return {
        // RTL reports scrollLeft negative in Blink — magnitude is what matters.
        scrolled: Math.round(Math.abs(el.scrollLeft)),
        max: Math.round(el.scrollWidth - el.clientWidth),
        overflowing: el.scrollWidth > el.clientWidth + 1,
        pillCount: pills.length,
        lastText: last?.textContent?.trim() ?? null,
        lastFullyVisible: r ? r.left >= -0.5 && r.right <= window.innerWidth + 0.5 : false,
      };
    },
    [STRIP, PILL] as const,
  );
}

test('N1: the arrows scroll the strip, and the last category becomes reachable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/projects');
  await page.locator(PILL).first().waitFor({ state: 'visible', timeout: 15_000 });

  const start = await stripState(page);
  expect(start, 'no category strip on the page').not.toBeNull();
  expect(start!.overflowing, 'the strip does not overflow here — this test proves nothing').toBe(true);
  expect(start!.scrolled, 'the strip should begin at its start edge').toBeLessThanOrEqual(4);
  expect(start!.lastFullyVisible, 'the last category is already visible — nothing to scroll to').toBe(false);

  // Click the visible arrow until it retires. Bounded: one screenful per click
  // over a strip under ~4 screenfuls, so ~5 is generous; a strip that never
  // advances hits the bound with the last pill still off-screen and fails below.
  let moved = 0;
  for (let i = 0; i < 8; i++) {
    const arrows = page.locator(ARROW);
    const before = (await stripState(page))!.scrolled;
    // The END arrow is the last one rendered when both are present.
    const count = await arrows.count();
    if (count === 0) break;
    await arrows.nth(count - 1).click();
    await page.waitForTimeout(600);
    const after = (await stripState(page))!.scrolled;
    if (after > before) moved++;
    if ((await stripState(page))!.lastFullyVisible) break;
  }

  expect(moved, 'clicking the arrow never changed scrollLeft — the strip is frozen').toBeGreaterThan(0);

  const end = await stripState(page);
  expect(
    end!.lastFullyVisible,
    `«${end!.lastText}» is still off-screen after clicking through: scrolled ${end!.scrolled} of ${end!.max}`,
  ).toBe(true);
});

test('N2: at each end, only the arrow that can still move is offered', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/projects');
  await page.locator(PILL).first().waitFor({ state: 'visible', timeout: 15_000 });

  // At the start edge there is nothing behind you, so exactly one arrow.
  expect(await page.locator(ARROW).count(), 'at the start edge only the forward arrow belongs').toBe(1);

  // Drive to the far end and check the offer flips rather than going stale.
  //
  // `behavior: 'instant'` overrides the strip's own `scroll-behavior: smooth`.
  // Assigning scrollLeft starts an ANIMATION, and mid-animation both arrows are
  // correctly on screen — so a fixed wait here is a guess about how long the
  // browser takes, and when the guess is wrong the test reports a product bug
  // that is not there. (Measured: fails, then passes on retry, running alone.)
  await page.evaluate(
    ([stripSel]) => {
      const el = document.querySelector(stripSel) as HTMLElement;
      // Blink RTL: the end is the most-negative scrollLeft.
      el.scrollTo({ left: -(el.scrollWidth - el.clientWidth), behavior: 'instant' });
    },
    [STRIP] as const,
  );

  // Poll rather than sleep: the scroll listener that recomputes the arrows runs
  // on the browser's own schedule, and the assertion is "it settles here", not
  // "it settles within 600ms".
  await expect
    .poll(() => page.locator(ARROW).count(), {
      message: 'at the far end only the back arrow belongs',
      timeout: 10_000,
    })
    .toBe(1);

  const atEnd = await stripState(page);
  expect(atEnd!.lastFullyVisible, 'scrolling to the far end did not reveal the last pill').toBe(true);
});
