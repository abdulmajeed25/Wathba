import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/** STAKES/S-15 (H4) — contact-form proxy (anonymous-friendly). */
export async function POST(req: Request): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const body = await req.text();
  const r = await fetch(`${API_BASE}/v1/support`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
    cache: 'no-store',
  });
  const text = await r.text();
  return new NextResponse(text || '{}', {
    status: r.status,
    headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
  });
}
