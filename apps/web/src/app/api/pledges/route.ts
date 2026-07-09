import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/** Browser proxy for `POST /v1/pledges` — attaches the httpOnly bearer. */
export async function POST(req: Request): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'auth required' }, { status: 401 });
  const body = await req.text();
  const r = await fetch(`${API_BASE}/v1/pledges`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body,
    cache: 'no-store',
  });
  const text = await r.text();
  // STAKES/O1 — funnel event on a successful pledge (fire-and-forget).
  if (r.ok) {
    void fetch(`${API_BASE}/v1/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      // S-14 (I4) — referral attribution rides via the x-wathba-ref header
      // (the pledge DTO itself stays clean).
      body: JSON.stringify({
        name: 'pledge_completed',
        ...(req.headers.get('x-wathba-ref') ? { props: { ref: req.headers.get('x-wathba-ref') } } : {}),
      }),
      cache: 'no-store',
    }).catch(() => undefined);
  }
  return new NextResponse(text || '{}', {
    status: r.status,
    headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
  });
}
