import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';

/** STAKES/L1 — typeahead proxy: projects + creators + categories. Public. */
export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  try {
    const res = await fetch(`${API_BASE}/v1/search/suggest?q=${encodeURIComponent(q)}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ projects: [], creators: [], categories: [] });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ projects: [], creators: [], categories: [] });
  }
}
