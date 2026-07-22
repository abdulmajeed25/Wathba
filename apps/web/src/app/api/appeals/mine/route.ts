import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * OPS-GAPS R1 — appellant BFF for reading one's own appeals + statuses.
 *
 *   GET /api/appeals/mine → GET /v1/appeals/mine
 *
 * Bearer from the httpOnly session cookie. Powers the appellant surfaces so
 * they can show an existing appeal's status (and block a duplicate submit
 * client-side).
 */
export async function GET(): Promise<Response> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'auth required' }, { status: 401 });

  try {
    const apiRes = await fetch(`${API_BASE}/v1/appeals/mine`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const text = await apiRes.text();
    return new NextResponse(text, {
      status: apiRes.status,
      headers: { 'content-type': apiRes.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ message: 'upstream unreachable' }, { status: 502 });
  }
}
