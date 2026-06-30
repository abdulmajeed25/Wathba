import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/** PATCH /api/comments/:projectId/:commentId/pin — toggle pinned (creator). */
export async function PATCH(
  _req: Request,
  ctx: { params: Promise<{ projectId: string; commentId: string }> },
): Promise<Response> {
  const { projectId, commentId } = await ctx.params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'auth required' }, { status: 401 });

  try {
    const res = await fetch(
      `${API_BASE}/v1/projects/${projectId}/comments/${commentId}/pin`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      },
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
