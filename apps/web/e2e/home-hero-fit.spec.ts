import { expect, test } from '@playwright/test';

/**
 * The hero card has to FIT the phone it is on.
 *
 * `.wathba-home-hero` is a grid, and the rotator is one of its items. A grid
 * item's default `min-width: auto` means the track cannot shrink below the
 * item's min-content — and the hero's four-stat row has a min-content of about
 * 377px. So the mobile `1fr` track blew past the section's 338px content box by
 * ~39px, and it RE-RESOLVED every time text metrics changed: the stat row
 * wrapped to a third line, then unwrapped, ~30ms apart, at ~1s.
 *
 * That pair of reflows measured 0.14 CLS each — real-input mobile CLS ran a
 * median of 0.171 across eight runs, well past the 0.1 "good" threshold, while
 * the desktop page sat at 0.0001. The fix is `minmax(0, 1fr)`, which lets the
 * track shrink to the column and stops min-content from driving the layout.
 *
 * These assertions are about FIT and STABILITY, not about a CLS number. A CLS
 * threshold is a flaky assertion — it depends on network timing and on whether
 * the font cache is warm. Overflow and a settling width are deterministic, and
 * they are the actual defect.
 */

const PHONE = { width: 390, height: 844 };

test.use({ viewport: PHONE, isMobile: true, hasTouch: true });

test('H1: the hero card sits inside the hero section on a phone', async ({ page }) => {
  await page.goto('/projects');
  const card = page.getByTestId('wathba-hero-rotator');
  await expect(card).toBeVisible();

  const box = await page.evaluate(() => {
    const section = document.querySelector('.wathba-home-hero') as HTMLElement;
    const grid = document.querySelector('[data-testid="wathba-hero-rotator"]') as HTMLElement;
    const cs = getComputedStyle(section);
    const s = section.getBoundingClientRect();
    const g = grid.getBoundingClientRect();
    return {
      contentStart: s.x + parseFloat(cs.paddingLeft),
      contentEnd: s.right - parseFloat(cs.paddingRight),
      gridStart: g.x,
      gridEnd: g.right,
    };
  });

  // The column IS the content box on a phone — one item, one track. Equality
  // (within a subpixel) is the invariant; "merely inside" would also accept a
  // track that collapsed. It overflowed by 39px.
  expect(box.gridStart, 'the card overflows the start edge').toBeCloseTo(box.contentStart, 0);
  expect(box.gridEnd, 'the card overflows the end edge').toBeCloseTo(box.contentEnd, 0);
});

test('H2: the hero card width settles and stays settled', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.getByTestId('wathba-hero-rotator')).toBeVisible();

  // Sample across the window the shifts landed in (~0.8s-1.5s), then once more
  // well after. A track sized by min-content moves as text metrics resolve; a
  // track sized by the column does not.
  const widths = await page.evaluate(async () => {
    const grid = document.querySelector('[data-testid="wathba-hero-rotator"]') as HTMLElement;
    const seen: number[] = [];
    for (let i = 0; i < 14; i++) {
      seen.push(Math.round(grid.getBoundingClientRect().width));
      await new Promise((r) => setTimeout(r, 120));
    }
    return seen;
  });

  const spread = Math.max(...widths) - Math.min(...widths);
  expect(spread, `hero width moved across ${widths.join('/')}`).toBeLessThanOrEqual(1);
});

/*
 * There is deliberately no third test sampling the stat row's line count. The
 * wrap and the unwrap were ~30ms apart; a polling guard misses that window far
 * more often than it catches it, and a guard that usually passes for the wrong
 * reason is worse than none — it reads as proof. H1 asserts the cause, H2
 * asserts that the cause stays fixed. The wrap cannot happen if the track is
 * the column.
 */
