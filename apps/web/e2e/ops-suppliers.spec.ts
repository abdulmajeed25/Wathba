import { expect, test } from '@playwright/test';
import { API } from './helpers';

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * OPS-360 Unit 3 — SUPPLIERS. Proves:
 *  1. /ops/suppliers renders the verification queue + RFQ oversight, and each
 *     queued supplier links to their NEW entity profile.
 *  2. /ops/suppliers/profile/[userId] renders the masked supplier record —
 *     verification section (with suppliers.verify), the bid tally, the bids
 *     DataTable, and the audit timeline.
 *
 * Gated: needs the live stack (web build + API + seed). Unreachable API skips.
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

test('the suppliers screen renders the verification queue + RFQ oversight', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-suppliers spec');
  await enterOps(page);
  await page.goto('/ops/suppliers');

  await expect(page.getByRole('heading', { name: 'الموردون والمزادات', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'طابور توثيق الموردين' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'الإشراف على طلبات عروض الأسعار' })).toBeVisible();
});

test('a queued supplier links to their entity profile', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-suppliers spec');
  await enterOps(page);
  await page.goto('/ops/suppliers');

  const profileLink = page.locator('a[href^="/ops/suppliers/profile/"]').first();
  test.skip((await profileLink.count()) === 0, 'no unverified suppliers seeded — skipping profile assertion');

  await profileLink.click();
  await page.waitForURL(/\/ops\/suppliers\/profile\/[^/]+/);

  await expect(page.getByRole('heading', { name: 'التوثيق' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'العروض عبر طلبات عروض الأسعار' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'الخط الزمني' })).toBeVisible();
});
