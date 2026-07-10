import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/** Batch HOME — browser proxies for `/v1/admin/editorial-cards/:id`. */
async function proxy(
  method: 'PATCH' | 'DELETE',
  req: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const { id } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'auth required' }, { status: 401 });
  const body = method === 'PATCH' ? await req.text() : undefined;
  const r = await fetch(`${API_BASE}/v1/admin/editorial-cards/${id}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body ? { body } : {}),
  });
  if (r.ok) revalidateTag('wathba-home');
  const text = await r.text();
  return new NextResponse(text || '{}', {
    status: r.status,
    headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return proxy('PATCH', req, ctx.params);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return proxy('DELETE', req, ctx.params);
}
