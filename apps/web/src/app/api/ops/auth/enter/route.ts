import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { API_BASE, OPS_COOKIE, SESSION_COOKIE, opsCookieOptions } from '../../_lib';

/**
 * OPS Part 1 — «دخول إلى مركز العمليات». Exchanges the public ADMIN session
 * + a fresh password (+TOTP) for the SEPARATE ops session. The raw token is
 * moved straight into the httpOnly cookie and NEVER returned to client JS.
 */
export async function POST(req: Request): Promise<Response> {
  const jwt = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!jwt) return NextResponse.json({ message: 'auth required' }, { status: 401 });
  const body = await req.text();
  const r = await fetch(`${API_BASE}/v1/ops/auth/enter`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
    body,
    cache: 'no-store',
  });
  if (!r.ok) {
    const text = await r.text();
    return new NextResponse(text || '{}', {
      status: r.status,
      headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
    });
  }
  const out = (await r.json()) as { token: string; expiresAt: string; totpPending: boolean };
  const res = NextResponse.json({ ok: true, totpPending: out.totpPending, expiresAt: out.expiresAt });
  res.cookies.set(OPS_COOKIE, out.token, opsCookieOptions());
  return res;
}
