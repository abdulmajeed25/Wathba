import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

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
export const OPS_COOKIE = 'wathba_ops_session';
export const SESSION_COOKIE = 'wathba_session';

/** Public-session ADMIN check — redirects away on any failure. */
export async function requireAdmin(): Promise<{ token: string }> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect('/sign-in?next=/ops');
  let ok = false;
  try {
    const r = await fetch(`${API_BASE}/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (r.ok) {
      const me = (await r.json()) as { roles: string[] };
      ok = me.roles.includes('ADMIN');
    }
  } catch {
    ok = false; // API unreachable → refuse, never degrade, on this surface.
  }
  if (!ok) redirect('/projects');
  return { token: token! };
}

export interface OpsSessionInfo {
  email: string;
  roles: string[];
  totpEnabled: boolean;
  totpRequired: boolean;
  totpPending: boolean;
  stepUpFresh: boolean;
  stepUpAt: string | null;
  enteredAt: string;
}

/** Resolve the SEPARATE ops session; dead/absent → back to the enter door. */
export async function requireOpsSession(): Promise<{ opsToken: string; info: OpsSessionInfo }> {
  const opsToken = (await cookies()).get(OPS_COOKIE)?.value;
  if (!opsToken) redirect('/ops/enter');
  let info: OpsSessionInfo | null = null;
  try {
    const r = await fetch(`${API_BASE}/v1/ops/auth/session`, {
      headers: { 'x-ops-token': opsToken! },
      cache: 'no-store',
    });
    if (r.ok) info = (await r.json()) as OpsSessionInfo;
  } catch {
    info = null;
  }
  if (!info) redirect('/ops/enter');
  return { opsToken: opsToken!, info: info! };
}
