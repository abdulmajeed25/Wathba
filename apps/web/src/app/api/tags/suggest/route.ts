import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * BFF proxy → GET /v1/tags/suggest (Batch DISCOVERY-ENGINE). Public.
 *
 * `no-store`, unlike the categories proxy next to it: this is a typeahead, so
 * every request carries a different `q` and caching would only ever add a miss.
 */
export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  try {
    const res = await fetch(`${API_BASE}/v1/tags/suggest?q=${encodeURIComponent(q)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ items: [] }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ items: [] }, { status: 502 });
  }
}
