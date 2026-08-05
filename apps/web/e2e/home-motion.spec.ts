import { expect, test } from '@playwright/test';

/**
 * The homepage's motion contract.
 *
 * The surface carried twelve ad-hoc durations and fell back to the browser's
 * default `ease` wherever a curve was omitted. Twelve durations is not a
 * decision, and `ease` is the absence of one. These assert the properties worth
 * keeping rather than every value — a duration may be retuned, but a bar that
 * grows from the wrong edge in Arabic is a defect in any tuning.
 */

test('M1: the funding bar grows from the reading start, and moves nothing', async ({ page }) => {
  await page.goto('/projects');
  const bar = page.locator('.wathba-hero-bar').first();
  await expect(bar).toBeVisible();

  const r = await bar.evaluate((el) => {
    const s = getComputedStyle(el);
    const track = el.parentElement!.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    return {
      prop: s.transitionProperty,
      // RTL: the bar is pinned to the right edge of its track and scales left.
      pinnedToStart: Math.abs(b.right - track.right) < 2,
      originX: Math.round(parseFloat(s.transformOrigin)),
      trackW: Math.round(track.width),
    };
  });

  // `width` would reflow the track on every frame; `transform` does not.
  expect(r.prop, 'the bar must animate transform, not width').toBe('transform');
  expect(r.pinnedToStart, 'in RTL the bar must start at the right edge').toBe(true);
  // transform-origin sits at the track's right edge, not its centre — a centred
  // origin makes the bar grow outwards from the middle in both directions.
  expect(Math.abs(r.originX - r.trackW), 'origin must be the reading-start edge').toBeLessThan(3);
});

test('M2: pressable cards answer a press', async ({ page }) => {
  // The hero controls always did; the project cards — the most-clicked thing on
  // the page — did not, so a card read as a picture of a card until the
  // navigation happened.
  await page.goto('/projects');
  const card = page.locator('.wathba-pressable').first();
  await expect(card).toBeVisible();

  const s = await card.evaluate((el) => {
    const c = getComputedStyle(el);
    return { prop: c.transitionProperty, dur: c.transitionDuration };
  });
  expect(s.prop, 'press feedback must be a transform').toContain('transform');
  // Fast enough to read as contact rather than as an animation.
  expect(parseFloat(s.dur), 'press feedback must be under 200ms').toBeLessThan(0.2);
});

test('M3: reduced motion is honoured, not merely declared', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/projects');

  const durs = await page.evaluate(() =>
    ['.wathba-hero-bar', '.wathba-pressable', '.wathba-hero-slide']
      .map((sel) => {
        const el = document.querySelector(sel);
        return el ? parseFloat(getComputedStyle(el).transitionDuration) : 0;
      }),
  );
  for (const d of durs) expect(d, 'reduced motion must collapse transitions').toBeLessThan(0.05);
  await ctx.close();
});

test('M4: nothing on the homepage animates a layout property', async ({ page }) => {
  await page.goto('/projects');
  await page.evaluate(async () => {
    for (let y = 0; y <= document.documentElement.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 110));
    }
    window.scrollTo(0, 0);
  });

  const offenders = await page.evaluate(() => {
    const bad: string[] = [];
    document.querySelectorAll('main *').forEach((el) => {
      // The carousel dot indicators are the ONE deliberate exception: the
      // active dot widens from 8px to 22px as a pill. scaleX would distort its
      // border radius, and — the deciding reason — it would not shift the
      // sibling dots, so they would overlap. There the layout change IS the
      // effect, on three elements. Scoped to [role="tablist"] so the rest of
      // the page still has to obey.
      if (el.closest('[role="tablist"]')) return;
      const s = getComputedStyle(el);
      if (!s.transitionDuration || s.transitionDuration === '0s') return;
      for (const prop of s.transitionProperty.split(', ')) {
        if (['width', 'height', 'margin', 'padding', 'all'].includes(prop)) {
          bad.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 20)} → ${prop}`);
        }
      }
    });
    return bad;
  });

  expect(offenders, 'layout-property transitions inside main').toEqual([]);
});
