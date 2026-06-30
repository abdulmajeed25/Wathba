import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * Proxy:
 *   GET  → /v1/projects/:projectId/faq (public)
 *   POST → /v1/projects/:projectId/faq (creator-only)
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await ctx.params;
  try {
    const res = await fetch(`${API_BASE}/v1/projects/${projectId}/faq`, {
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json(null, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(null, { status: 502 });
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await ctx.params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  try {
    const res = await fetch(`${API_BASE}/v1/projects/${projectId}/faq`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: await req.text(),
      cache: 'no-store',
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
