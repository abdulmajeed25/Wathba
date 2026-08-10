import { expect, test } from '@playwright/test';

/**
 * Batch SPOTLIGHT-PLUS P3 — the motion pass.
 *
 * The audit's finding was "motion is one note": every section arrived as a
 * single block on one 620ms curve, header and all five cards together. A
 * chapter now has an internal order.
 *
 * What these guard is the part that is easy to get wrong and invisible when it
 * is: that the stagger is real rather than a class name, that a chapter does
 * not double-move, and above all that a reduced-motion reader is never left
 * looking at content that is waiting to be revealed.
 */

const CHAPTER = '#staff-picks';

test('SM1: a chapter arrives in order, and does not move itself', async ({ page }) => {
  await page.goto('/spotlight');

  // Below the fold, so it is armed rather than shown immediately.
  await page.locator(CHAPTER).scrollIntoViewIfNeeded();
  await expect
    .poll(() => page.locator(CHAPTER).getAttribute('data-revealed'), {
      message: 'the chapter never revealed',
    })
    .toBe('1');

  const m = await page.locator(CHAPTER).evaluate((s) => ({
    // -flat: the parent fades only. If it also translated, its offset would
    // compose with each child's and the chapter would drift in rather than
    // arrive.
    sectionTransform: getComputedStyle(s).transform,
    delays: [...s.querySelectorAll('.wathba-stagger-item')].map((el) =>
      parseFloat(getComputedStyle(el).transitionDelay),
    ),
  }));

  expect(m.sectionTransform, 'a staggered chapter must not translate itself').toBe('none');
  expect(m.delays.length, 'no staggered items found').toBeGreaterThan(1);

  // Strictly increasing while under the cap — that IS the stagger. Equal
  // delays would mean the class shipped but --i never did.
  const capped = m.delays.slice(0, 6);
  for (let i = 1; i < capped.length; i++) {
    expect(capped[i], `item ${i} does not follow item ${i - 1}`).toBeGreaterThan(capped[i - 1]!);
  }

  // And it stays punctuation. A chapter whose last card waits half a second
  // after its first has turned stagger into latency.
  expect(Math.max(...m.delays), 'the stagger has become a queue').toBeLessThanOrEqual(0.33);
});

test('SM3: a chrome-less tile does not paint a shadow around nothing', async ({ page }) => {
  await page.goto('/spotlight');
  const tile = page.locator('#inventive .wathba-spotlight-band a').first();
  if (!(await tile.count())) test.skip(true, 'no full-bleed band rendered');

  await tile.scrollIntoViewIfNeeded();
  await tile.hover();

  // The lift is the feedback and must survive; the shadow described a card
  // that is not there — these tiles have no background, border or radius.
  await expect
    .poll(() => tile.evaluate((el) => getComputedStyle(el).transform))
    .not.toBe('none');
  const sh = await tile.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(sh, 'a bare tile must not paint a hover shadow').toBe('none');
});

test.describe('reduced motion', () => {
  test('SM2: nothing is hidden from a reader who asked for less motion', async ({ page }) => {
    // emulateMedia, NOT test.use({ reducedMotion }). The fixture form did not
    // reach the browser here — matchMedia('(prefers-reduced-motion: reduce)')
    // read false inside the test — so the first version of this spec measured
    // an ordinary page and blamed it for having four armed sections. The
    // precondition is asserted below either way.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/spotlight');
    await page.locator(CHAPTER).scrollIntoViewIfNeeded();

    const m = await page.evaluate(() => ({
      // ASSERT THE PRECONDITION. If the preference never reached the browser
      // this test would "pass" as a check of ordinary motion, or fail blaming
      // the page for the harness — either way saying nothing about the thing
      // it exists to protect.
      prefersReduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
      // The component refuses to ARM anything under reduced motion, so the
      // attribute the hidden state keys off is never written. Belt and braces:
      // the CSS hidden state also only exists inside `no-preference`.
      armed: document.querySelectorAll('[data-revealed]').length,
      faded: [...document.querySelectorAll('.wathba-reveal, .wathba-stagger-item')].filter(
        (el) => Number(getComputedStyle(el).opacity) < 0.99,
      ).length,
      delayed: [...document.querySelectorAll('.wathba-stagger-item')].filter(
        (el) => parseFloat(getComputedStyle(el).transitionDelay) > 0,
      ).length,
    }));

    expect(m.prefersReduce, 'the reduced-motion preference never reached the browser').toBe(true);
    expect(m.armed, 'nothing may be armed for a reduced-motion reader').toBe(0);
    expect(m.faded, 'content must not be waiting at opacity 0').toBe(0);
    expect(m.delayed, 'no entrance may be delayed').toBe(0);
  });
});
