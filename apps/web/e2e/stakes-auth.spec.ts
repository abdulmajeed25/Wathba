import { expect, test } from '@playwright/test';
import { API, uniqueEmail, verificationLinkFor } from './helpers';

const PASS = 'E2eStrongPass!7';

/**
 * STAKES/S-5 — auth UX polish: strength meter + show/hide (A2 A3), deep-link
 * preservation through Nafath (A15), signed-in redirect away from auth pages
 * (A16), and the Arabic lockout countdown (A9/P2).
 */

test('signup form: strength meter + show/hide toggle, then ?next survives the Nafath hop', async ({ page }) => {
  const email = uniqueEmail('authux');
  const target = '/projects/me/pledges';

  await page.goto(`/sign-up?next=${encodeURIComponent(target)}`);

  // A3 — show/hide toggle flips the input type.
  const pw = page.locator('input[name="password"]');
  await pw.fill('weakpass'); // 8 lowercase chars → score 1 (ضعيفة)
  await expect(pw).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'إظهار كلمة المرور' }).click();
  await expect(pw).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'إخفاء كلمة المرور' }).click();
  await expect(pw).toHaveAttribute('type', 'password');

  // A2 — meter reacts as the password strengthens.
  await expect(page.getByText('ضعيفة', { exact: true })).toBeVisible();
  await pw.fill(PASS);
  await expect(page.getByText('قوية', { exact: true })).toBeVisible();

  // A1 — live email validation fires on blur, before any submit.
  const emailInput = page.locator('input[name="email"]');
  await emailInput.fill('not-an-email');
  await emailInput.blur();
  await expect(page.getByText('صيغة البريد الإلكتروني غير صحيحة.')).toBeVisible();
  await emailInput.fill(email);

  // A15 + S-12 F-11 — the deep-link target must now ride sign-up → the
  // verification EMAIL → nafath → target (the session is minted by the link).
  await page.locator('input[name="name"]').fill('نورة السالم');
  await page.locator('input[name="acceptTerms"]').check();
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click();
  await expect(page).toHaveURL(/verify-email\?sent=1/);
  const link = await verificationLinkFor(email);
  expect(link).toContain(`next=${encodeURIComponent(target)}`);
  await page.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await page.getByRole('button', { name: 'فعّل حسابي' }).click();
  await expect(page).toHaveURL(new RegExp(`sign-up/nafath\\?next=${encodeURIComponent(target).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  await page.locator('input[name="nationalId"]').fill('4455667788');
  await page.getByRole('button', { name: 'أرسل طلب التحقق' }).click();
  await expect(page).toHaveURL(new RegExp(`${target}$`));

  // A16 — signed-in users bounce off the auth pages.
  await page.goto('/sign-in');
  await expect(page).not.toHaveURL(/sign-in/);
  await page.goto('/sign-up');
  await expect(page).not.toHaveURL(/sign-up/);
  await page.goto('/forgot-password');
  await expect(page).toHaveURL(/projects\/settings/);
});

test('lockout surfaces a human Arabic countdown, not a raw 429 (A9/P2)', async ({ page, request }) => {
  const email = uniqueEmail('lockout');
  // Burn the 5-failure budget straight against the API (per-email counter).
  for (let i = 0; i < 5; i++) {
    await request.post(`${API}/v1/auth/signin`, {
      data: { email, password: 'WrongPass!123' },
    });
  }
  // 6th attempt through the UI → locked message with remaining time.
  await page.goto('/sign-in');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill('WrongPass!123');
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(page).toHaveURL(/err=locked/);
  await expect(page.getByText(/محاولات دخول كثيرة — حاول بعد/)).toBeVisible();
});
