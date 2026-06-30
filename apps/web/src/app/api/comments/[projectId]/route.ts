import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * GET  /api/comments/:projectId — proxies the public comments list (used by
 *      the client-side "تحميل المزيد" pagination on the project page).
 * POST /api/comments/:projectId — proxies a new comment (auth required).
 */

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await ctx.params;
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  try {
    const res = await fetch(
      `${API_BASE}/v1/projects/${projectId}/comments${qs ? `?${qs}` : ''}`,
      { cache: 'no-store' },
    );
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ message: 'upstream unavailable' }, { status: 502 });
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await ctx.params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'auth required' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'invalid JSON' }, { status: 400 });
  }

  try {
    const res = await fetch(`${API_BASE}/v1/projects/${projectId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ message: 'upstream unavailable' }, { status: 502 });
  }
}
