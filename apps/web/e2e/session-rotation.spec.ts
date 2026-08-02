import { expect, test, type APIRequestContext } from '@playwright/test';
import { API } from './helpers';

const SMOKE = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * Middleware's token-rotation block, finally reachable.
 *
 * It fires only when the access token is within 5 minutes of its 1-hour expiry,
 * so no test in this suite could reach it — and three bugs accumulated there
 * unseen, each shipped and each found by hand:
 *
 *   · `secure` derived from the build-time NODE_ENV, so a rotated cookie came
 *     back `Secure` on a plain-HTTP deployment and the browser dropped it — the
 *     session died about an hour in, after sign-in had appeared to work;
 *   · `maxAge` set unconditionally, so the first rotation promoted every
 *     "don't remember me" session to a 30-day persistent cookie;
 *   · the ops-session cookie was left behind when a rejected refresh
 *     confiscated the public credentials.
 *
 * playwright.config.ts runs a second instance of the same build with the
 * rotation window widened past the token's whole lifetime, so EVERY request
 * rotates. Two consequences shape everything below:
 *
 *  1. `request`, never `page`. The refresh token is one-time use. A real page
 *     load fires several concurrent requests, they all rotate with the same
 *     token, the losers replay a consumed one and the session dies. That is the
 *     harness working as designed, not a bug — so each case makes exactly one
 *     request.
 *  2. A fresh token pair per case, minted straight from the API, because the
 *     previous case consumed its own.
 *
 * The harness runs with COOKIE_SECURE=0 on purpose: the rotated cookie must
 * come back WITHOUT `Secure`. Revert that flag to NODE_ENV and it returns —
 * a production build always says production — and R1 fails. With COOKIE_SECURE=1
 * the correct and the broken code agree, and the assertion would be worthless.
 */

const ROTATION_URL = process.env.E2E_ROTATION_URL ?? 'http://127.0.0.1:3124';
/** Any protected path — it just has to make middleware run the session branch. */
const PROTECTED = '/projects/settings';

interface Pair {
  accessToken: string;
  refreshToken: string;
}

async function freshTokens(request: APIRequestContext): Promise<Pair> {
  const r = await request.post(`${API}/v1/auth/signin`, {
    data: { email: SMOKE.email, password: SMOKE.pass },
  });
  expect(r.status(), 'could not mint a token pair at the API').toBe(200);
  const body = (await r.json()) as Pair;
  expect(body.refreshToken, 'signin returned no refresh token — rotation cannot be tested').toBeTruthy();
  return body;
}

/** Every `set-cookie` on the response, unmerged. */
function setCookies(res: { headersArray(): Array<{ name: string; value: string }> }): string[] {
  return res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value);
}

const cookieHeader = (parts: Record<string, string>) =>
  Object.entries(parts)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

/** One request at a time — see note 1 above. */
async function rotate(
  request: APIRequestContext,
  extra: Record<string, string> = {},
  tokens?: Pair,
) {
  const pair = tokens ?? (await freshTokens(request));
  const res = await request.get(`${ROTATION_URL}${PROTECTED}`, {
    headers: {
      cookie: cookieHeader({
        wathba_session: pair.accessToken,
        wathba_refresh: pair.refreshToken,
        ...extra,
      }),
    },
    maxRedirects: 0,
  });
  return { res, cookies: setCookies(res), pair };
}

test('R1: rotation issues a new session cookie, and its Secure flag follows COOKIE_SECURE', async ({ request }) => {
  const { res, cookies } = await rotate(request);
  expect(res.status(), 'a rotating request on a protected path should be served, not redirected').toBe(200);

  const session = cookies.find((c) => c.startsWith('wathba_session='));
  expect(session, 'middleware did not rotate — the harness window is not in effect').toBeTruthy();
  expect(
    cookies.find((c) => c.startsWith('wathba_refresh=')),
    'the refresh token must be rotated with the access token, or the next rotation replays a consumed one',
  ).toBeTruthy();

  // The bug: `secure` came from the build-time NODE_ENV, which a production
  // build always reports as production. The harness sets COOKIE_SECURE=0, so
  // the correct code omits Secure and the broken code emits it.
  expect(/;\s*Secure/i.test(session!), `rotated cookie ignored COOKIE_SECURE=0: ${session}`).toBe(false);
  expect(/HttpOnly/i.test(session!), 'the rotated session cookie must stay httpOnly').toBe(true);
});

test('R2: rotation preserves the «تذكرني» choice instead of promoting it', async ({ request }) => {
  // Unchecked → a browser-session cookie. A browser sends back only name=value,
  // so middleware cannot see what kind of cookie it is renewing; the marker is
  // how the choice survives. This used to come back with Max-Age=2592000.
  const off = await rotate(request, { wathba_remember: '0' });
  const offSession = off.cookies.find((c) => c.startsWith('wathba_session='))!;
  expect(offSession, 'no rotation happened').toBeTruthy();
  expect(/Max-Age=\d+/.test(offSession), `«تذكرني» unchecked was promoted to persistent: ${offSession}`).toBe(false);

  // Checked → persistent, and it must stay persistent.
  const on = await rotate(request, { wathba_remember: '1' });
  const onSession = on.cookies.find((c) => c.startsWith('wathba_session='))!;
  expect(/Max-Age=\d+/.test(onSession), `«تذكرني» checked lost its persistence: ${onSession}`).toBe(true);

  // Absent → persistent. Sessions minted before the marker existed were all
  // persistent, so absence must keep meaning persistent — otherwise shipping the
  // marker signs out everyone who was already signed in, the moment they close
  // the browser. That is a worse bug than the one it fixes.
  const legacy = await rotate(request);
  const legacySession = legacy.cookies.find((c) => c.startsWith('wathba_session='))!;
  expect(/Max-Age=\d+/.test(legacySession), `a pre-marker session was downgraded: ${legacySession}`).toBe(true);
});

test('R3: a rejected refresh confiscates the ops session too, not just the public one', async ({ request }) => {
  // A refresh token the API will not honour. Middleware treats that as "this
  // credential is dead" and, on a protected path, clears the session and sends
  // the reader to sign in. The ops session is layered on the public one, so it
  // has to go with it — that teardown had no test until now.
  const pair = await freshTokens(request);
  const { res, cookies } = await rotate(
    request,
    { wathba_ops_session: 'ops-token-that-should-not-survive' },
    { accessToken: pair.accessToken, refreshToken: 'not-a-real-refresh-token' },
  );

  expect(res.status(), 'a dead refresh on a protected path must force re-auth').toBe(307);
  expect(res.headers()['location'], 'should be sent to sign-in with the destination preserved').toContain('/sign-in');

  // A deletion is a Set-Cookie with an empty value and an expiry in the past.
  const deleted = (name: string) =>
    cookies.some((c) => c.startsWith(`${name}=;`) || /Max-Age=0/.test(cookies.find((x) => x.startsWith(`${name}=`)) ?? ''));

  expect(deleted('wathba_session'), 'the dead session cookie was left in place').toBe(true);
  expect(deleted('wathba_refresh'), 'the dead refresh cookie was left in place').toBe(true);
  expect(
    deleted('wathba_ops_session'),
    'the ops session outlived the public credential that authorised it',
  ).toBe(true);
});
