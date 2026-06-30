import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * Browser proxy for the project resource. The settings page calls these
 * from the client so we can attach the bearer cookie without leaking it
 * into the URL. Only the project owner can PATCH; the API enforces.
 *
 *   GET    /api/projects/:id   → /v1/projects/:id   (public; no auth)
 *   PATCH  /api/projects/:id   → /v1/projects/:id   (owner-only)
 *
 * The PATCH body is forwarded verbatim — the API's UpdateProjectDto handles
 * partial fields, so the client sends only what changed.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const apiRes = await fetch(`${API_BASE}/v1/projects/${id}`, { cache: 'no-store' });
  const text = await apiRes.text();
  return new NextResponse(text, {
    status: apiRes.status,
    headers: { 'content-type': apiRes.headers.get('content-type') ?? 'application/json' },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'auth required' }, { status: 401 });

  const body = await req.text();
  const apiRes = await fetch(`${API_BASE}/v1/projects/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body,
  });
  const text = await apiRes.text();
  return new NextResponse(text, {
    status: apiRes.status,
    headers: { 'content-type': apiRes.headers.get('content-type') ?? 'application/json' },
  });
}
