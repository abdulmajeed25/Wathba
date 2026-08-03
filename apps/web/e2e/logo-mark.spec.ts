import { expect, test, type Page } from '@playwright/test';

/**
 * The logo mark — the rocket glyph inside the green square.
 *
 * It shipped near-black (#08130d) in BOTH themes, because it borrowed
 * `--on-accent`, and `--on-accent` is deliberately dark: it is the ink for TEXT
 * on the brand green, where white measured 2.39:1 and failed 1.4.3 on every
 * primary CTA. The mark got dragged along with a decision that was never about
 * it. A black rocket on a green square is not a legibility problem, it is a
 * brand problem.
 *
 * So the mark now has its own token, `--logo-mark`, exactly as `--chip-fill`
 * was split off from `--on-accent` for the same reason. The two assertions that
 * matter are therefore paired: the mark is white, AND `--on-accent` did not
 * move. Fixing the logo by lightening the CTA ink would look identical here and
 * would silently undo the contrast pass — so this spec objects to it.
 */

const HOME = '/projects';

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  const root = page.locator('[data-theme]').first();
  if ((await root.getAttribute('data-theme')) !== theme) {
    await page.getByTitle('تبديل النمط').click();
  }
  await expect(page.locator(`[data-theme="${theme}"]`).first()).toBeAttached();
  // The shell animates `background .4s, color .4s`; sampling sooner reads
  // mid-transition values that belong to neither theme.
  await page.waitForTimeout(700);
}

/** Computed paint of every logo lockup on the page, plus its own ground. */
async function marks(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="wathba-logo-mark"]')].map((sq) => {
      const svg = sq.querySelector('svg')!;
      const cs = getComputedStyle(svg);
      const sqs = getComputedStyle(sq);
      return {
        fill: cs.fill,
        stroke: cs.stroke,
        ground: sqs.backgroundImage !== 'none' ? sqs.backgroundImage : sqs.backgroundColor,
      };
    }),
  );
}

const WHITE = 'rgb(255, 255, 255)';
const ON_ACCENT = 'rgb(8, 19, 13)';

for (const theme of ['light', 'dark'] as const) {
  test(`L1(${theme}): the rocket is white, not the CTA ink`, async ({ page }) => {
    await page.goto(HOME);
    await expect(page.locator('[data-testid="wathba-logo-mark"]').first()).toBeVisible({
      timeout: 20000,
    });
    await setTheme(page, theme);

    const found = await marks(page);
    // Header lockup + footer lockup. If a lockup is ever dropped this count
    // catches it rather than the loop below silently passing on one element.
    expect(found.length, 'header and footer both carry the lockup').toBe(2);

    for (const m of found) {
      // Lucide paints BOTH: `fill` from the Icon wrapper's `fill` prop and
      // `stroke` from its own currentColor default. A fix that moved only one
      // leaves a black outline around a white body.
      expect(m.fill, `mark fill in ${theme}`).toBe(WHITE);
      expect(m.stroke, `mark stroke in ${theme}`).toBe(WHITE);
      expect(m.fill, 'the mark must not borrow --on-accent again').not.toBe(ON_ACCENT);
      // ...and it is still sitting on the green square, in this theme too. The
      // premise of a white mark is a green ground; if the square ever goes flat
      // or dark, white is the wrong answer and this should be revisited.
      expect(m.ground, `square ground in ${theme}`).toContain('gradient');
    }
  });
}

test('L2: --on-accent is UNCHANGED — the CTA contrast pass still holds', async ({ page }) => {
  await page.goto(HOME);
  await expect(page.locator('[data-testid="wathba-logo-mark"]').first()).toBeVisible({
    timeout: 20000,
  });

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);
    const t = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('[data-theme]') as HTMLElement);
      return {
        onAccent: cs.getPropertyValue('--on-accent').trim().toLowerCase(),
        logoMark: cs.getPropertyValue('--logo-mark').trim().toLowerCase(),
      };
    });
    expect(t.onAccent, `--on-accent must stay dark ink in ${theme}`).toBe('#08130d');
    expect(t.logoMark, `--logo-mark must be white in ${theme}`).toBe('#ffffff');
    expect(t.logoMark, 'the two tokens must stay separate').not.toBe(t.onAccent);
  }
});
