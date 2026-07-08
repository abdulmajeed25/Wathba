import { expect, test } from '@playwright/test';
import { signUpAndVerify, uniqueEmail } from './helpers';

/**
 * STAKES/S-4 — user identity surface: the /u/[handle] public profile, the
 * settings identity fields (handle/bio/city), and the C10 linking rule
 * (the account menu's name links to the public profile).
 */
test('identity surface: edit profile in settings → public /u/[handle] page renders it', async ({ page }) => {
  const email = uniqueEmail('identity');
  await signUpAndVerify(page, 'هند المطيري', email, '3344556677');

  // The handle was auto-minted from the email local-part at signup.
  const expectedHandle = email.split('@')[0]!.replace(/[^a-z0-9_.-]/g, '');

  // Settings → profile tab carries the new identity fields; set bio + city.
  await page.goto('/projects/settings');
  const handleInput = page.locator('input[name="handle"]');
  await expect(handleInput).toHaveValue(expectedHandle);
  await page.locator('textarea[name="bioAr"]').fill('داعمة للمشاريع الإبداعية في الرياض');
  await page.locator('input[name="city"]').fill('الرياض');
  await page.getByRole('button', { name: 'حفظ التغييرات' }).click();
  await expect(page).toHaveURL(/ok=profile/);

  // Public profile page renders name, @handle, bio, city, and the stats row.
  await page.goto(`/u/${expectedHandle}`);
  await expect(page.getByRole('heading', { name: 'هند المطيري' })).toBeVisible();
  await expect(page.getByText(`@${expectedHandle}`, { exact: true })).toBeVisible();
  await expect(page.getByText('داعمة للمشاريع الإبداعية في الرياض')).toBeVisible();
  await expect(page.getByText('الرياض').first()).toBeVisible();
  await expect(page.getByText('مشاريع دعمها')).toBeVisible();
  await expect(page.getByText('متابِعون')).toBeVisible();
  // Self-view shows the edit affordance, not a follow button.
  await expect(page.getByRole('link', { name: /تعديل ملفي/ })).toBeVisible();

  // C10 — the account-menu header name links to the public profile.
  await page.goto('/projects');
  await page.locator('button[aria-label^="حساب"]').click();
  await expect(page.getByRole('menuitem', { name: 'ملفي العام' })).toBeVisible();

  // Unknown handle → 404 page.
  const res = await page.goto('/u/no-such-handle-xyz-404');
  expect(res?.status()).toBe(404);
});
