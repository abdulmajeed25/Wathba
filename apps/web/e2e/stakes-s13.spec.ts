import { expect, test } from '@playwright/test';
import { seededIds } from './helpers';

/**
 * STAKES/S-13 — UX chrome:
 *  G7 styled RTL confirm dialog (covered inline in stakes-community K1)
 *  G5 maintenance surface + out-of-maintenance redirect
 *  F-07 footer stamp passes AA (verified via the axe gate battery too)
 */

test('G5: /maintenance redirects home when maintenance mode is OFF', async ({ page }) => {
  await page.goto('/maintenance');
  await expect(page).toHaveURL(/\/projects$/);
});

test('G7: report-project uses the styled RTL dialog and cancel is a no-op', async ({ page }) => {
  // Anonymous user on a real campaign — the report button gates via dialog first.
  const { projectId } = seededIds();
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('button', { name: /الإبلاغ عن المشروع|إبلاغ/ }).first().click();
  const dialog = page.getByRole('alertdialog', { name: 'الإبلاغ عن هذا المشروع؟' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'إلغاء' }).click();
  await expect(dialog).not.toBeVisible();
});

test('F-07: the footer version stamp is present and not opacity-faded', async ({ page }) => {
  await page.goto('/projects/about');
  const stamp = page.locator('footer').getByText(/^v\d+\.\d+\.\d+/);
  await expect(stamp).toBeVisible();
  const opacity = await stamp.evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(opacity)).toBe(1);
});
