import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * STAKES/O1 — event ingest proxy. Forwards the bearer when present so
 * authenticated events carry the userId (from the JWT, never the body).
 * Always 200s — analytics must never break a page.
 */
export async function POST(req: Request): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    await fetch(`${API_BASE}/v1/events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(await req.json().catch(() => ({}))),
      cache: 'no-store',
    });
  } catch {
    /* swallow */
  }
  return NextResponse.json({ ok: true });
}
