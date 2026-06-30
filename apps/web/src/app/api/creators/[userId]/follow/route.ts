import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * Thin proxy: follow / unfollow a creator. The wathba_session cookie is
 * httpOnly so the browser can't add the Bearer header itself — we forward
 * it here. Used by wathba-creator-tab.tsx.
 */
export async function POST(
  _req: Request,
  context: { params: Promise<{ userId: string }> },
): Promise<Response> {
  return forward('POST', context);
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ userId: string }> },
): Promise<Response> {
  return forward('DELETE', context);
}

async function forward(
  method: 'POST' | 'DELETE',
  context: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const { userId } = await context.params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  try {
    const res = await fetch(`${API_BASE}/v1/creators/${userId}/follow`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const body = await res.text();
    return new NextResponse(body || '{}', {
      status: res.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'upstream-failed' }, { status: 502 });
  }
}
