import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Batch ACCOUNT / U5 — BFF for «متابعة المشروع».
 *
 * Resolves slug→uuid before proxying. A project has TWO public addresses: its
 * uuid and its slug, and pages use the slug (/projects/nakhil-dates) because
 * that is what belongs in a URL — while every mutating endpoint takes the uuid
 * behind a ParseUUIDPipe.
 *
 * That mismatch is not hypothetical: the follow control once shipped posting
 * `/api/.../nakhil-dates`, the API 400'd, and the optimistic update rolled
 * back — so the button flipped, flipped back, and wrote nothing. It looked like
 * a working UI until the row count was checked.
 */
async function resolveUuid(ref: string): Promise<string | null> {
  if (UUID.test(ref)) return ref;
  try {
    const r = await fetch(`${API_BASE}/v1/projects/${encodeURIComponent(ref)}`, {
      next: { revalidate: 3600 }, // slug→uuid is immutable for the project's life
    });
    if (!r.ok) return null;
    const b = (await r.json()) as { id?: string };
    return b.id && UUID.test(b.id) ? b.id : null;
  } catch {
    return null;
  }
}

async function proxy(method: 'POST' | 'DELETE', ref: string): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json(null, { status: 401 });
  const id = await resolveUuid(ref);
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
