import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * Thin server-side proxy from the browser to /v1/search on the API.
 * Search is public so no auth-cookie forwarding needed; goes through a
 * Next route so the browser doesn't need CORS for the API.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const limit = url.searchParams.get('limit') ?? '20';
  // STAKES/L4 — optional narrowing filters, passed through verbatim.
  const cat = url.searchParams.get('cat') ?? '';
  const status = url.searchParams.get('status') ?? '';
  const extra =
    (cat ? `&cat=${encodeURIComponent(cat)}` : '') +
    (status ? `&status=${encodeURIComponent(status)}` : '');
  try {
    const res = await fetch(
      `${API_BASE}/v1/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}${extra}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return NextResponse.json({ items: [] }, { status: 200 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
