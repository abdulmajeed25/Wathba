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

test('G7/W4: report-project opens the reason picker and Esc is a no-op', async ({ page }) => {
  // (The styled ConfirmDialog itself is covered by the K1 comment-delete walk.)
  const { projectId } = seededIds();
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('button', { name: /الإبلاغ عن هذا المشروع/ }).first().click();
  const dialog = page.getByRole('dialog', { name: 'سبب البلاغ' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('radio').first()).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('F-07: the footer version stamp is present and not opacity-faded', async ({ page }) => {
  await page.goto('/projects/about');
  const stamp = page.locator('footer').getByText(/^v\d+\.\d+\.\d+/);
  await expect(stamp).toBeVisible();
  const opacity = await stamp.evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(opacity)).toBe(1);
});
