import { expect, test, type APIRequestContext } from '@playwright/test';
import { API, apiSignin } from './helpers';

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * OPS Phase 2 — USERS + TRUST-&-SAFETY screens against the live stack.
 *  1. /ops/users renders the masked directory — no RAW `@` email leaks into a
 *     plain cell (only maskEmail() output, which contains bullets/dots).
 *  2. a user detail page renders the governed operations panel.
 *  3. /ops/trust renders the moderation surface.
 *
 * Gated: needs the golden stack (web build + API + seed). API unreachable →
 * skip (mirrors the other ops specs). Enter flow copied from ops-kit.spec.ts.
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

async function firstUserId(request: APIRequestContext): Promise<string> {
  const token = await apiSignin(OWNER.email, OWNER.pass);
  const me = await request.get(`${API}/v1/users/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return ((await me.json()) as { id: string }).id;
}

test('/ops/users renders the masked directory with no raw email leak', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-users spec');
  await enterOps(page);

  await page.goto('/ops/users');
  await expect(page.getByRole('heading', { name: 'المستخدمون', exact: true })).toBeVisible();

  const table = page.locator('table');
  await expect(table).toBeVisible();

  // Masked-email cells render (maskEmail dots «•»); assert no cell exposes a
  // raw `local@domain.tld` address in plain text.
  const rawEmail = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  const cells = await table.locator('td').allInnerTexts();
  for (const text of cells) {
    expect(text).not.toMatch(rawEmail);
  }
});

test('/ops/users renders cross-page census tiles + the KYC queue tab', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-users spec');
  await enterOps(page);

  await page.goto('/ops/users');
  // Cross-page census tiles (users/stats) — active/moderated + verification.
  // CLOSEOUT C5 — «نشط» is also the status badge on every table row (40 matches),
  // so match the TILE: a link whose accessible name is the label plus its count.
  await expect(page.getByRole('link', { name: /^نشط\s/ }).first()).toBeVisible();
  await expect(page.getByText('موثّق نفاذ', { exact: true })).toBeVisible();
  await expect(page.getByText('موردون موثّقون', { exact: true })).toBeVisible();

  // The KYC escalation queue tab loads its dedicated worklist.
  await page.getByRole('link', { name: 'طابور التوثيق (KYC)' }).click();
  await page.waitForURL(/view=kyc/);
  await expect(page.getByRole('link', { name: 'غير موثّقين عبر نفاذ' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'موردون بانتظار التوثيق' })).toBeVisible();
});

test('a user detail page renders the operations panel', async ({ page, request }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-users spec');
  const id = await firstUserId(request);
  await enterOps(page);

  await page.goto(`/ops/users/${id}`);
  // CLOSEOUT C5 — scope to the main region: the sidebar groups its nav under an
  // h2 «العمليات» too, so an unscoped exact query is ambiguous.
  await expect(
    page.locator('#ops-main').getByRole('heading', { name: 'العمليات', exact: true }),
  ).toBeVisible();
  // Governed lifecycle controls are present (suspend/reactivate + ban/unban).
  await expect(page.getByRole('button', { name: /إيقاف الحساب|إعادة تفعيل/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'كشف البريد والهاتف' })).toBeVisible();
  // Impersonation is disabled, never faked.
  await expect(page.getByRole('button', { name: /العرض بصفة المستخدم/ })).toBeDisabled();
  // Unit 3: real pledge + session lists replace the bare counts.
  await expect(page.getByRole('heading', { name: /تعهّدات هذا الحساب/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /الجلسات والأجهزة/ })).toBeVisible();
});

test('/ops/trust renders the moderation surface', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-users spec');
  await enterOps(page);

  await page.goto('/ops/trust');
  await expect(page.getByRole('heading', { name: 'الثقة والسلامة', exact: true })).toBeVisible();
  await expect(page.getByText('إجمالي البلاغات المفتوحة')).toBeVisible();
  // CLOSEOUT C5 — this asserted «إشراف مُوجَّه بالمعرّف», copy that has never
  // existed in the app: OPS-360 Unit 3 deliberately replaced blind id-paste
  // moderation with a REAL queue, and the page says so in as many words. The
  // assertion was left describing the superseded design and, because this whole
  // file self-skipped on a broken health probe, never failed loudly. Assert the
  // design that actually shipped.
  await expect(page.getByText('لا صندوق لصق أعمى هنا')).toBeVisible();
});
