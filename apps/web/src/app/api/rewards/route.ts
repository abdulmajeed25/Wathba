import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * Generic reward-tier mutation proxy. POST / PATCH / DELETE forwarded to
 * /v1/projects/:projectId/reward-tiers[/:tierId] with the user's bearer.
 * The dashboard rewards page calls these from the client.
 *
 * Body shape: { op: 'create'|'update'|'delete', projectId, tierId?, data? }
 */
export async function POST(req: Request): Promise<Response> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'auth required' }, { status: 401 });

  const body = (await req.json()) as {
    op: 'create' | 'update' | 'delete';
    projectId: string;
    tierId?: string;
    data?: Record<string, unknown>;
  };

  const base = `${API_BASE}/v1/projects/${body.projectId}/reward-tiers`;
  let url = base;
  let method = 'POST';
  if (body.op === 'update') {
    if (!body.tierId) return NextResponse.json({ message: 'tierId required' }, { status: 400 });
    url = `${base}/${body.tierId}`;
    method = 'PATCH';
  } else if (body.op === 'delete') {
    if (!body.tierId) return NextResponse.json({ message: 'tierId required' }, { status: 400 });
    url = `${base}/${body.tierId}`;
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
