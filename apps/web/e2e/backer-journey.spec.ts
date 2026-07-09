import { expect, test } from '@playwright/test';
import { seededIds, signUpAndVerify, uniqueEmail } from './helpers';

/** GOLDEN JOURNEY 1 — BACKER (Sprint 4 / P1-007). */
test('backer: signup → pledge → success → my pledges', async ({ page }) => {
  await signUpAndVerify(page, 'داعم إي٢إي', uniqueEmail('backer'), '1234567890');

  const { projectId } = seededIds();
  await page.goto(`/projects/${projectId}/back`);
  await expect(page.getByText('ادعم:')).toBeVisible();
  await page.getByRole('button', { name: 'متابعة' }).click();
  await page.getByRole('button', { name: 'متابعة' }).click();
  await page.getByLabel('رقم البطاقة').fill('4111 1111 1111 1111');
  await page.locator('input[value=""]').first();
  await page.getByText('الاسم على البطاقة').locator('..').locator('input').fill('E2E BACKER');
  await page.getByText('تاريخ الانتهاء').locator('..').locator('input').fill('12/28');
  await page.getByText('CVC', { exact: true }).locator('..').locator('input').fill('123');
  await page.getByRole('button', { name: 'تأكيد الدعم' }).click();

  await page.waitForURL(/\/back\/success/, { timeout: 30_000 });
  await expect(page.getByText('شكراً لدعمك!')).toBeVisible();

  // STAKES/S-10 F-04 (I3) — the success screen carries the share block.
  await expect(page.getByRole('group', { name: 'شارك دعمك' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'واتساب' })).toBeVisible();

  await page.goto('/projects/me/pledges');
  await expect(page.getByText('مشاريع دعمتُها')).toBeVisible();
  await expect(page.getByText('محجوز · بانتظار النجاح').first()).toBeVisible();
});
