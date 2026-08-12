import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { resolveProjectUuid } from '@/lib/api/resolve-project-uuid';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/** BFF → POST/DELETE /v1/discover/follows/:projectId (Batch ACCOUNT project follows). */
async function proxy(method: 'POST' | 'DELETE', projectRef: string): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json(null, { status: 401 });

  // The campaign page addresses projects by SLUG (/projects/nakhil-dates), so
  // that is what the follow control has in hand. The API takes a uuid and its
  // ParseUUIDPipe 400s on anything else. Resolved here rather than in the
  // component: the client should not have to know which of the two forms it
  // holds, and every caller would otherwise need the same branch.
  const projectId = await resolveProjectUuid(projectRef);
  if (!projectId) return NextResponse.json(null, { status: 404 });

  try {
    const res = await fetch(`${API_BASE}/v1/discover/follows/${projectId}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json(null, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(null, { status: 502 });
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return proxy('POST', (await params).projectId);
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return proxy('DELETE', (await params).projectId);
}
