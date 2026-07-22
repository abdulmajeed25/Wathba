import { expect, test, type Page } from '@playwright/test';
import { API } from './helpers';

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * OPS-GAPS Y2 — «الإعدادات ← الاتصالات». Proves the Communications tab renders
 * against the LIVE stack: the email-templates panel + the notification-kinds
 * toggles, OR the amber «قيد الإنشاء» degrade when the comms backend isn't live
 * yet. Either outcome is a pass — we never assert fabricated template rows.
 *
 * Gated: needs the live stack (web build + API + seed). API unreachable → skip.
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

test('«الاتصالات» renders templates + kind toggles (or the amber degrade)', async ({
  page,
}) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-comms spec');
  await enterOps(page);

  await page.goto('/ops/settings');
  await expect(page.getByRole('heading', { name: 'الإعدادات' })).toBeVisible();

  // Switch to the Communications tab.
  await page.getByRole('tab', { name: 'الاتصالات' }).click();

  const degraded = page.getByText('قيد الإنشاء', { exact: false });
  const noPermission = page.getByText('تفتقد صلاحية settings.write', { exact: false });
  const templatesHeading = page.getByRole('heading', { name: 'قوالب البريد الإلكتروني' });

  // One of: full panel, backend-not-live amber, or missing-permission amber.
  await expect(async () => {
    const ok =
      (await templatesHeading.isVisible()) ||
      (await degraded.isVisible()) ||
      (await noPermission.isVisible());
    expect(ok).toBeTruthy();
  }).toPass();

  // When the panel is live, the notification-kinds section must render too.
  if (await templatesHeading.isVisible()) {
    await expect(page.getByRole('heading', { name: 'أنواع الإشعارات' })).toBeVisible();
  }
});
