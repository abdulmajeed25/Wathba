import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * Batch ACCOUNT — BFF for /following.
 *
 * `type` selects which of the THREE relations is being read. They are separate
 * upstream calls on purpose: creators, followed projects and followers are
 * different tables answering different questions, and collapsing them into one
 * response would recreate the very conflation this batch is undoing.
 */
export async function GET(req: Request): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json(null, { status: 401 });

  const type = new URL(req.url).searchParams.get('type') ?? 'creators';
  const path =
    type === 'projects' ? '/v1/discover/follows'
    : type === 'followers' ? '/v1/creators/me/followers'
    : '/v1/creators/me/following';

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ items: [] }, { status: 200 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ items: [] }, { status: 502 });
  }
}
