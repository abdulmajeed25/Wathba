import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * Thin proxy from the browser to /v1/payouts/me on the API. We can't expose
 * NEXT_PUBLIC_API_URL + bearer to the client (httpOnly cookie can't be read
 * from JS) — so we proxy. This is the pattern any future client-side hook
 * uses too.
 */
export async function GET(): Promise<Response> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json(null, { status: 401 });

  try {
    const res = await fetch(`${API_BASE}/v1/payouts/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json(null, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(null, { status: 502 });
  }
}
