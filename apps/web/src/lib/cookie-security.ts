/**
 * Whether the session cookies carry `Secure`.
 *
 * This used to be `process.env.NODE_ENV === 'production'` inline at three call
 * sites, and it silently killed every session on any HTTP-served deployment:
 *
 *   · `process.env.NODE_ENV` is INLINED AT BUILD TIME, and `next build` always
 *     sets it to production. So every production build emitted `Secure`
 *     cookies, and no runtime env could change that.
 *   · A browser refuses a `Secure` cookie over plain `http://`. Sign-in
 *     returned 303 as if it had worked, no cookie was stored, and `/api/me`
 *     answered 401 forever — the account icon never appeared.
 *   · `localhost` hid it completely: browsers treat it as a trustworthy origin
 *     and accept `Secure` cookies there. The e2e suite runs on localhost, so
 *     178 green tests said nothing about the deployment people actually browse.
 *
 * COOKIE_SECURE makes it an explicit, per-deployment decision read at RUNTIME:
 *
 *   unset → `Secure` in production builds (the previous behaviour, unchanged)
 *   "1"   → force `Secure`
 *   "0"   → omit `Secure`. ONLY for a box served over plain HTTP, e.g. a demo
 *           on a bare IP. NEVER set this where TLS terminates — it makes the
 *           session cookie readable on any downgraded request.
 *
 * Read inside the function, never captured at module scope, so the value is
 * whatever the running process has — the bug above was precisely a build-time
 * value masquerading as a runtime one.
 *
 * WHERE THE VALUE ACTUALLY COMES FROM, in precedence order — this surprises
 * people and cost an hour to pin down:
 *   1. the process environment (`COOKIE_SECURE=0 node …/server.js`) — wins;
 *   2. `.next/standalone/apps/web/.env`, which `next build` SNAPSHOTS from
 *      `apps/web/.env` at build time.
 * Editing `apps/web/.env` and restarting therefore changes NOTHING: the
 * standalone server reads its own frozen copy. Rebuild, or pass the variable
 * on the command line.
 */
let warned = false;

export function cookiesAreSecure(): boolean {
  const flag = process.env.COOKIE_SECURE;
  if (flag === '1') return true;
  if (flag === '0') {
    if (!warned) {
      warned = true;
      // Loud, once: this is a downgrade and it should never pass unnoticed.
      console.warn(
        '[cookie-security] COOKIE_SECURE=0 — session cookies are being issued WITHOUT the ' +
          'Secure flag. Correct only for an HTTP-only deployment; remove it the moment TLS lands.',
      );
    }
    return false;
  }
  return process.env.NODE_ENV === 'production';
}
