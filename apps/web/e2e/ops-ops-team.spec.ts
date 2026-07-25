import { expect, test, type Page } from '@playwright/test';
import { API } from './helpers';

/**
 * OPS Phase 2 — the SUPPLIERS + SUPPORT + SETTINGS + TEAM screens render
 * against the live stack. Gated: the whole suite needs the golden stack (web
 * build + API + seed); if the API is unreachable we skip rather than fail
 * (mirrors ops-kit.spec's health-ping guard).
 *
 * These are RENDER gates — they prove each server screen fetches + paints its
 * core surface (verification queue, tickets, catalog form, role matrix); the
 * governed mutations themselves are covered by the API operation specs.
 */

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

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

test('suppliers renders the verification queue + RFQ oversight', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops screen spec');
  await enterOps(page);
  await page.goto('/ops/suppliers');
  await expect(page.getByRole('heading', { name: 'الموردون والمزادات' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'طابور توثيق الموردين' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'الإشراف على طلبات عروض الأسعار' }),
  ).toBeVisible();
});

test('support renders the tickets inbox with filters + cross-page stat tiles', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops screen spec');
  await enterOps(page);
  await page.goto('/ops/support');
  await expect(page.getByRole('heading', { name: 'الدعم' })).toBeVisible();
  // The status filter (part of the FilterForm) is always present.
  await expect(page.locator('select[name="status"]')).toBeVisible();
  // Unit 3: tiles now read the cross-page tickets/stats total, not a page-local
  // ≤50 count.
  await expect(page.getByText(/الأعداد إجمالية عبر كل الصفحات/)).toBeVisible();
});

test('settings renders the catalog form + env-managed section', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops screen spec');
  await enterOps(page);
  await page.goto('/ops/settings');
  await expect(page.getByRole('heading', { name: 'الإعدادات' })).toBeVisible();
  // Every catalog key is labelled by its dotted key; the pledge floor always exists.
  await expect(page.getByText('pledges.minHalalas', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /إعدادات مملوكة للكود\/البيئة/ }),
  ).toBeVisible();
});

test('team renders the read-only role × permission matrix', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops screen spec');
  await enterOps(page);
  await page.goto('/ops/team');
  await expect(page.getByRole('heading', { name: 'فريق العمل والأدوار' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /مصفوفة الأدوار × الصلاحيات/ }),
  ).toBeVisible();
  // Column headers for the 8 roles + a known permission row.
  await expect(page.getByRole('columnheader', { name: 'OWNER', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'ANALYST', exact: true })).toBeVisible();
  await expect(page.getByText('money.approve', { exact: true })).toBeVisible();
  // Unit 3: the directory now shows real ops-role holdings per teammate (from
  // the DTO's opsRoleKeys) — the "check audit before revoke" workaround is gone.
  await expect(
    page.getByRole('columnheader', { name: /أدوار العمليات \(RBAC\)/ }),
  ).toBeVisible();
  await expect(page.getByText(/تأكّد من دور العمليات الحالي للمستخدم من سجل التدقيق/)).toHaveCount(0);
});
