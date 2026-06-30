import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * Browser proxy for the owner-only PATCH on `/v1/creators/:userId`. The
 * upstream Wathba API authenticates with a JwtAuthGuard + owner check; the
 * bearer lives in the httpOnly `wathba_session` cookie which the browser can't
 * forward itself, so we attach it here.
 *
 * Body shape: { bioAr?, websiteUrl?, collaborators? } — see ApiCreatorProfile
 * editor below for the exact contract the UI submits.
 */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const { userId } = await context.params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  try {
    const res = await fetch(`${API_BASE}/v1/creators/${userId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const text = await res.text();
    return new NextResponse(text || '{}', {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'upstream-failed' }, { status: 502 });
  }
}
