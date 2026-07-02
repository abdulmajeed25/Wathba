import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/** Browser proxy for `DELETE /v1/bids/:bidId` — supplier withdraws a bid. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ bidId: string }> },
): Promise<Response> {
  const { bidId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'auth required' }, { status: 401 });
  const r = await fetch(`${API_BASE}/v1/bids/${bidId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const text = await r.text();
  return new NextResponse(text || '{}', {
    status: r.status,
    headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
  });
}
