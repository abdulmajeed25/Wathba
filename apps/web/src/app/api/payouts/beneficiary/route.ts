import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

async function proxy(method: 'GET' | 'PUT', body?: string): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'auth required' }, { status: 401 });
  const r = await fetch(`${API_BASE}/v1/payouts/beneficiary`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body ? { body } : {}),
    cache: 'no-store',
  });
  const text = await r.text();
  return new NextResponse(text || '{}', {
    status: r.status,
    headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
  });
}

export async function GET(): Promise<Response> {
  return proxy('GET');
}
export async function PUT(req: Request): Promise<Response> {
  return proxy('PUT', await req.text());
}
