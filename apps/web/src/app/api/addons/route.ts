import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * Generic add-on mutation proxy — same shape as the rewards proxy.
 * Body: { op: 'create'|'update'|'delete', projectId, addOnId?, data? }
 */
export async function POST(req: Request): Promise<Response> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'auth required' }, { status: 401 });

  const body = (await req.json()) as {
    op: 'create' | 'update' | 'delete';
    projectId: string;
    addOnId?: string;
    data?: Record<string, unknown>;
  };

  const base = `${API_BASE}/v1/projects/${body.projectId}/addons`;
  let url = base;
  let method = 'POST';
  if (body.op === 'update') {
    if (!body.addOnId) return NextResponse.json({ message: 'addOnId required' }, { status: 400 });
    url = `${base}/${body.addOnId}`;
    method = 'PATCH';
  } else if (body.op === 'delete') {
    if (!body.addOnId) return NextResponse.json({ message: 'addOnId required' }, { status: 400 });
    url = `${base}/${body.addOnId}`;
    method = 'DELETE';
  }

  const apiRes = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body.op !== 'delete' ? { 'content-type': 'application/json' } : {}),
    },
    ...(body.op !== 'delete' ? { body: JSON.stringify(body.data ?? {}) } : {}),
  });
  const text = await apiRes.text();
  return new NextResponse(text, {
    status: apiRes.status,
    headers: { 'content-type': apiRes.headers.get('content-type') ?? 'application/json' },
  });
}
