import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';

/** STAKES/S-15 (E5) — active sessions list proxy. */
export async function GET(): Promise<Response> {
  const token = (await cookies()).get('wathba_session')?.value;
  if (!token) return NextResponse.json({ message: 'auth required' }, { status: 401 });
  const r = await fetch(`${API_BASE}/v1/users/me/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return new NextResponse(await r.text(), { status: r.status, headers: { 'content-type': 'application/json' } });
}
