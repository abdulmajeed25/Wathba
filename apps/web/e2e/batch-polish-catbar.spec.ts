import { expect, test } from '@playwright/test';

/**
 * Batch POLISH Unit 3 — the category strip.
 *
 * A visual pass, so these tests guard the things a redesign silently breaks:
 * the behaviour contract other specs rely on, the non-colour active state WCAG
 * 1.4.1 requires, and the promise that showing a scroll affordance costs no
 * layout shift.
 */

const STRIP = '[data-cat-nav-ready="1"]';

test('C1: behaviour is unchanged — roles, slugs and the mega-menu still work', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.locator(STRIP)).toBeAttached({ timeout: 20000 });

  const strip = page.locator(STRIP);
  await expect(strip).toHaveAttribute('role', 'menubar');
  await expect(strip).toHaveAttribute('aria-label', 'فئات المشاريع');

  // The contract category-discovery.spec.ts drives.
  const tech = page.locator('button[role="menuitem"][data-cat-slug="technology"]');
  await expect(tech).toBeVisible({ timeout: 15000 });
  await expect(tech).toHaveAttribute('aria-haspopup', 'true');
  await expect(tech).toHaveAttribute('aria-expanded', 'false');

  await tech.click();
  await expect(tech).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#wathba-megamenu')).toBeVisible();
});

test('C2: the raw scrollbar is gone but the strip still scrolls', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.locator(STRIP)).toBeAttached({ timeout: 20000 });

  // Typed as HTMLElement, not the default SVGElement | HTMLElement: offsetHeight
  // below exists only on the HTML side of that union, and the strip is a div.
  // Nothing caught this before because e2e was never typechecked at all.
  const state = await page.locator(STRIP).evaluate((el: HTMLElement) => {
    const cs = getComputedStyle(el);
    return {
      scrollbarWidth: cs.scrollbarWidth,
      overflowX: cs.overflowX,
      scrollable: el.scrollWidth > el.clientWidth,
      // The scrollbar must be hidden without stealing scrollability: a strip
      // that cannot scroll is worse than an ugly scrollbar.
      trackHeight: el.offsetHeight - el.clientHeight,
    };
  });

  expect(state.overflowX).toBe('auto');
  expect(state.scrollbarWidth, 'the raw scrollbar should be hidden').toBe('none');
  expect(state.trackHeight, 'no scrollbar track should occupy layout').toBeLessThanOrEqual(1);
});

test('C3: the current category is marked by more than colour (WCAG 1.4.1)', async ({ page }) => {
  await page.goto('/projects/discover/technology');
  await expect(page.locator(STRIP)).toBeAttached({ timeout: 20000 });

  const pill = page.locator('button[data-cat-slug="technology"]');
  await expect(pill).toBeVisible({ timeout: 15000 });
  await expect(pill).toHaveAttribute('aria-current', 'page');

  const cues = await pill.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      weight: Number(cs.fontWeight),
      borderColor: cs.borderColor,
      borderWidth: cs.borderTopWidth,
      // The leading dot.
      hasIndicator: el.querySelector('span[aria-hidden]') !== null,
    };
  });

  // Three independent, non-colour cues: weight, a ring, and an indicator dot.
  expect(cues.weight, 'the current pill should be visibly heavier').toBeGreaterThanOrEqual(700);
  expect(cues.hasIndicator, 'the current pill should carry an indicator dot').toBe(true);
  expect(parseFloat(cues.borderWidth), 'the current pill should carry a ring').toBeGreaterThan(0);

  // And a sibling must NOT claim any of them.
  const other = page.locator('button[data-cat-slug]:not([aria-current="page"])').first();
  const otherWeight = await other.evaluate((el) => Number(getComputedStyle(el).fontWeight));
  expect(otherWeight).toBeLessThan(cues.weight);
});

test('C4: the strip reserves its height, so the bar never shifts layout', async ({ page }) => {
  // The loading placeholder and the loaded strip come from one constant. If they
  // ever diverge, the bar pushes the whole page down on first paint — which is
  // the class of bug that made the homepage CLS bad in the first place.
  await page.goto('/projects');
  await expect(page.locator(STRIP)).toBeAttached({ timeout: 20000 });

  const h = await page.locator(STRIP).evaluate((el) => el.getBoundingClientRect().height);
  expect(h).toBeGreaterThan(40);
  expect(h).toBeLessThan(60);
});

test('C5: arrow affordances are decorative — keyboard nav is the real path', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.locator(STRIP)).toBeAttached({ timeout: 20000 });

  // Arrows, when present, must not be in the tab order or announced: they
  // duplicate what arrow keys and swipe already do.
  const arrows = page.locator('.wathba-cat-arrow');
  for (let i = 0; i < (await arrows.count()); i++) {
    await expect(arrows.nth(i)).toHaveAttribute('aria-hidden', 'true');
    await expect(arrows.nth(i)).toHaveAttribute('tabindex', '-1');
  }

  // Roving tabindex: exactly one pill is tabbable, the rest are reached with
  // arrow keys.
  const tabbable = await page.locator('button[data-cat-slug][tabindex="0"]').count();
  expect(tabbable).toBe(1);

  const first = page.locator('button[data-cat-slug]').first();
  await first.focus();
  await page.keyboard.press('ArrowLeft'); // RTL: next along the strip
  const moved = await page.evaluate(() => document.activeElement?.getAttribute('data-cat-slug'));
  const firstSlug = await first.getAttribute('data-cat-slug');
  expect(moved, 'arrow keys should move focus along the strip').not.toBe(firstSlug);
});
