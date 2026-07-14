import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * OPS Part 1 — shared plumbing for the /api/ops/* BFF proxies. The browser
 * never sees the raw ops token: it lives in the httpOnly `wathba_ops_session`
 * cookie, and these proxies translate cookie → `x-ops-token` header.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
export const OPS_COOKIE = 'wathba_ops_session';
export const SESSION_COOKIE = 'wathba_session';

/** Cookie lifetime = the API's ABSOLUTE cap (8h); the 60-min IDLE window is
 *  enforced server-side on every resolve — a stale cookie just 401s. */
export const OPS_COOKIE_MAX_AGE = 8 * 60 * 60;

export function opsCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: OPS_COOKIE_MAX_AGE,
  };
}

export async function opsToken(): Promise<string | undefined> {
  return (await cookies()).get(OPS_COOKIE)?.value;
}

/** Forward a JSON call to the ops surface with the session's x-ops-token. */
export async function proxyWithOpsToken(
  path: string,
  init: { method?: string; body?: string } = {},
): Promise<Response> {
  const token = await opsToken();
  if (!token) {
    return NextResponse.json({ message: 'مطلوب دخول صريح إلى مركز العمليات' }, { status: 401 });
  }
  const r = await fetch(`${API_BASE}${path}`, {
    method: init.method ?? 'POST',
    headers: { 'x-ops-token': token, 'content-type': 'application/json' },
    body: init.body,
    cache: 'no-store',
  });
  const text = await r.text();
  return new NextResponse(text || '{}', {
    status: r.status,
    headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
  });
}
