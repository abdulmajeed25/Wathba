import { expect, test, type Page } from '@playwright/test';
import { API } from './helpers';

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * OPS Part 5 — the COMMAND-CENTER home «الرئيسية — مركز القيادة» + «القياس
 * والتقارير». Both are server-first pages over /v1/ops/dashboard. This suite
 * proves the morning board renders its work-queue cards and platform-vitals
 * tiles with Arabic labels, and that the analytics surface renders without a
 * server error.
 *
 * Gated: needs the live stack (web build + API + seed). API unreachable → skip
 * (mirrors the health-ping guard in ops-kit.spec.ts / the other ops specs).
 */

let apiUp = false;
test.beforeAll(async () => {
  try {
    const r = await fetch(`${API}/health`);
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

test('the command center renders the work-queue cards and platform vitals', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live command-center spec');
  await enterOps(page);

  await expect(page.getByRole('heading', { name: 'الرئيسية — مركز القيادة' })).toBeVisible();

  // Work-queue cards (each links to the screen that clears it).
  await expect(page.getByRole('heading', { name: 'قوائم العمل' })).toBeVisible();
  for (const title of [
    'مشاريع قيد المراجعة',
    'مراحل مُقدَّمة للأدلة',
    'مدفوعات مستحقة',
    'بلاغات مفتوحة',
    'تعهدات معرّضة للسحب',
    'تذاكر دعم مفتوحة',
  ]) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
  await expect(page.locator('a[href="/ops/review"]').first()).toBeVisible();
  await expect(page.locator('a[href="/ops/money"]').first()).toBeVisible();

  // Platform-vitals tiles.
  await expect(page.getByRole('heading', { name: 'المؤشرات الحيوية للمنصّة' })).toBeVisible();
  for (const label of [
    'المستخدمون',
    'إجمالي المبيعات (GMV)',
    'التزام المدفوعات المعلّقة',
    'التعهدات المستردّة',
  ]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
});

test('«القياس والتقارير» renders without a server error', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live command-center spec');
  await enterOps(page);

  const res = await page.goto('/ops/analytics');
  expect(res?.status() ?? 0).toBeLessThan(500);
  await page.waitForURL(/\/ops\/analytics/);

  await expect(page.getByRole('heading', { name: 'القياس والتقارير' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'المؤشرات الحيوية' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'نسب مشتقّة' })).toBeVisible();
  // The honesty rail: gaps are labelled, not fabricated.
  await expect(page.getByRole('heading', { name: 'مؤشرات بانتظار واجهة تجميع' })).toBeVisible();
});
