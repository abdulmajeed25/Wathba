import { expect, test } from '@playwright/test';

/**
 * The homepage's vertical rhythm.
 *
 * Spacing used to be a property of each section, set inline and independently —
 * the code blocks carried 74px (and a 56 and a 14), the magazine's Section
 * carried its own padding, the trending grid had 64. That produced gaps of 0,
 * 64, 74 and 116 on one page, and seven consecutive magazine sections touching
 * at 0px because their padding is internal and their boxes simply abut.
 *
 * A reader cannot tell a new chapter from the next item in the same one when
 * every boundary looks alike. The list owns the rhythm now: exactly two values,
 * and the larger one marks an act boundary.
 */

async function sections(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    for (let y = 0; y <= document.documentElement.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 110));
    }
    window.scrollTo(0, 0);
  });
  return page.evaluate(() => {
    // The inner .wathba-fade is the ordered list; the outer one is the shell's.
    const fades = [...document.querySelectorAll('.wathba-fade')];
    const list = fades[fades.length - 1]!;
    return [...list.children]
      .filter((el) => el.tagName === 'DIV' && (el as HTMLElement).style.marginTop)
      .map((el) => ({
        gap: Math.round(parseFloat(getComputedStyle(el).marginTop)),
        key: el.querySelector('[data-section]')?.getAttribute('data-section') ?? '(code)',
      }));
  });
}

test('R1: exactly two gap values, and the page uses both', async ({ page }) => {
  await page.goto('/projects');
  const secs = await sections(page);
  expect(secs.length, 'the ordered list should render sections').toBeGreaterThan(10);

  const distinct = [...new Set(secs.map((s) => s.gap))].sort((a, b) => a - b);
  expect(distinct, `two values only, got ${distinct.join('/')}`).toHaveLength(2);

  // The difference has to be legible. Two values 8px apart is one value with a
  // rounding error, and would not read as a chapter break.
  const [within, act] = distinct as [number, number];
  expect(act / within, 'the act gap must be clearly larger').toBeGreaterThan(1.4);
});

test('R2: no two sections touch', async ({ page }) => {
  await page.goto('/projects');
  const secs = await sections(page);
  const touching = secs.filter((s) => s.gap === 0).map((s) => s.key);
  // Seven of them did, before the list owned this.
  expect(touching, 'sections with no gap above them').toEqual([]);
});

test('R3: the rhythm shrinks on a phone but keeps its ratio', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dp = await desktop.newPage();
  await dp.goto('/projects');
  const d = [...new Set((await sections(dp)).map((s) => s.gap))].sort((a, b) => a - b);
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
  const mp = await mobile.newPage();
  await mp.goto('/projects');
  const m = [...new Set((await sections(mp)).map((s) => s.gap))].sort((a, b) => a - b);
  await mobile.close();

  // 96px between chapters is a lot of a 360px screen; the absolute height comes
  // down while the ratio — which is what reads as structure — stays.
  expect(m[1]!, 'the act gap should be smaller on a phone').toBeLessThan(d[1]!);
  expect(m[1]! / m[0]!, 'the ratio survives the shrink').toBeGreaterThan(1.4);
});
