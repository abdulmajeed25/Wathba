import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';

/** STAKES/S-15 (E5) — revoke one session. */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const token = (await cookies()).get('wathba_session')?.value;
  if (!token) return NextResponse.json({ message: 'auth required' }, { status: 401 });
  const { id } = await ctx.params;
  const r = await fetch(`${API_BASE}/v1/users/me/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return new NextResponse(await r.text(), { status: r.status, headers: { 'content-type': 'application/json' } });
}
