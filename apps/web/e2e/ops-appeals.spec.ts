import { expect, test } from '@playwright/test';
import { API } from './helpers';

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * OPS-GAPS R1 — the appeals surfaces, against the live golden stack.
 *
 *  1. /ops/appeals renders the «التظلّمات» moderation queue (filters + table,
 *     or the amber "قيد الإنشاء" note when the backend route isn't live yet —
 *     never a crash, never fabricated rows).
 *  2. A queue row (when present) links through to the per-appeal workspace,
 *     which shows the appellant's argument + the decide panel.
 *  3. /appeal (appellant-facing) renders the locked «تقديم تظلّم» surface with
 *     a reason field + submit button for a signed-in session.
 *
 * Gated: needs the golden stack (web build + API + seed). API unreachable →
 * skip. Enter flow mirrors ops-trust.spec.ts.
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

async function signIn(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/sign-in');
  await page.locator('input[name="email"]').fill(OWNER.email);
  await page.locator('input[name="password"]').fill(OWNER.pass);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL(/\/(projects|appeal)(\?|$|\/)/);
}

async function enterOps(page: import('@playwright/test').Page): Promise<void> {
  await signIn(page);
  await page.goto('/ops');
  await page.waitForURL(/\/ops\/enter/);
  await page.locator('#ops-password').fill(OWNER.pass);
  await page.getByRole('button', { name: 'دخول إلى مركز العمليات' }).click();
  await page.waitForURL(/\/ops$/);
}

test('/ops/appeals renders the appeals queue (or the building note)', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-appeals spec');
  await enterOps(page);

  await page.goto('/ops/appeals');
  await expect(page.getByRole('heading', { name: 'التظلّمات', exact: true })).toBeVisible();

  // Either the live queue (a DataTable) OR the amber "قيد الإنشاء" degrade —
  // never a crash.
  const table = page.locator('table').first();
  const building = page.getByText(/قيد الإنشاء/).first();
  await expect(table.or(building)).toBeVisible();

  // No raw email leaks in any queue cell (submitters are masked by the API).
  const rawEmail = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  for (const text of await page.locator('td').allInnerTexts()) {
    expect(text).not.toMatch(rawEmail);
  }
});

test('an appeals queue row links to the per-appeal workspace', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-appeals spec');
  await enterOps(page);

  await page.goto('/ops/appeals');
  const firstRowLink = page.locator('table tbody tr a').first();
  const hasRows = await firstRowLink.count();
  test.skip(hasRows === 0, 'no appeals seeded — nothing to open');

  await firstRowLink.click();
  await page.waitForURL(/\/ops\/appeals\/[^/]+$/);
  // The workspace shows the appellant's argument + the decision panel.
  await expect(page.getByRole('heading', { name: 'حجّة المتظلّم', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'القرار', exact: true })).toBeVisible();
});

test('/appeal renders the locked appeal surface for a signed-in session', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-appeals spec');
  await signIn(page);

  await page.goto('/appeal');
  await expect(page.getByRole('heading', { name: 'تقديم تظلّم', exact: true })).toBeVisible();

  // Either the submit form (no existing appeal) or an existing-appeal status card.
  const submit = page.getByRole('button', { name: 'تقديم تظلّم' });
  const status = page.getByText(/الحالة:/).first();
  await expect(submit.or(status)).toBeVisible();
});
