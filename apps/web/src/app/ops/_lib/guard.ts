import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { OPS_COOKIE } from '@/lib/ops-session';

/**
 * OPS Part 1 — server-side guards for the /ops route group.
 *
 * Middleware already gates the surface, but EVERY server component below
 * /ops re-checks here too (defense in depth: a soft client redirect emitted
 * by a page is not a gate; this helper issues real redirects during SSR and
 * refuses when the API can't confirm the role).
 *
 * Nothing in this file (or anywhere under app/ops) may be imported by the
 * public surface — the isolation scan in e2e enforces that.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
// One home for the name, in lib/ so the public sign-out can reach it too.
export { OPS_COOKIE };
export const SESSION_COOKIE = 'wathba_session';

/**
 * CLOSEOUT C5 — one identity probe per REQUEST, not per component.
 *
 * `requireAdmin()` is called by the /ops layout and again by every page and
 * nested server component beneath it — that is the intended defense in depth,
 * and it stays. What was not intended is that each call opened its own round
 * trip: a single board render spent three or four `users/me` calls, and a few
 * quick navigations were enough to exhaust the operator's own rate-limit bucket
 * and get them bounced off the surface (19-103 × HTTP 429 per e2e suite run).
 *
 * `cache()` is request-scoped memoization: identical calls within one render
 * collapse into one fetch, and nothing is shared across requests or users. The
 * check every component performs is unchanged — it is simply not re-asked.
 */
const probeIdentity = cache(async (token: string): Promise<{ ok: boolean; roles: string[] }> => {
  try {
    const r = await fetch(`${API_BASE}/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!r.ok) return { ok: false, roles: [] };
    const me = (await r.json()) as { roles?: string[] };
    return { ok: true, roles: me.roles ?? [] };
  } catch {
    return { ok: false, roles: [] }; // API unreachable → refuse, never degrade.
  }
});

/** Public-session ADMIN check — redirects away on any failure. */
export async function requireAdmin(): Promise<{ token: string }> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect('/sign-in?next=/ops');
  const { ok, roles } = await probeIdentity(token!);
  if (!ok || !roles.includes('ADMIN')) redirect('/projects');
  return { token: token! };
}

export interface OpsSessionInfo {
  // The live four-eyes state, auto-on at the 2nd money admin. Returned by
  // /v1/ops/auth/session all along and simply not declared here, so every
  // caller silently dropped it — which is how the vault badge ended up
  // hardcoding a state it never asked for.
  fourEyes: boolean;
  moneyAdmins: number;
  email: string;
  roles: string[];
  totpEnabled: boolean;
  totpRequired: boolean;
  totpPending: boolean;
  stepUpFresh: boolean;
  stepUpAt: string | null;
  enteredAt: string;
}

/** Request-scoped, for the same reason as `probeIdentity` above: the ops-session
 *  resolve is re-asked by every component that needs the token. The API still
 *  enforces the 60-minute idle window on each real call it receives. */
const resolveOpsSession = cache(async (opsToken: string): Promise<OpsSessionInfo | null> => {
  try {
    const r = await fetch(`${API_BASE}/v1/ops/auth/session`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    return r.ok ? ((await r.json()) as OpsSessionInfo) : null;
  } catch {
    return null;
  }
});

/** Resolve the SEPARATE ops session; dead/absent → back to the enter door. */
export async function requireOpsSession(): Promise<{ opsToken: string; info: OpsSessionInfo }> {
  const opsToken = (await cookies()).get(OPS_COOKIE)?.value;
  if (!opsToken) redirect('/ops/enter');
  const info = await resolveOpsSession(opsToken!);
  if (!info) redirect('/ops/enter');
  return { opsToken: opsToken!, info };
}
