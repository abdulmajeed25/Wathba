import { expect, test } from '@playwright/test';
import { signUpAndVerify, uniqueEmail } from './helpers';

const PASS = 'E2eStrongPass!7';
const NEW_PASS = 'BrandNewPass!42';

/**
 * STAKES/S-7 — settings depth: password change (E1+A12), notification prefs
 * persistence (E2), profile privacy (E3), PDPL export + typed-confirm
 * deletion (E4), and the trust pages (H1 H6 H7) + real footer socials (H5).
 */

test('security: password change works and the new password signs in', async ({ page, context }) => {
  const email = uniqueEmail('pwchange');
  await signUpAndVerify(page, 'سعود الحربي', email, '5566778899');

  await page.goto('/projects/settings');
  await page.getByRole('tab', { name: 'الأمان' }).click();
  await page.locator('input[name="currentPassword"]').first().fill(PASS);
  await page.locator('input[name="newPassword"]').fill(NEW_PASS);
  await page.locator('input[name="confirm"]').fill(NEW_PASS);
  await page.getByRole('button', { name: 'حفظ كلمة المرور' }).click();
  // Two bcrypt-12 hashes + full session revocation ride this action — under
  // full-suite parallel load it can exceed the 5s default (the one flake in
  // the 40+-test runs). Generous explicit timeout, same assertions.
  await expect(page).toHaveURL(/ok=password/, { timeout: 30_000 });
  await expect(page.getByText('تم تغيير كلمة المرور')).toBeVisible();

  // Old sessions are revoked server-side; sign in fresh with the NEW password.
  await context.clearCookies();
  await page.goto('/sign-in');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(NEW_PASS);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL(/\/projects(\?|$|\/)/);
});

test('prefs + privacy: toggles persist and a private profile 404s', async ({ page }) => {
  const email = uniqueEmail('prefs');
  await signUpAndVerify(page, 'ريم الدوسري', email, '6677889900');
  const handle = email.split('@')[0]!.replace(/[^a-z0-9_.-]/g, '');

  // E2 — flip off project updates, save, verify persistence after reload.
  await page.goto('/projects/settings');
  await page.getByRole('tab', { name: 'الإشعارات' }).click();
  const updatesSwitch = page.getByRole('switch', { name: 'تحديثات المشاريع المدعومة' });
  await expect(updatesSwitch).toHaveAttribute('aria-checked', 'true');
  await updatesSwitch.click();
  await page.getByRole('button', { name: 'حفظ التفضيلات' }).click();
  await expect(page).toHaveURL(/ok=notifs/);
  await page.goto('/projects/settings');
  await page.getByRole('tab', { name: 'الإشعارات' }).click();
  await expect(
    page.getByRole('switch', { name: 'تحديثات المشاريع المدعومة' }),
  ).toHaveAttribute('aria-checked', 'false');

  // E3 — public profile visible, then hidden after the privacy toggle.
  const before = await page.request.get(`/u/${handle}`);
  expect(before.status()).toBe(200);
  await page.getByRole('tab', { name: 'الخصوصية' }).click();
  await page.getByRole('switch', { name: 'ملفي العام ظاهر' }).click();
  await page.getByRole('button', { name: 'حفظ الخصوصية' }).click();
  await expect(page).toHaveURL(/ok=privacy/);
  const after = await page.request.get(`/u/${handle}`);
  expect(after.status()).toBe(404);

  // E4 — PDPL export downloads the JSON from the same session.
  const exportRes = await page.request.get('/api/me/export');
  expect(exportRes.status()).toBe(200);
  expect(exportRes.headers()['content-disposition'] ?? '').toContain('wathba-data-export.json');
  const body = (await exportRes.json()) as { profile?: { email?: string } };
  expect(JSON.stringify(body)).toContain(email);
});

test('PDPL deletion: typed confirm gates the button, then the account dies', async ({ page }) => {
  const email = uniqueEmail('erase');
  await signUpAndVerify(page, 'مستخدم مؤقت', email, '7788990011');

  await page.goto('/projects/settings');
  await page.getByRole('tab', { name: 'الخصوصية' }).click();
  const deleteBtn = page.getByRole('button', { name: 'احذف حسابي نهائياً' });
  await expect(deleteBtn).toBeDisabled();
  await page.locator('input[name="confirmPhrase"]').fill('حذف حسابي');
  await expect(deleteBtn).toBeEnabled();
  await deleteBtn.click();
  // deleteAccountAction redirects to '/', which itself bounces to /projects.
  // Match the exact landing pathname — a loose /projects regex also matches
  // the /projects/settings page we're still on and races the deletion.
  await page.waitForURL((url) => url.pathname === '/projects');

  // Session is gone and the account can no longer sign in.
  const me = await page.request.get('/api/me');
  expect(me.status()).toBe(401);
});

test('trust pages render and footer socials are real links (H1 H5 H6 H7)', async ({ page }) => {
  await page.goto('/projects/about');
  await expect(page.getByRole('heading', { name: 'عن وثبة' }).first()).toBeVisible();
  await page.goto('/projects/pricing');
  await expect(page.getByText('عمولة المنصة: ٥٪ من التمويل المُحصَّل')).toBeVisible();
  await page.goto('/projects/handbook');
  await expect(page.getByRole('heading', { name: 'دليل الناشر' }).first()).toBeVisible();

  // H5 — the footer social tiles are anchors with real destinations.
  const x = page.locator('footer a[aria-label="X"]');
  await expect(x).toHaveAttribute('href', /x\.com/);
  await expect(page.locator('footer a[aria-label="إنستغرام"]')).toHaveAttribute('href', /instagram\.com/);
  // Footer links to the new trust pages.
  await expect(page.locator('footer a[href="/projects/pricing"]')).toBeVisible();
});
