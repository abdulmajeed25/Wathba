import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/** BFF → POST/DELETE /v1/discover/saved/:projectId (Batch DISC bookmarks). */
async function proxy(method: 'POST' | 'DELETE', projectId: string): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json(null, { status: 401 });
  try {
    const res = await fetch(`${API_BASE}/v1/discover/saved/${projectId}`, {
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
