import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/** BFF proxy → PATCH /v1/projects/:id/backers/:pledgeId/reward-status (CC-02). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string; pledgeId: string }> },
): Promise<Response> {
  const { projectId, pledgeId } = await params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json(null, { status: 401 });

  try {
    const res = await fetch(
      `${API_BASE}/v1/projects/${projectId}/backers/${pledgeId}/reward-status`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(await req.json()),
        cache: 'no-store',
      },
    );
    return NextResponse.json(await res.json().catch(() => null), { status: res.status });
  } catch {
    return NextResponse.json(null, { status: 502 });
  }
}
