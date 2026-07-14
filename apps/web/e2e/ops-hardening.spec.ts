import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';
import { API, opsEnter, signUpAndVerify, uniqueEmail } from './helpers';

const SMOKE = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * OPS Part 1 — hardened integration proofs:
 *  1. /ops is invisible to the outside: anonymous → sign-in, non-admin →
 *     bounced, robots + sitemap + public HTML carry no /ops reference.
 *  2. The ops session is SEPARATE: entering requires the password again,
 *     mints a distinct httpOnly cookie, and the public JWT alone can NOT
 *     talk to /v1/ops/*.
 *  3. MONEY operations refuse without a fresh ops step-up (x-ops-token) —
 *     on the ops surface AND the legacy admin seams — and pass with one.
 *  4. Bundle isolation at the source level: nothing outside app/ops
 *     imports from app/ops.
 */

test('anonymous /ops redirects to sign-in; the URL never leaks to robots/sitemap/public HTML', async ({ page, request }) => {
  await page.context().clearCookies();
  await page.goto('/ops');
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fops/);

  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /ops');

  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).not.toContain('/ops');

  for (const path of ['/projects', '/projects/about']) {
    const html = await (await request.get(path)).text();
    expect(html.includes('/ops'), `${path} must not reference /ops`).toBe(false);
  }
});

test('a non-admin signed-in user is bounced off /ops', async ({ page }) => {
  const email = uniqueEmail('noops');
  await signUpAndVerify(page, 'مستخدم عادي', email, String(1000000000 + Math.floor(Math.random() * 8e8)));
  await page.goto('/ops');
  await expect(page).toHaveURL(/\/projects(\?|$|\/)/);
});

test('the public JWT is NOT accepted on /v1/ops/*; entering requires the password again', async ({ request }) => {
  // Bearer JWT (the public session) against the ops surface → 401.
  const signin = await request.post(`${API}/v1/auth/signin`, {
    data: { email: SMOKE.email, password: SMOKE.pass },
  });
  const { accessToken } = (await signin.json()) as { accessToken: string };
  const withJwt = await request.get(`${API}/v1/ops/operations`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  expect(withJwt.status()).toBe(401);

  // Wrong password on enter → 401 (and an anomaly row server-side).
  const badEnter = await request.post(`${API}/v1/ops/auth/enter`, {
    headers: { authorization: `Bearer ${accessToken}` },
    data: { password: 'wrong-password-1!' },
  });
  expect(badEnter.status()).toBe(401);

  // Proper enter → the ops token opens the manifest.
  const opsToken = await opsEnter(SMOKE.email, SMOKE.pass);
  const manifest = await request.get(`${API}/v1/ops/operations`, {
    headers: { 'x-ops-token': opsToken },
  });
  expect(manifest.status()).toBe(200);
  const { items } = (await manifest.json()) as { items: Array<{ riskTier: string }> };
  expect(items.length).toBeGreaterThan(10);
  expect(items.some((i) => i.riskTier === 'MONEY')).toBe(true);
});

test('MONEY refuses without a fresh ops step-up and passes with one (legacy seam + ops surface)', async ({ request }) => {
  const signin = await request.post(`${API}/v1/auth/signin`, {
    data: { email: SMOKE.email, password: SMOKE.pass },
  });
  const { accessToken } = (await signin.json()) as { accessToken: string };
  const jwt = { authorization: `Bearer ${accessToken}` };

  // Legacy seam WITHOUT x-ops-token → the Arabic step-up refusal (403).
  const refused = await request.post(`${API}/v1/admin/payouts/disburse`, {
    headers: jwt,
    data: { reason: 'اختبار آلي: محاولة بلا إعادة توثيق' },
  });
  expect(refused.status()).toBe(403);
  expect(JSON.stringify(await refused.json())).toContain('إعادة توثيق');

  // Same call WITH the ops token (fresh step-up from enter) → executes.
  const opsToken = await opsEnter(SMOKE.email, SMOKE.pass);
  const allowed = await request.post(`${API}/v1/admin/payouts/disburse`, {
    headers: { ...jwt, 'x-ops-token': opsToken },
    data: { reason: 'اختبار آلي: تشغيل دورة الصرف عبر جلسة العمليات' },
  });
  expect(allowed.status()).toBe(201);

  // Ops surface: MONEY dry-run works, execute with the session's step-up works.
  const dry = await request.post(`${API}/v1/ops/operations/money.payout.disburse/dry-run`, {
    headers: { 'x-ops-token': opsToken },
    data: { input: {} },
  });
  expect(dry.status()).toBe(200);
});

test('entering through the web mints a DISTINCT httpOnly cookie and lands on the shell', async ({ page }) => {
  // Sign in as the admin through the UI (smoke account has its own password).
  await page.goto('/sign-in');
  await page.locator('input[name="email"]').fill(SMOKE.email);
  await page.locator('input[name="password"]').fill(SMOKE.pass);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL(/\/projects(\?|$|\/)/);

  // /ops without an ops session → the explicit enter door.
  await page.goto('/ops');
  await expect(page).toHaveURL(/\/ops\/enter/);
  await expect(page.getByRole('heading', { name: 'دخول إلى مركز العمليات' })).toBeVisible();

  await page.locator('#ops-password').fill(SMOKE.pass);
  await page.getByRole('button', { name: 'دخول إلى مركز العمليات' }).click();
  await page.waitForURL(/\/ops$/);
  await expect(page.getByText('جلسة العمليات نشطة')).toBeVisible();

  const cookies = await page.context().cookies();
  const pub = cookies.find((c) => c.name === 'wathba_session');
  const ops = cookies.find((c) => c.name === 'wathba_ops_session');
  expect(pub).toBeTruthy();
  expect(ops).toBeTruthy();
  expect(ops!.httpOnly).toBe(true);
  expect(ops!.value).not.toBe(pub!.value);

  // Leaving revokes the session and drops back to the admin console.
  await page.getByRole('button', { name: 'إنهاء الجلسة والخروج' }).click();
  await page.waitForURL(/\/projects\/admin/);
  const after = await page.context().cookies();
  expect(after.find((c) => c.name === 'wathba_ops_session')?.value ?? '').toBe('');
});

test('bundle isolation: nothing outside app/ops imports from app/ops', () => {
  const SRC = join(__dirname, '..', 'src');
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (p.endsWith(`${join('src', 'app', 'ops')}`) || p.endsWith(`${join('app', 'api', 'ops')}`)) continue;
        if (name === 'node_modules') continue;
        walk(p);
      } else if (/\.(ts|tsx)$/.test(name)) {
        const src = readFileSync(p, 'utf8');
        if (/from\s+['"][^'"]*app\/ops/.test(src) || /from\s+['"]@\/app\/ops/.test(src)) {
          offenders.push(p);
        }
      }
    }
  };
  walk(SRC);
  expect(offenders).toEqual([]);
});
