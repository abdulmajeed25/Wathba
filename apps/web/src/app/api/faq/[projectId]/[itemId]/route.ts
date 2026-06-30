import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

async function relay(
  method: 'PATCH' | 'DELETE',
  req: NextRequest,
  projectId: string,
  itemId: string,
): Promise<Response> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  try {
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      cache: 'no-store',
    };
    if (method !== 'DELETE') init.body = await req.text();
    const res = await fetch(
      `${API_BASE}/v1/projects/${projectId}/faq/${itemId}`,
      init,
    );
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ projectId: string; itemId: string }> },
): Promise<Response> {
  const { projectId, itemId } = await ctx.params;
  return relay('PATCH', req, projectId, itemId);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ projectId: string; itemId: string }> },
): Promise<Response> {
  const { projectId, itemId } = await ctx.params;
  return relay('DELETE', req, projectId, itemId);
}
