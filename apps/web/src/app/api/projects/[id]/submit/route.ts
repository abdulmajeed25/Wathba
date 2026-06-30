import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * Browser proxy for the "submit for review" visibility transition.
 *
 *   POST /api/projects/:id/submit → POST /v1/projects/:id/submit
 *
 * Wathba's projects controller exposes /submit (DRAFT → UNDER_REVIEW) but
 * does NOT expose a public /publish or /unpublish — the actual DRAFT →
 * LIVE flip is admin-only via the internal service. So the dashboard's
 * "Publish" button just submits for admin review; the admin promotes it.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'auth required' }, { status: 401 });

  const apiRes = await fetch(`${API_BASE}/v1/projects/${id}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await apiRes.text();
  return new NextResponse(text, {
    status: apiRes.status,
    headers: { 'content-type': apiRes.headers.get('content-type') ?? 'application/json' },
  });
}
