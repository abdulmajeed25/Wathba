import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * Public proxy for /v1/projects/:projectId/transparency.
 * Anonymous backers see the same view a creator sees — no auth needed.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await params;
  const r = await fetch(`${API_BASE}/v1/projects/${projectId}/transparency`, {
    next: { revalidate: 30 },
  });
  if (!r.ok) return NextResponse.json({ message: 'upstream error' }, { status: r.status });
  const data = await r.json();
  return NextResponse.json(data);
}
