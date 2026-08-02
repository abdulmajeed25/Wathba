import { expect, test, type Page } from '@playwright/test';
import { API } from './helpers';

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * The ops session must not outlive the public session it was granted under.
 *
 * What was wrong: signing out of the public site deleted `wathba_session` and
 * `wathba_refresh` and left `wathba_ops_session` in place — cookie AND live
 * server-side session. Measured on a running build, after a normal sign-out by
 * an OWNER, with no public session left in the jar:
 *
 *   GET  /api/ops/auth/session             → 200, roleKeys ["OWNER"],
 *                                              permissions ["*"]
 *   GET  /api/ops/read/agents              → 200, real operator data
 *   POST /api/ops/operations/<key>/dry-run → 200, the registry evaluated it
 *
 * It read as harmless because the /ops PAGES did bounce to /sign-in: middleware
 * checks the public session before it ever looks at the ops cookie. But the BFF
 * proxies under /api/ops/* only ever checked the ops cookie, so on a shared
 * machine the next person kept full operator reach through fetch(), with no
 * account of their own and nothing on screen to suggest it.
 *
 * Three independent things have to hold, and each is a separate test because
 * each can regress on its own:
 *   T1  sign-out removes the ops cookie
 *   T2  sign-out REVOKES the ops session server-side — a cookie that is merely
 *       out of sight is not a session that has ended
 *   T3  the BFF refuses without a public session, whatever the ops cookie says
 */

let apiUp = false;
test.beforeAll(async () => {
  try {
    apiUp = (await fetch(`${API}/v1/health`)).ok;
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

async function publicSignOut(page: Page): Promise<void> {
  await page.goto('/projects');
  await page.locator('button[aria-haspopup="menu"][aria-label^="حساب"]').click();
  await page.getByRole('menuitem', { name: /تسجيل الخروج/ }).click();
  await page.waitForURL(/\/sign-in/);
}

const opsCookie = async (page: Page) =>
  (await page.context().cookies()).find((c) => c.name === 'wathba_ops_session') ?? null;

test('T1: public sign-out takes the ops cookie with it', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-session spec');
  await enterOps(page);
  expect(await opsCookie(page), 'entering ops should have set the cookie').not.toBeNull();

  await publicSignOut(page);
  expect(await opsCookie(page), 'wathba_ops_session survived public sign-out').toBeNull();
});

test('T2: public sign-out revokes the ops session server-side, not just the cookie', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-session spec');
  await enterOps(page);

  // Lift the raw token out of the jar. Playwright can read httpOnly cookies; a
  // browser cannot — which is the point. Replaying it straight at the API goes
  // around the BFF and its public-session check entirely, so this is the only
  // assertion that can tell revocation apart from cookie deletion.
  const token = (await opsCookie(page))?.value;
  expect(token, 'no ops cookie to capture').toBeTruthy();

  const live = await fetch(`${API}/v1/ops/auth/session`, { headers: { 'x-ops-token': token! } });
  expect(live.status, 'the captured token should be live before sign-out').toBe(200);

  await publicSignOut(page);

  const dead = await fetch(`${API}/v1/ops/auth/session`, { headers: { 'x-ops-token': token! } });
  expect(dead.status, 'the ops token still resolves at the API after sign-out').not.toBe(200);
});

test('T3: the ops BFF refuses every call once the public session is gone', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-session spec');
  await enterOps(page);

  // Drop ONLY the public credentials and keep the ops cookie — the exact state
  // sign-out used to leave behind, reproduced directly so this still has teeth
  // if the sign-out path ever changes shape.
  const ctx = page.context();
  const kept = (await ctx.cookies()).filter((c) => c.name === 'wathba_ops_session');
  await ctx.clearCookies();
  await ctx.addCookies(kept);
  expect(await opsCookie(page), 'the ops cookie should still be set for this test').not.toBeNull();

  const results = await page.evaluate(async () => {
    const calls: Array<[string, Promise<Response>]> = [
      ['session', fetch('/api/ops/auth/session', { cache: 'no-store' })],
      ['read', fetch('/api/ops/read/agents', { cache: 'no-store' })],
      [
        'operation',
        fetch('/api/ops/operations/projects.review.approve/dry-run', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ input: { projectId: '00000000-0000-4000-8000-000000000000' } }),
        }),
      ],
    ];
    const out: Record<string, number> = {};
    for (const [name, call] of calls) out[name] = (await call).status;
    return out;
  });

  // A read, a session probe and an operation — the three shapes every ops
  // client island uses. All of them answered 200 before this was fixed.
  expect(results.session, '/api/ops/auth/session answered without a public session').toBe(401);
  expect(results.read, '/api/ops/read/* answered without a public session').toBe(401);
  expect(results.operation, '/api/ops/operations/* answered without a public session').toBe(401);
});
