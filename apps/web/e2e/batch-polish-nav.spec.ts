import { expect, test } from '@playwright/test';

/**
 * Batch POLISH Unit 1 — navigation dedup.
 *
 *  P1 the nav carries «اكتشف» exactly once, «تحت الأضواء» exactly once
 *  P2 «اكتشف» is a DIRECT link: no menu opens, and it navigates to discover-all
 *  P3 «تحت الأضواء» opens a menu on click and reaches /spotlight
 *  P4 the menu does NOT open on hover, and does not vanish while the pointer
 *     travels to it — the bug this unit exists to kill
 *  P5 keyboard: both entries reachable, Esc closes the menu and restores focus
 *  P6 the retired identity-framed rail is gone from the nav
 */

const NAV = 'nav.wathba-desk-only';

test('P1: exactly one «اكتشف» and one «تحت الأضواء» in the nav', async ({ page }) => {
  await page.goto('/projects');
  const nav = page.locator(NAV);
  await expect(nav).toBeVisible();

  // Exact-match so «اكتشف المشاريع» body CTAs elsewhere can't satisfy this.
  await expect(nav.getByRole('link', { name: 'اكتشف', exact: true })).toHaveCount(1);
  await expect(nav.getByRole('button', { name: /تحت الأضواء/ })).toHaveCount(1);
});

test('P2: «اكتشف» is a direct link — no dropdown, goes to discover-all', async ({ page }) => {
  await page.goto('/projects');
  const discover = page.locator(NAV).getByRole('link', { name: 'اكتشف', exact: true });

  // A destination, not a disclosure: no popup semantics at all.
  await expect(discover).not.toHaveAttribute('aria-haspopup', /.*/);
  await expect(discover).toHaveAttribute('href', '/projects/discover-all');

  await discover.click();
  await expect(page).toHaveURL(/\/projects\/discover-all$/);
});

test('P3: «تحت الأضواء» opens a menu and reaches /spotlight', async ({ page }) => {
  await page.goto('/projects');
  const trigger = page.locator(NAV).getByRole('button', { name: /تحت الأضواء/ });

  await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const menu = page.getByRole('menu', { name: 'تحت الأضواء' });
  await expect(menu).toBeVisible();

  await menu.getByRole('menuitem', { name: /اذهب إلى تحت الأضواء/ }).click();
  await expect(page).toHaveURL(/\/spotlight$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('P4: the menu does not open on hover, and survives the trip to it', async ({ page }) => {
  await page.goto('/projects');
  const trigger = page.locator(NAV).getByRole('button', { name: /تحت الأضواء/ });

  // Hover-open is gone: that interaction model is what made the old panel
  // disappear as the pointer approached it (and never worked on touch).
  await trigger.hover();
  await page.waitForTimeout(400);
  await expect(page.getByRole('menu', { name: 'تحت الأضواء' })).toHaveCount(0);

  // Opened by click, the panel must still be there after the pointer moves
  // across the gap onto it — the old 120ms mouseleave timer closed it mid-trip.
  await trigger.click();
  const menu = page.getByRole('menu', { name: 'تحت الأضواء' });
  await expect(menu).toBeVisible();
  const item = menu.getByRole('menuitem').first();
  await item.hover();
  await page.waitForTimeout(400);
  await expect(menu).toBeVisible();
});

test('P5: keyboard — menu opens, Esc closes it and restores focus', async ({ page }) => {
  await page.goto('/projects');
  const trigger = page.locator(NAV).getByRole('button', { name: /تحت الأضواء/ });

  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu', { name: 'تحت الأضواء' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu', { name: 'تحت الأضواء' })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('P6: the identity-framed rail is gone from the nav and the hero', async ({ page }) => {
  await page.goto('/projects');
  const trigger = page.locator(NAV).getByRole('button', { name: /تحت الأضواء/ });
  await trigger.click();
  await expect(page.getByRole('menu', { name: 'تحت الأضواء' })).toBeVisible();

  // Curation selects on the work, never on who made it.
  await expect(page.getByText('مبدعات سعوديات')).toHaveCount(0);
});
