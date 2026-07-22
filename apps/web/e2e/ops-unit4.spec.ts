import { expect, test } from '@playwright/test';
import { API } from './helpers';

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * OPS-360 Unit 4 — the last UNCOVERED domains: the notifications inspector,
 * cross-project contest oversight, and the reward-fulfillment roster, plus the
 * two new project-workspace tabs (collaborators + FAQ). Every screen is
 * read-only observability; each degrades to an amber "قيد الإنشاء" note if its
 * (Unit-4 backend) endpoint is not yet live, so the assertions accept EITHER
 * the populated UI or that note.
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

test('the notifications inspector renders stats + a per-user lookup form', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-unit4 spec');
  await enterOps(page);
  await page.goto('/ops/notifications');

  await expect(page.getByRole('heading', { name: 'الإشعارات', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'بحث الإشعارات لكل مستخدم' })).toBeVisible();
  // The lookup form submit button exists (server-first GET form).
  await expect(page.getByRole('button', { name: 'عرض' })).toBeVisible();
  // No fabricated resend button — the read-only note is present instead.
  await expect(page.getByText(/إعادة إرسال/)).toBeVisible();
});

test('the contests oversight list renders filters + table (or the قيد الإنشاء note)', async ({
  page,
}) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-unit4 spec');
  await enterOps(page);
  await page.goto('/ops/contests');

  await expect(page.getByRole('heading', { name: 'المسابقات', level: 1 })).toBeVisible();
  const table = page.getByRole('columnheader', { name: 'المشروع' });
  const building = page.getByText('قيد الإنشاء').first();
  await expect(table.or(building).first()).toBeVisible();
});

test('the fulfillment roster renders the status filter + table (or the note)', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-unit4 spec');
  await enterOps(page);
  await page.goto('/ops/fulfillment');

  await expect(page.getByRole('heading', { name: 'تسليم المكافآت', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'تصفية' })).toBeVisible();
  const table = page.getByRole('columnheader', { name: 'حالة التسليم' });
  const building = page.getByText('قيد الإنشاء').first();
  await expect(table.or(building).first()).toBeVisible();
});

test('the project workspace exposes the new collaborators + FAQ tabs', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-unit4 spec');
  await enterOps(page);

  await page.goto('/ops/projects');
  const firstLink = page.locator('tbody a[href^="/ops/projects/"]').first();
  test.skip((await firstLink.count()) === 0, 'no projects seeded — skipping tab assertion');
  await firstLink.click();
  await page.waitForURL(/\/ops\/projects\/[^/]+/);

  await expect(page.getByRole('link', { name: 'المتعاونون' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'الأسئلة الشائعة' })).toBeVisible();

  await page.getByRole('link', { name: 'المتعاونون' }).click();
  await page.waitForURL(/tab=collaborators/);
});
