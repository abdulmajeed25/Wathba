import { expect, test } from '@playwright/test';

import { API, apiSignin, E2E_PASSWORD, opsEnter, signUpAndVerify, uniqueEmail } from './helpers';

/**
 * A temporary suspension is not a ban, and only a ban can be appealed.
 *
 * Sign-in routes EVERY restricted session to the locked /appeal surface. While
 * the locked token carried a bare `suspended: true`, that surface could not
 * tell the two apart and showed both the same ban-appeal form — which
 * appeals.service.ts then refuses for anything that is not BANNED
 * («حسابك ليس محظوراً»). The only door the platform offered a suspended reader
 * was one they were forbidden to walk through, and nothing failed: the page
 * rendered, the form submitted, the API answered. It just said no.
 *
 * This drives the real thing — a real account, suspended by the real governed
 * operation — because the bug lived in the gap between two components that
 * were each individually correct.
 */

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

async function ownUserId(email: string): Promise<string> {
  const jwt = await apiSignin(email, E2E_PASSWORD);
  const r = await fetch(`${API}/v1/users/me`, { headers: { authorization: `Bearer ${jwt}` } });
  const body = (await r.json()) as { id?: string };
  if (!body.id) throw new Error('could not read own user id');
  return body.id;
}

/** Run a governed op as the owner, doing the dry-run first (no blind writes). */
async function runOp(opsToken: string, key: string, userId: string, reason: string): Promise<void> {
  const headers = { 'x-ops-token': opsToken, 'content-type': 'application/json' };
  const body = JSON.stringify({ input: { userId }, reason });
  await fetch(`${API}/v1/ops/operations/${key}/dry-run`, { method: 'POST', headers, body });
  const exec = await fetch(`${API}/v1/ops/operations/${key}/execute`, { method: 'POST', headers, body });
  if (!exec.ok) throw new Error(`${key} failed: ${exec.status} ${await exec.text()}`);
}

test('a temporarily suspended account is told the truth, not shown an appeal it cannot file', async ({
  page,
}) => {
  const email = uniqueEmail('suspended');
  await signUpAndVerify(page, 'مستخدم موقوف', email, String(1000000000 + Math.floor(Math.random() * 8e8)));
  const userId = await ownUserId(email);

  const ops = await opsEnter(OWNER.email, OWNER.pass);
  await runOp(ops, 'users.suspend', userId, 'اختبار آلي: التحقق من صفحة الحساب الموقوف مؤقتاً');

  try {
    // The suspension revoked every session in the same transaction, so this is
    // a fresh sign-in — exactly the path a suspended user actually takes.
    await page.goto('/sign-in');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await page.waitForURL(/\/appeal/);

    // The truth: a temporary hold, with the route back that actually exists.
    await expect(page.getByRole('heading', { name: 'حسابك موقوف مؤقتاً' })).toBeVisible();
    await expect(page.locator('a[href="mailto:support@wathba.sa"]')).toHaveCount(1);
    await expect(page.locator('a[href="/rules/enforcement"]')).toHaveCount(1);

    // And NOT the form. This is the whole defect: submitting it could only ever
    // have produced «حسابك ليس محظوراً».
    await expect(page.locator('form textarea')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'تقديم تظلّم' })).toHaveCount(0);
  } finally {
    await runOp(ops, 'users.reactivate', userId, 'اختبار آلي: إعادة تفعيل بعد التحقق');
  }
});

test('a normal signed-in account has no decision to appeal and is told so', async ({ page }) => {
  // Anyone could always navigate to /appeal directly. They used to be handed a
  // ban-appeal form for a ban that does not exist.
  const email = uniqueEmail('unrestricted');
  await signUpAndVerify(page, 'مستخدم عادي', email, String(1000000000 + Math.floor(Math.random() * 8e8)));

  await page.goto('/appeal');
  await expect(page.getByRole('heading', { name: 'لا يوجد قرار للتظلّم عنه' })).toBeVisible();
  await expect(page.locator('form textarea')).toHaveCount(0);
});

test('a rejected-project appeal still works for an unrestricted creator', async ({ page }) => {
  // The account-ban branch must not have broken the OTHER thing this surface
  // does: /appeal?project=<id> is the rejected-project entry point, and the
  // creator using it is not suspended at all.
  const email = uniqueEmail('proj-appeal');
  await signUpAndVerify(page, 'مبدع', email, String(1000000000 + Math.floor(Math.random() * 8e8)));

  await page.goto('/appeal?project=00000000-0000-4000-8000-000000000123');
  await expect(page.getByRole('heading', { name: 'تقديم تظلّم' })).toBeVisible();
  await expect(page.locator('form textarea')).toHaveCount(1);
});
