import { expect, test } from '@playwright/test';
import { signUpAndVerify, uniqueEmail } from './helpers';

/** GOLDEN JOURNEY 2 — CREATOR (Sprint 4 / P1-007): wizard + review card + KYC gate. */
test('creator: signup → wizard → review card → submit → dashboard', async ({ page }) => {
  await signUpAndVerify(page, 'مبدع إي٢إي', uniqueEmail('creator'), '2234567890');

  await page.goto('/projects/submit');
  const title = `مشروع إي٢إي ${Date.now()}`;
  await page.locator('input[name="titleAr"]').fill(title);
  await page.locator('textarea[name="shortDescAr"]').fill('وصف قصير لمشروع الاختبار الآلي عبر بلايرايت');
  await page.getByRole('button', { name: 'التالي →' }).click();
  await page.locator('textarea[name="storyAr"]').fill('قصة المشروع للاختبار الآلي. '.repeat(12));
  await page.getByRole('button', { name: 'التالي →' }).click();
  await page.locator('input[name="fundingGoalSar"]').fill('5000');
  await page.getByRole('button', { name: 'التالي →' }).click();
  await page.getByRole('button', { name: 'التالي →' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  // Server-action submit → redirect to the creator dashboard. Kick the click
  // off without awaiting (it detaches on nav) and wait on the URL instead.
  const landed = page.waitForURL('**/projects/dashboard/**', { timeout: 40_000 });
  void page.getByRole('button', { name: 'إرسال للمراجعة' }).click().catch(() => undefined);
  await landed;
  expect(page.url()).toContain('/projects/dashboard/');
});
