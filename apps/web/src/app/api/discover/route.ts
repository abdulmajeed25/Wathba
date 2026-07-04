import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * BFF proxy → GET /v1/projects (Batch CAT discovery). Public, forwards the
 * category/subcategory/filter/region/sort/cursor query string verbatim. Used by
 * the client mega-menu for the lazy "مشروع مميّز" featured card.
 */
export async function GET(req: Request): Promise<Response> {
  const qs = new URL(req.url).search;
  try {
    const res = await fetch(`${API_BASE}/v1/projects${qs}`, { next: { revalidate: 60 } });
    if (!res.ok) return NextResponse.json(null, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(null, { status: 502 });
  }
}
