import { expect, test, type APIRequestContext } from '@playwright/test';
import { API, apiSignin, opsEnter } from './helpers';

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };
const FINANCE = { email: 'smoke-finance@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * OPS Part 3 — the audit chain against the LIVE stack:
 *  1. The chain verifies intact over the whole history, and every operation
 *     lands as a typed audit row (actorType/riskTier/reason/subject).
 *  2. audit.read gates the browser (a grant-less admin is refused).
 *  3. «سجل التدقيق» renders server-first with the chain verdict banner.
 *  (Immutability — UPDATE/DELETE/TRUNCATE raising at the DB — is proven by
 *  apps/api/src/ops/audit-chain.spec.ts against the real database.)
 */

async function userIdOf(request: APIRequestContext, email: string, pass: string): Promise<string> {
  const token = await apiSignin(email, pass);
  const me = await request.get(`${API}/v1/users/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return ((await me.json()) as { id: string }).id;
}

test('the chain verifies intact and an executed operation lands as a typed, subject-anchored row', async ({ request }) => {
  const ownerOps = await opsEnter(OWNER.email, OWNER.pass);
  const headers = { 'x-ops-token': ownerOps };

  const verify = await request.get(`${API}/v1/ops/audit/verify`, { headers });
  expect(verify.status()).toBe(200);
  const verdict = (await verify.json()) as { ok: boolean; checked: number };
  expect(verdict.ok).toBe(true);
  expect(verdict.checked).toBeGreaterThan(100);

  // Execute an audited SENSITIVE operation, then find its row in the feed.
  const financeId = await userIdOf(request, FINANCE.email, FINANCE.pass);
  const reason = `اختبار آلي: قيد تدقيق للسلسلة ${Date.now()}`;
  const exec = await request.post(`${API}/v1/ops/operations/users.pii.unmask/execute`, {
    headers,
    data: { input: { userId: financeId, fields: ['email'] }, reason },
  });
  expect(exec.status()).toBe(200);

  const feed = await request.get(
    `${API}/v1/ops/audit?action=ops.users.pii.unmask&entityId=${financeId}&limit=5`,
    { headers },
  );
  expect(feed.status()).toBe(200);
  const { items } = (await feed.json()) as {
    items: Array<{
      action: string; entity: string; entityId: string; actorType: string;
      riskTier: string; reason: string; hash: string; prevHash: string; chainSeq: string;
    }>;
  };
  const row = items.find((r) => r.reason === reason)!;
  expect(row).toBeTruthy();
  expect(row).toMatchObject({
    action: 'ops.users.pii.unmask',
    entity: 'User',
    entityId: financeId,
    actorType: 'HUMAN',
    riskTier: 'SENSITIVE',
  });
  expect(row.hash).toMatch(/^[0-9a-f]{64}$/);

  // …and the chain still verifies with the new row on it.
  const verify2 = await request.get(`${API}/v1/ops/audit/verify`, { headers });
  expect(((await verify2.json()) as { ok: boolean }).ok).toBe(true);
});

test('audit.read gates the browser: a grant-less admin is refused', async ({ request }) => {
  const financeOps = await opsEnter(FINANCE.email, FINANCE.pass);
  for (const path of ['/v1/ops/audit', '/v1/ops/audit/verify']) {
    const res = await request.get(`${API}${path}`, { headers: { 'x-ops-token': financeOps } });
    expect(res.status(), path).toBe(403);
    expect(JSON.stringify(await res.json())).toContain('audit.read');
  }
});

test('«سجل التدقيق» renders server-first with the chain verdict', async ({ page }) => {
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

  // CLOSEOUT C5 — scope to the sidebar: «سجل التدقيق» is also a quick-link and a
  // cross-reference on the /ops home, so an unscoped role query is ambiguous.
  await page.getByLabel('أقسام مركز العمليات').getByRole('link', { name: 'سجل التدقيق' }).click();
  await page.waitForURL(/\/ops\/audit/);
  await expect(page.getByText(/السلسلة سليمة/)).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'الإجراء' })).toBeVisible();
  // The feed shows real rows (the seeded history is >100 entries).
  await expect(page.locator('tbody tr').first()).toBeVisible();
});
