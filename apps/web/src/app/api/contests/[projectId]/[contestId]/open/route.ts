import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ projectId: string; contestId: string }> },
): Promise<Response> {
  const { projectId, contestId } = await ctx.params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  try {
    const res = await fetch(
      `${API_BASE}/v1/projects/${projectId}/contests/${contestId}/open`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      },
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
