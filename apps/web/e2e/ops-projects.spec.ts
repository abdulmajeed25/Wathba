import { expect, test } from '@playwright/test';
import { API } from './helpers';

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * OPS Phase 2 — PROJECTS + REVIEW-QUEUE screens. Proves:
 *  1. /ops/projects renders the list table (filters + columns).
 *  2. /ops/review renders the review workspace (pending cards or empty state).
 *  3. A project detail workspace renders its tabs + operations panel.
 *
 * Gated: needs the live stack (web build + API + seed). Unreachable API skips.
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

async function enterOps(page: import('@playwright/test').Page): Promise<void> {
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

test('the projects list renders the table + filters', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-projects spec');
  await enterOps(page);
  await page.goto('/ops/projects');

  await expect(page.getByRole('heading', { name: 'المشاريع', level: 1 })).toBeVisible();
  // Filter form + submit.
  await expect(page.getByRole('button', { name: 'تصفية' })).toBeVisible();
  // Table header columns.
  await expect(page.getByRole('columnheader', { name: 'المشروع' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'الحالة' })).toBeVisible();
  // Unit-3: the sortable open-reports column + the CSV export power feature.
  await expect(page.getByRole('columnheader', { name: /بلاغات مفتوحة/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'تصدير CSV' })).toBeVisible();
});

test('the review queue renders the workspace', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-projects spec');
  await enterOps(page);
  await page.goto('/ops/review');

  await expect(page.getByRole('heading', { name: 'طابور المراجعة', level: 1 })).toBeVisible();
  // Either pending review cards (checklist legend) or the empty-queue banner.
  const checklist = page.getByText('قائمة الفحص (تحقّق يدوي)').first();
  const empty = page.getByText('الطابور فارغ — لا مشاريع بانتظار المراجعة');
  await expect(checklist.or(empty).first()).toBeVisible();
});

test('a project detail workspace renders tabs + operations panel', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-projects spec');
  await enterOps(page);

  // Reach a project id from the list (first title link), if any.
  await page.goto('/ops/projects');
  const firstLink = page.locator('tbody a[href^="/ops/projects/"]').first();
  test.skip((await firstLink.count()) === 0, 'no projects seeded — skipping detail assertion');

  await firstLink.click();
  await page.waitForURL(/\/ops\/projects\/[^/]+/);

  // Tabs present.
  await expect(page.getByRole('link', { name: 'نظرة عامة' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'العمليات' })).toBeVisible();

  // Operations panel exposes governed runners.
  await page.getByRole('link', { name: 'العمليات' }).click();
  await page.waitForURL(/tab=operations/);
  await expect(page.getByText('التمييز والتنسيق')).toBeVisible();
});

test('the project workspace surfaces the Unit-3 content sub-resources', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-projects spec');
  await enterOps(page);

  await page.goto('/ops/projects');
  const firstLink = page.locator('tbody a[href^="/ops/projects/"]').first();
  test.skip((await firstLink.count()) === 0, 'no projects seeded — skipping sub-resource assertion');
  await firstLink.click();
  await page.waitForURL(/\/ops\/projects\/[^/]+/);

  // The new content tabs are present.
  await expect(page.getByRole('link', { name: 'التحديثات' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'التعليقات' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'المكافآت والإضافات' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'سجل الإنفاق' })).toBeVisible();

  // The full backer roster tab exports CSV (replacing the "last 20").
  await page.getByRole('link', { name: 'الداعمون' }).click();
  await page.waitForURL(/tab=backers/);
  await expect(page.getByRole('button', { name: 'تصدير CSV' })).toBeVisible();

  // The catalog tab shows the reward tiers + add-ons sections.
  await page.getByRole('link', { name: 'المكافآت والإضافات' }).click();
  await page.waitForURL(/tab=catalog/);
  await expect(page.getByRole('heading', { name: 'مستويات المكافآت' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'الإضافات' })).toBeVisible();
});
