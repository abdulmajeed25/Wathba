import { expect, test } from '@playwright/test';
import { signUpAndVerify, uniqueEmail } from './helpers';

/**
 * STAKES/S-1 — the access & role bug that triggered the audit: a plain BACKER
 * must be kept out of the creator dashboard, admin, and supplier areas (hard
 * middleware redirect), and the signed-in header must show the account menu
 * (with logout), not the signed-out CTAs.
 */
test('plain backer is kept out of gated areas and sees the account menu + logout', async ({ page }) => {
  // Fresh account = BACKER role, zero created projects.
  await signUpAndVerify(page, 'مستخدم أركان', uniqueEmail('stakes'), '2255667788');

  // B2 — creator dashboard → the explicit become-a-creator flow (start → submit).
  await page.goto('/projects/dashboard');
  await expect(page).toHaveURL(/\/projects\/(start|submit)/);

  // B5 — admin → home.
  await page.goto('/projects/admin');
  await expect(page).toHaveURL(/\/projects(\?|$)/);

  // B6 — supplier → home.
  await page.goto('/projects/supplier');
  await expect(page).toHaveURL(/\/projects(\?|$)/);

  // D2 + A13 — signed-in header shows the avatar account menu with logout.
  await page.goto('/projects');
  const avatar = page.locator('button[aria-label^="حساب"]');
  await expect(avatar).toBeVisible();
  await avatar.click();
  await expect(page.getByRole('menuitem', { name: 'تسجيل الخروج' })).toBeVisible();
});
