import { expect, test } from '@playwright/test';
import { API } from './helpers';

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * OPS-360 Unit 3 — TRUST & SAFETY (real moderation queue) + the ALERTS center
 * + the home anomaly strip, against the live golden stack.
 *
 *  1. /ops/trust renders the tabbed moderation queue (reports + reported
 *     comments) — a real DataTable, no blind id-paste box, no raw email leak.
 *  2. /ops/alerts renders the dedicated anomaly center.
 *  3. /ops (home) renders the anomaly strip and links to the alerts center.
 *
 * Gated: needs the golden stack (web build + API + seed). API unreachable →
 * skip (mirrors the other ops specs). Enter flow copied from ops-users.spec.ts.
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

test('/ops/trust renders the tabbed moderation queue with no raw email leak', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-trust spec');
  await enterOps(page);

  await page.goto('/ops/trust');
  await expect(page.getByRole('heading', { name: 'الثقة والسلامة', exact: true })).toBeVisible();

  // Both moderation tabs exist (reports + reported comments) — the real queue,
  // not the old blind id-paste cards.
  await expect(page.getByRole('tab', { name: /البلاغات المفتوحة/ })).toBeVisible();
  const commentsTab = page.getByRole('tab', { name: /تعليقات مُبلَّغ عنها/ });
  await expect(commentsTab).toBeVisible();

  // A DataTable renders on the reports tab.
  await expect(page.locator('table').first()).toBeVisible();

  // Switch to the comments browser — its table renders too.
  await commentsTab.click();
  await expect(page.locator('table').first()).toBeVisible();

  // No raw `local@domain.tld` email leaks into any cell (authors are masked /
  // resolved via ActorName, never the plain address).
  const rawEmail = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  for (const text of await page.locator('td').allInnerTexts()) {
    expect(text).not.toMatch(rawEmail);
  }
});

test('/ops/alerts renders the dedicated anomaly center', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-trust spec');
  await enterOps(page);

  await page.goto('/ops/alerts');
  await expect(page.getByRole('heading', { name: 'مركز التنبيهات', exact: true })).toBeVisible();
  // Either firing alerts (grouped) or the quiet all-clear line — never a crash.
  await expect(
    page
      .getByText(/لا تنبيهات مُفعَّلة|حرجة|تحذيرية|إعلامية/)
      .first(),
  ).toBeVisible();
});

test('/ops home renders the anomaly strip linking to the alerts center', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-trust spec');
  await enterOps(page);

  await page.goto('/ops');
  await expect(page.getByRole('heading', { name: 'التنبيهات', exact: true })).toBeVisible();
  const link = page.getByRole('link', { name: /مركز التنبيهات/ });
  await expect(link).toBeVisible();
  await link.click();
  await page.waitForURL(/\/ops\/alerts$/);
  await expect(page.getByRole('heading', { name: 'مركز التنبيهات', exact: true })).toBeVisible();
});
