import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { expect, test, type Page } from '@playwright/test';
import { signUpAndVerify, signInUI, uniqueEmail } from './helpers';

/**
 * The session cookie's `Secure` flag, guarded against the origin it is served
 * from — because getting this wrong is silent, total, and invisible to every
 * other test in this suite.
 *
 * What happened: all three cookie sites read
 * `secure: process.env.NODE_ENV === 'production'`. That value is INLINED AT
 * BUILD TIME and `next build` always sets production, so every production build
 * emitted `Secure` cookies and no runtime configuration could change it. A
 * browser refuses a `Secure` cookie over plain `http://`, so on an HTTP
 * deployment sign-in returned 303 as though it had worked, the browser stored
 * nothing, `/api/me` answered 401 forever, and the account icon never appeared.
 * Registration, sign-in and the whole ops gate were dead.
 *
 * Why 178 passing tests said nothing: this suite runs on `localhost`, and
 * browsers treat localhost as a trustworthy origin — they accept `Secure`
 * cookies there over plain HTTP. The bug is only observable off localhost, so
 * the assertion below is derived from the TARGET ORIGIN rather than from any
 * env var:
 *
 *   https://…                    → `Secure` REQUIRED (never ship it naked)
 *   http://localhost | 127.0.0.1 → either is fine, the browser accepts both
 *   http://<anything else>       → `Secure` FORBIDDEN, or sessions cannot exist
 *
 * That rule needs no knowledge of COOKIE_SECURE or NODE_ENV, and it holds for
 * every environment this suite can be pointed at.
 */

const BASE = process.env.E2E_WEB_URL ?? 'http://localhost:3123';

/** The three-way rule above, as one decision. */
function secureExpectation(base: string): 'required' | 'forbidden' | 'either' {
  const u = new URL(base);
  if (u.protocol === 'https:') return 'required';
  if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1') return 'either';
  return 'forbidden';
}

async function sessionCookie(page: Page) {
  const all = await page.context().cookies();
  return all.find((c) => c.name === 'wathba_session') ?? null;
}

test('K1: signing in actually establishes a session the browser will keep', async ({ page }) => {
  // The end-to-end invariant, independent of any flag: after the real form
  // journey the browser must HOLD a cookie and the header must show the
  // account control. A 303 from /sign-in is not evidence — that is exactly what
  // the broken build returned.
  const email = uniqueEmail('cookie');
  await signUpAndVerify(page, 'مستخدم الجلسة', email, '2255667711');

  const cookie = await sessionCookie(page);
  expect(cookie, 'no wathba_session cookie was stored by the browser').not.toBeNull();
  expect(cookie!.httpOnly, 'session cookie must stay httpOnly').toBe(true);

  await page.goto('/projects');
  await expect(page.locator('button[aria-label^="حساب"]')).toBeVisible();
});

test('K2: the Secure flag matches the origin the app is served from', async ({ page }) => {
  const expectation = secureExpectation(BASE);
  const email = uniqueEmail('cookie-flag');
  await signUpAndVerify(page, 'مستخدم العلم', email, '2255667712');

  const cookie = await sessionCookie(page);
  expect(cookie).not.toBeNull();

  if (expectation === 'required') {
    expect(cookie!.secure, `${BASE} is https — the session cookie must be Secure`).toBe(true);
  } else if (expectation === 'forbidden') {
    // The failure this guards: a Secure cookie on a plain-HTTP origin is
    // dropped by the browser, so nobody can stay signed in. Reaching this
    // assertion at all means the cookie WAS stored, so it can only fail if a
    // future change re-introduces the flag on an http:// deployment.
    expect(cookie!.secure, `${BASE} is plain http on a non-localhost host — a Secure cookie cannot be stored`).toBe(false);
  }
  // 'either' (localhost) intentionally asserts nothing about `secure`: the
  // browser accepts both there, so any assertion would be testing the harness
  // rather than the app. K1 still runs and still has teeth.
});

test('K3: signing out removes the session cookie', async ({ page }) => {
  const email = uniqueEmail('cookie-out');
  await signUpAndVerify(page, 'مستخدم الخروج', email, '2255667713');
  await page.goto('/projects');

  await page.locator('button[aria-haspopup="menu"][aria-label^="حساب"]').click();
  await page.getByRole('menuitem', { name: /تسجيل الخروج/ }).click();

  // Poll, don't sleep. Sign-out is a server round trip that clears the cookie
  // and redirects, and 1500ms was a guess about how long that takes — when the
  // guess was wrong the test reported «wathba_session survived sign-out», which
  // is a security claim, not a timing one. Measured: fails, then passes on
  // retry, running ALONE. The assertion is unchanged and still absolute: the
  // cookie must be gone. Only the deadline moved.
  await expect
    .poll(async () => await sessionCookie(page), {
      message: 'wathba_session survived sign-out',
      timeout: 15_000,
    })
    .toBeNull();
  await page.goto('/projects');
  await expect(page.locator('a[href="/sign-in"]').first()).toBeVisible();

  // And it can be re-established — the round trip, not just the teardown.
  await signInUI(page, email);
  expect(await sessionCookie(page)).not.toBeNull();
});

/**
 * K4 — a SOURCE scan, because the runtime tests above cannot reach every site.
 *
 * When this bug was fixed there were three cookie-setting sites. There were
 * actually four: middleware's token-rotation path also derived `secure` from
 * NODE_ENV, and it RENEWS what the other three issue — so it could quietly undo
 * all of them about an hour into a session.
 *
 * K1-K3 could never have caught it. Rotation only fires when the access token is
 * within 5 minutes of its 1-hour expiry, so observing it takes a ~55-minute-old
 * token — not something a browser test can produce. A test that cannot reach the
 * code is not a guard for it.
 *
 * So this checks the property directly at the source level: no cookie's `secure`
 * value may be computed from NODE_ENV, because NODE_ENV is INLINED AT BUILD TIME
 * and `next build` always sets production. `cookiesAreSecure()` exists to make
 * that a runtime decision — see lib/cookie-security.ts. The same scan would have
 * caught all four original sites, and catches a fifth.
 */
test('K4: no cookie derives its Secure flag from the build-time NODE_ENV', () => {
  const SRC = join(__dirname, '..', 'src');
  // `secure` assigned (`=`) or passed (`:`) a value mentioning NODE_ENV, on one
  // line. That is the exact shape all four sites had.
  const BAD = /secure\s*[:=][^;,\n]*process\.env\.NODE_ENV/;

  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name === 'node_modules') continue;
        walk(p);
      } else if (/\.(ts|tsx)$/.test(name)) {
        const src = readFileSync(p, 'utf8');
        for (const [i, line] of src.split('\n').entries()) {
          if (BAD.test(line)) offenders.push(`${relative(SRC, p)}:${i + 1}  ${line.trim()}`);
        }
      }
    }
  };
  walk(SRC);

  expect(
    offenders,
    `these cookies decide Secure at BUILD time; use cookiesAreSecure() from lib/cookie-security:\n  ${offenders.join('\n  ')}`,
  ).toEqual([]);
});
