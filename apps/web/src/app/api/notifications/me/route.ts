import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * Browser GET proxy for `/v1/notifications/me`. Used by the header bell
 * (which polls every 60s) so the httpOnly bearer cookie is exchanged for
 * a server-side Authorization header without ever touching the client.
 *
 * Anon callers get a quiet 401 so the bell can render nothing instead of
 * crashing.
 */
export async function GET(req: Request): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ items: [], unreadCount: 0 }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const qs = new URLSearchParams();
  if (searchParams.get('unread')) qs.set('unread', searchParams.get('unread')!);
  if (searchParams.get('take')) qs.set('take', searchParams.get('take')!);
  const path = `/v1/notifications/me${qs.toString() ? `?${qs.toString()}` : ''}`;
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const text = await r.text();
  return new NextResponse(text || '{"items":[],"unreadCount":0}', {
    status: r.status,
    headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
  });
}
