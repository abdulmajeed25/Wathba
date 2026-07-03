import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * BFF proxy → GET /v1/projects/:id/backers (Creator-CC / CC-02).
 * Forwards the roster filters/search/cursor query string; owner-gating +
 * READ-ONLY money semantics live on the API.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json(null, { status: 401 });

  const qs = new URL(req.url).search;
  try {
    const res = await fetch(`${API_BASE}/v1/projects/${projectId}/backers${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json(null, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(null, { status: 502 });
  }
}
