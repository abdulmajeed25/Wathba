import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { resolveProjectUuid } from '@/lib/api/resolve-project-uuid';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/** BFF → POST/DELETE /v1/discover/follows/:projectId — «متابعة المشروع». */
async function proxy(method: 'POST' | 'DELETE', ref: string): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json(null, { status: 401 });
  const id = await resolveProjectUuid(ref);
  if (!id) return NextResponse.json(null, { status: 404 });
  try {
    const res = await fetch(`${API_BASE}/v1/discover/follows/${id}`, {
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

export async function POST(_r: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return proxy('POST', (await params).projectId);
}
export async function DELETE(_r: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return proxy('DELETE', (await params).projectId);
}
