import { expect, test, type Page } from '@playwright/test';
import { API } from './helpers';

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * OPS Part 5 (CONTENT) — the three content screens (categories / editorial /
 * collections) against the LIVE stack. Each proves the screen renders
 * server-first with its create/edit affordances present.
 *
 * Gated: the whole suite needs the live stack (web build + API + seed). If the
 * API is unreachable we skip rather than fail (mirrors the other ops specs).
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

test('«الفئات» renders the tree editor with a create affordance', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-content spec');
  await enterOps(page);

  await page.getByRole('link', { name: 'الفئات' }).click();
  await page.waitForURL(/\/ops\/categories/);
  await expect(page.getByRole('heading', { name: 'إنشاء فئة' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'إنشاء الفئة' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'الشجرة الحالية' })).toBeVisible();
});

test('«المحتوى التحريري» renders the compose form + sections', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-content spec');
  await enterOps(page);

  await page.getByRole('link', { name: 'التحرير' }).click();
  await page.waitForURL(/\/ops\/editorial/);
  await expect(page.getByRole('heading', { name: 'تأليف بطاقة جديدة' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'إنشاء البطاقة' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'أقسام الرئيسية' })).toBeVisible();
});

test('«المجموعات» renders the create form + campaign list', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-content spec');
  await enterOps(page);

  await page.getByRole('link', { name: 'المجموعات' }).click();
  await page.waitForURL(/\/ops\/collections/);
  await expect(page.getByRole('heading', { name: 'إنشاء حملة وثبة' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'إنشاء الحملة' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'الحملات الحالية' })).toBeVisible();
});
