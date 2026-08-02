import { expect, test } from '@playwright/test';
import { API, apiSignin, seededIds, signUpAndVerify, uniqueEmail, verificationLinkFor } from './helpers';

const E2E_PASS = 'E2eStrongPass!7';

/**
 * STAKES/S-12 — comms & account integrity + the HYBRID verification contract:
 *  F-11 2xx-uniform signup · email-verify gates comments/follows · grandfathering
 *  F-06 email change is verify-first (link to the NEW address)
 *  F-17 remember-me controls cookie persistence
 *  F-08 refund-completed lands in-app + email off the webhook
 */

async function apiSignup(email: string, name = 'مستخدم إي٢إي'): Promise<Response> {
  return fetch(`${API}/v1/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, email, password: E2E_PASS, acceptTerms: true }),
  });
}

test('F-11: signup is 2xx-uniform — duplicate and new are indistinguishable', async () => {
  const email = uniqueEmail('uniform');
  const first = await apiSignup(email);
  const second = await apiSignup(email); // duplicate
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(await first.json()).toEqual(await second.json()); // identical bodies
});

test('F-11: unverified users cannot follow or comment; the emailed link unlocks + signs in', async ({ page }) => {
  const email = uniqueEmail('gate');
  await apiSignup(email);
  // Sign-in works while unverified (verification gates FEATURES, not sessions).
  const tok = await apiSignin(email, E2E_PASS);

  const smokeTok = await apiSignin('smoke-s1@test.wathba.sa', 'Str0ngPass!x');
  const smoke = (await fetch(`${API}/v1/users/me`, {
    headers: { authorization: `Bearer ${smokeTok}` },
  }).then((r) => r.json())) as { id: string };

  // Follow gate → Arabic 403.
  const follow = await fetch(`${API}/v1/creators/${smoke.id}/follow`, {
    method: 'POST',
    headers: { authorization: `Bearer ${tok}` },
  });
  expect(follow.status).toBe(403);
  expect(JSON.stringify(await follow.json())).toContain('فعّل بريدك');

  // Comment gate fires BEFORE backer eligibility → the email message.
  const { projectId } = seededIds();
  const comment = await fetch(`${API}/v1/projects/${projectId}/comments`, {
    method: 'POST',
    headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    body: JSON.stringify({ bodyAr: 'تعليق قبل التفعيل' }),
  });
  expect(comment.status).toBe(403);
  expect(JSON.stringify(await comment.json())).toContain('فعّل بريدك');

  // Consume the emailed link through the real UI → verified + signed in.
  const link = await verificationLinkFor(email);
  await page.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await page.getByRole('button', { name: 'فعّل حسابي' }).click();
  await expect(page).toHaveURL(/sign-up\/nafath/);

  // The follow gate is open now.
  const tok2 = await apiSignin(email, E2E_PASS);
  const follow2 = await fetch(`${API}/v1/creators/${smoke.id}/follow`, {
    method: 'POST',
    headers: { authorization: `Bearer ${tok2}` },
  });
  expect(follow2.ok).toBe(true);
});

test('F-11: grandfathered account (pre-migration) is verified and unaffected', async () => {
  const tok = await apiSignin('smoke-s1@test.wathba.sa', 'Str0ngPass!x');
  const me = (await fetch(`${API}/v1/users/me`, {
    headers: { authorization: `Bearer ${tok}` },
  }).then((r) => r.json())) as { emailVerified: boolean };
  expect(me.emailVerified).toBe(true);
});

test('F-06: email change applies only after the link on the NEW address is clicked', async ({ page }) => {
  const emailA = uniqueEmail('changer');
  const emailB = uniqueEmail('newaddr');
  await signUpAndVerify(page, 'مغيّر البريد', emailA, '7788990011');
  const tok = await apiSignin(emailA, E2E_PASS);

  const req = await fetch(`${API}/v1/users/me/email`, {
    method: 'POST',
    headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    body: JSON.stringify({ currentPassword: E2E_PASS, newEmail: emailB }),
  });
  expect(req.ok).toBe(true);

  // Nothing changed yet — the old address still signs in and /me shows it.
  const meBefore = (await fetch(`${API}/v1/users/me`, {
    headers: { authorization: `Bearer ${tok}` },
  }).then((r) => r.json())) as { email: string };
  expect(meBefore.email).toBe(emailA);

  // Click the link that went to the NEW address.
  const link = await verificationLinkFor(emailB);
  await page.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await page.getByRole('button', { name: 'فعّل حسابي' }).click();
  await page.waitForURL(/sign-up\/nafath|\/projects/);

  // The swap applied: new address signs in, /me reflects it, old one is dead.
  const tokB = await apiSignin(emailB, E2E_PASS);
  const meAfter = (await fetch(`${API}/v1/users/me`, {
    headers: { authorization: `Bearer ${tokB}` },
  }).then((r) => r.json())) as { email: string };
  expect(meAfter.email).toBe(emailB);
  await expect(fetch(`${API}/v1/auth/signin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: emailA, password: E2E_PASS }),
  }).then((r) => r.status)).resolves.toBe(401);

  // The OLD address got the security notice (dev-mailbox seam).
  const notices = (await fetch(`${API}/v1/auth/dev-mailbox?to=${encodeURIComponent(emailA)}`).then((r) =>
    r.json(),
  )) as Array<{ subject: string }>;
  expect(notices.some((m) => m.subject.includes('تغيير بريد'))).toBe(true);
});

test('F-17: remember-me controls whether the session cookie persists', async ({ browser }) => {
  const email = uniqueEmail('remember');
  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage();
  await signUpAndVerify(p1, 'متذكَّر', email, '8899001122');
  await ctx1.clearCookies();

  // Unchecked → session cookies (expires -1).
  await p1.goto('/sign-in');
  await p1.locator('input[name="email"]').fill(email);
  await p1.locator('input[name="password"]').fill(E2E_PASS);
  await p1.getByLabel('تذكرني').uncheck();
  await p1.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await p1.waitForURL((url) => !url.pathname.startsWith('/sign-in'));
  const sessionCookie = (await ctx1.cookies()).find((c) => c.name === 'wathba_session');
  expect(sessionCookie?.expires).toBe(-1);
  // The choice must also be RECORDED, because middleware has to honour it when
  // it rotates the token an hour later and a browser sends back only
  // `name=value` — no Max-Age, nothing to infer the choice from. Rotation used
  // to re-set both cookies as 30-day persistent ones, so unchecking «تذكرني»
  // held only until the first rotation. The marker is itself session-scoped
  // here, so the choice cannot outlive the session it applies to.
  const marker1 = (await ctx1.cookies()).find((c) => c.name === 'wathba_remember');
  expect(marker1?.value, 'unchecked «تذكرني» must record wathba_remember=0').toBe('0');
  expect(marker1?.expires, 'the marker must not outlive a session-scoped choice').toBe(-1);
  await ctx1.close();

  // Checked (default) → persistent 30-day cookie.
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto('/sign-in');
  await p2.locator('input[name="email"]').fill(email);
  await p2.locator('input[name="password"]').fill(E2E_PASS);
  await p2.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await p2.waitForURL((url) => !url.pathname.startsWith('/sign-in'));
  const persistent = (await ctx2.cookies()).find((c) => c.name === 'wathba_session');
  expect(persistent && persistent.expires > Date.now() / 1000 + 86_400).toBe(true);
  const marker2 = (await ctx2.cookies()).find((c) => c.name === 'wathba_remember');
  expect(marker2?.value, 'checked «تذكرني» must record wathba_remember=1').toBe('1');
  await ctx2.close();

  // NOTE on what this test can and cannot reach. It covers the RECORDING of the
  // choice; it cannot cover middleware HONOURING it, because rotation only fires
  // within 5 minutes of a 1-hour token's expiry and no browser test can produce
  // a ~55-minute-old token. Forcing it needs a build with ROTATE_AHEAD_MS
  // raised, which cannot be done for one spec in a suite that shares one server
  // — and a globally raised value rotates on every request, replaying the
  // one-time refresh token until the session dies. The rotation half was
  // verified out-of-band against such a build: marker 0 → no Max-Age,
  // marker 1 → Max-Age, marker absent → Max-Age (legacy sessions were all
  // persistent, so absence must stay persistent or upgrading signs people out).
});

test('F-08: a refund webhook lands the in-app notification + email', async ({ page }) => {
  const { projectId } = seededIds();
  const email = uniqueEmail('refunded');
  await signUpAndVerify(page, 'مسترد إي٢إي', email, '9900112233');
  const tok = await apiSignin(email, E2E_PASS);

  // Real HELD pledge via the API, then the PSP voids it (webhook).
  const tiersRaw = (await fetch(`${API}/v1/projects/${projectId}/reward-tiers`).then((r) => r.json())) as
    | Array<{ id: string }>
    | { items: Array<{ id: string }> };
  const tiers = Array.isArray(tiersRaw) ? tiersRaw : tiersRaw.items;
  const pledge = (await fetch(`${API}/v1/pledges`, {
    method: 'POST',
    headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    body: JSON.stringify({ projectId, tierId: tiers[0]!.id, amountHalalas: 5000, source: 'tok_sandbox_refund' }),
  }).then((r) => r.json())) as { paymentRef?: string; pledge?: { paymentRef?: string } };
  const paymentRef = pledge.paymentRef ?? pledge.pledge?.paymentRef;
  expect(paymentRef).toBeTruthy();

  const hook = await fetch(`${API}/v1/webhooks/moyasar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: `evt-${Date.now()}`, type: 'payment_voided', data: { id: paymentRef } }),
  });
  expect(hook.ok).toBe(true);

  // In-app notification (transactional — lands regardless of prefs)…
  await expect
    .poll(async () => {
      const inbox = (await fetch(`${API}/v1/notifications/me`, {
        headers: { authorization: `Bearer ${tok}` },
      }).then((r) => r.json())) as { items: Array<{ kind: string }> };
      return inbox.items.some((n) => n.kind === 'REFUND_COMPLETED');
    }, { timeout: 10_000 })
    .toBe(true);

  // …and the Arabic email.
  const mails = (await fetch(`${API}/v1/auth/dev-mailbox?to=${encodeURIComponent(email)}`).then((r) =>
    r.json(),
  )) as Array<{ subject: string }>;
  expect(mails.some((m) => m.subject.includes('ردّ مبلغك'))).toBe(true);
});
