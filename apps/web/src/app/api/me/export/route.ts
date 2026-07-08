import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/** STAKES/E4 — PDPL right of access: proxy the full JSON export as a download. */
export async function GET(): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json(null, { status: 401 });
  try {
    const res = await fetch(`${API_BASE}/v1/users/me/export`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json(null, { status: res.status });
    const body = await res.text();
    return new NextResponse(body, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': 'attachment; filename="wathba-data-export.json"',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json(null, { status: 502 });
  }
}
