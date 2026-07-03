import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * BFF proxy → GET /v1/projects/:id/backers/export (Creator-CC / CC-03).
 * Streams the CSV straight through with its Content-Disposition so a plain
 * <a download> in the dashboard triggers a file save (cookie is httpOnly, so
 * the browser can't call the API directly — this proxy attaches the bearer).
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
    const res = await fetch(`${API_BASE}/v1/projects/${projectId}/backers/export${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: res.status === 403 ? 'forbidden' : 'export_failed' },
        { status: res.status },
      );
    }
    const body = await res.text();
    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': res.headers.get('content-type') ?? 'text/csv; charset=utf-8',
        'content-disposition':
          res.headers.get('content-disposition') ?? `attachment; filename="backers.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
