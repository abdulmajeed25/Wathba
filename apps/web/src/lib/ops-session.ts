import { cookies } from 'next/headers';

/**
 * The ops session is layered ON TOP of the public one, so it must not outlive
 * it.
 *
 * What was wrong: signing out of the public site deleted `wathba_session` and
 * `wathba_refresh` and left `wathba_ops_session` untouched — cookie AND live
 * server-side session. Measured on the running build, after a normal sign-out
 * by an OWNER:
 *
 *   GET  /api/ops/auth/session                → 200, roleKeys ["OWNER"],
 *                                                permissions ["*"]
 *   GET  /api/ops/read/agents                 → 200, real operator data
 *   POST /api/ops/operations/<key>/dry-run    → 200, the registry evaluated it
 *
 * The /ops PAGES bounced to /sign-in, because middleware re-checks the public
 * session before it looks at the ops cookie — which is exactly why this read as
 * harmless. But the BFF proxies under /api/ops/* never made that check, so on a
 * shared machine the next person at the keyboard kept full operator reach
 * through fetch(), with no session of their own and nothing on screen to
 * suggest it.
 *
 * `revokeOpsSession` is the deliberate teardown: it revokes SERVER-SIDE first
 * and then drops the cookie. Dropping the cookie alone would leave a live ops
 * session behind a token that is merely out of sight, and this token outranks
 * the public one.
 *
 * This module is the single home for the cookie name — app/api/ops/_lib.ts and
 * app/ops/_lib/guard.ts both re-export it from here. It deliberately lives
 * under lib/ and not under app/ops: the public sign-out path has to reach it,
 * and the bundle-isolation scan in ops-hardening.spec.ts forbids the public
 * surface from importing anything under app/ops.
 */

export const OPS_COOKIE = 'wathba_ops_session';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * Revoke the ops session server-side, then drop its cookie. Safe to call when
 * there is no ops session — the overwhelmingly common case, since almost nobody
 * signing out is an operator.
 */
export async function revokeOpsSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(OPS_COOKIE)?.value;
  if (!token) return;
  try {
    await fetch(`${API_BASE}/v1/ops/auth/leave`, {
      method: 'POST',
      headers: { 'x-ops-token': token },
      cache: 'no-store',
    });
  } catch {
    // Best-effort, like the public sign-out's own revocation: if the API cannot
    // be reached the cookie still goes, and the session dies on its own 60-min
    // idle window. Never let this block a sign-out.
  }
  store.delete(OPS_COOKIE);
}
