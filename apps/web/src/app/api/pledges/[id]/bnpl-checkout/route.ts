import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';

/** Batch PAY — proxy for POST /v1/pledges/:id/bnpl/checkout. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const token = (await cookies()).get('wathba_session')?.value;
  if (!token) return NextResponse.json({ message: 'auth required' }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.text();
  const r = await fetch(`${API_BASE}/v1/pledges/${encodeURIComponent(id)}/bnpl/checkout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body || '{}',
    cache: 'no-store',
  });
  return new NextResponse(await r.text(), { status: r.status, headers: { 'content-type': 'application/json' } });
}
