import { expect, test } from '@playwright/test';
import { API, apiSignin, E2E_PASSWORD, signInUI, signUpAndVerify, uniqueEmail } from './helpers';

/** GOLDEN JOURNEY 3 — SUPPLIER (Sprint 4 / P1-007). */
test('supplier: signup → role grant → bid → my bids', async ({ page, context }) => {
  const email = uniqueEmail('supplier');
  await signUpAndVerify(page, 'مورد إي٢إي', email, '3234567890');

  const admin = await apiSignin('smoke-s1@test.wathba.sa', 'Str0ngPass!x');
  const meTok = await apiSignin(email, E2E_PASSWORD);
  const me = (await fetch(`${API}/v1/users/me`, {
    headers: { authorization: `Bearer ${meTok}` },
  }).then((r) => r.json())) as { id: string };
  const grant = await fetch(`${API}/v1/admin/users/${me.id}/grant-role`, {
    method: 'POST',
    headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'SUPPLIER', reason: 'اختبار آلي: منح دور مورد لرحلة المزادات' }),
  });
  expect(grant.ok).toBe(true);

  await context.clearCookies();
  await signInUI(page, email);

  await page.goto('/projects/supplier');
  await expect(page.getByText('المزاد العكسي للموردين')).toBeVisible();
  await page.getByRole('tab', { name: 'تقديم عرض' }).click();
  await page.locator('input[name="amount"]').fill('3800');
  await page.locator('input[name="leadTimeDays"]').fill('25');
  await page.locator('input[name="compliancePct"]').fill('95');
  await page.getByRole('button', { name: /أرسل العرض/ }).click();
  await expect(page.getByText('تم استلام عرضك')).toBeVisible({ timeout: 20_000 });
});
