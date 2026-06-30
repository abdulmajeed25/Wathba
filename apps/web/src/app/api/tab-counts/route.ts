import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Public proxy → /v1/projects/:id/tab-counts.
 * Browser-friendly fetch endpoint for the campaign-page tab badges.
 */
export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ message: 'projectId required' }, { status: 400 });
  }
  const r = await fetch(`${API_BASE}/v1/projects/${projectId}/tab-counts`, {
    next: { revalidate: 15 },
  });
  if (!r.ok) return NextResponse.json({ message: 'upstream error' }, { status: r.status });
  const data = await r.json();
  return NextResponse.json(data);
}
