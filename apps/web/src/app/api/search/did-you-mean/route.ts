import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';

const EMPTY = { terms: [], categories: [], tags: [] };

/**
 * BFF proxy → the `suggestions` half of GET /v1/search.
 *
 * The results page runs on /v1/discover (facets + paging), which has no
 * did-you-mean of its own, so the zero state asks /v1/search for the
 * suggestions it already computes when IT finds nothing. One extra request, on
 * the one render where the reader has nothing else to look at.
 *
 * `limit=1` because the items are thrown away — only the suggestions are read.
 */
export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json(EMPTY);
  try {
    const res = await fetch(`${API_BASE}/v1/search?q=${encodeURIComponent(q)}&limit=1`, {
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json(EMPTY, { status: res.status });
    const j = (await res.json()) as { suggestions?: unknown };
    return NextResponse.json(j.suggestions ?? EMPTY);
  } catch {
    return NextResponse.json(EMPTY, { status: 502 });
  }
}
