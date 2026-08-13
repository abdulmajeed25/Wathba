import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { resolveProjectUuid } from '@/lib/api/resolve-project-uuid';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * BFF → GET /v1/discover/relations/:projectId — do I follow this, and have I
 * saved it? Both in one request, so the controls can render their real INITIAL
 * state instead of always starting "off" and inviting a reader to re-do what
 * they have already done.
 *
 * A signed-out reader gets a quiet {false,false} rather than a 401: the controls
 * are visible to everyone, and their resting state for a stranger IS off.
 */
export async function GET(_r: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ following: false, saved: false });
  const id = await resolveProjectUuid((await params).projectId);
  if (!id) return NextResponse.json({ following: false, saved: false });
  try {
    const res = await fetch(`${API_BASE}/v1/discover/relations/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ following: false, saved: false });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ following: false, saved: false });
  }
}
