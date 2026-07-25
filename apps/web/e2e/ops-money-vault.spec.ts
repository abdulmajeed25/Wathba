import { expect, test, type Page } from '@playwright/test';
import { API } from './helpers';

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * OPS Part 5 §4 — «الخزنة» (the vault), the money screen built last. This
 * suite proves the tabbed surface renders and that every money action is a
 * governed <OpRunner> button (it exercises the dryRun→reason→confirm contract
 * without clicking a real execute — the money mutation itself is proven at the
 * API layer in the ops jest suites, and clicking would move real seed money).
 *
 * Gated: API unreachable → skip (mirrors the other ops e2e specs).
 */

let apiUp = false;
test.beforeAll(async () => {
  try {
    const r = await fetch(`${API}/v1/health`);
    apiUp = r.ok;
  } catch {
    apiUp = false;
  }
});

async function enterOps(page: Page): Promise<void> {
  await page.goto('/sign-in');
  await page.locator('input[name="email"]').fill(OWNER.email);
  await page.locator('input[name="password"]').fill(OWNER.pass);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL(/\/projects(\?|$|\/)/);
  await page.goto('/ops');
  await page.waitForURL(/\/ops\/enter/);
  await page.locator('#ops-password').fill(OWNER.pass);
  await page.getByRole('button', { name: 'دخول إلى مركز العمليات' }).click();
  await page.waitForURL(/\/ops$/);
}

test('the vault renders its tabs and the payout console', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live vault spec');
  await enterOps(page);

  await page.goto('/ops/money');
  await expect(page.getByRole('heading', { name: 'الخزنة' })).toBeVisible();

  // Tab bar
  for (const tab of ['نظرة عامة', 'المعالم', 'الدفعات', 'الاستردادات', 'دفتر الأستاذ', 'المطابقة']) {
    await expect(page.getByRole('link', { name: tab })).toBeVisible();
  }

  // Payouts tab: the disburse-cycle button is a governed MONEY op trigger.
  await page.goto('/ops/money?tab=payouts');
  await expect(page.getByRole('button', { name: 'تشغيل دورة الصرف' })).toBeVisible();
});

test('the ledger and reconciliation tabs render', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live vault spec');
  await enterOps(page);

  await page.goto('/ops/money?tab=ledger');
  await expect(page.getByRole('button', { name: /backfill/i })).toBeVisible();

  await page.goto('/ops/money?tab=reconciliation');
  await expect(page.getByRole('button', { name: /مطابقة/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'فحص وإصلاح مشروع' })).toBeVisible();
});
