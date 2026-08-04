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

  // The DEFAULT selection is deliberately trusted here.
  //
  // It used to be wrong: the list sorts by dueDate ascending, so the default was
  // the most overdue request, and this journey started failing the moment a
  // seeded RFQ aged past its dueDate mid-session — «rfq dueDate has passed».
  // The form now only offers biddable requests, so the default is sound, and
  // this test still fails loudly if that regresses. That is the point of
  // leaving it implicit.
  //
  // Pinning the seeded id with selectOption() was tried and reverted: this
  // component falls back to bundled fixtures when the live fetch returns
  // nothing, so the id is intermittently absent from the <select> and the step
  // spun for the full 60s test budget. It traded a real assertion for a flake.
  await page.locator('input[name="amount"]').fill('3800');
  await page.locator('input[name="leadTimeDays"]').fill('25');
  await page.locator('input[name="compliancePct"]').fill('95');
  await page.getByRole('button', { name: /أرسل العرض/ }).click();
  await expect(page.getByText('تم استلام عرضك')).toBeVisible({ timeout: 20_000 });
});
