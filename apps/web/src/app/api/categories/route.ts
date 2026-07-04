import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * BFF proxy → GET /v1/categories (Batch CAT). Public, cached — the client
 * mega-menu fetches the two-level tree here on mount.
 */
export async function GET(): Promise<Response> {
  try {
    const res = await fetch(`${API_BASE}/v1/categories`, { next: { revalidate: 300 } });
    if (!res.ok) return NextResponse.json(null, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(null, { status: 502 });
  }
}
