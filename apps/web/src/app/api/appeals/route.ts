import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * OPS-GAPS R1 — appellant BFF for submitting a moderation appeal.
 *
 *   POST /api/appeals → POST /v1/appeals
 *   body { kind:'ACCOUNT_BAN'|'PROJECT_REJECTION', subjectId, reasonAr }
 *
 * Uses the caller's bearer (a banned user carries a SUSPENDED-flagged session
 * token that grants only appeal access). The token lives in an httpOnly cookie
 * the browser can't read, so the appellant surfaces POST through here.
 */
export async function POST(req: Request): Promise<Response> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'auth required' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'invalid body' }, { status: 400 });
  }

  try {
    const apiRes = await fetch(`${API_BASE}/v1/appeals`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
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
