import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * Batch ACCOUNT — Column B of the account menu: the creator's own projects,
 * plus whether they may start another and, if not, WHY.
 *
 * The "why" is computed here rather than in the menu because the rule has two
 * independent halves (one-active-project, and the cooldown after a terminal
 * one) and the client must never re-derive either. A create button that is
 * disabled without a reason is a dead click with extra steps.
 *
 * NON_TERMINAL is the real ProjectStatus enum — see docs/audits/ACCOUNT-AUDIT.md.
 */
const NON_TERMINAL = ['DRAFT', 'UNDER_REVIEW', 'SCHEDULED', 'LIVE', 'PAUSED', 'FUNDED', 'IN_PRODUCTION'];

interface MyProject {
  id: string;
  slug?: string | null;
  titleAr: string;
  status: string;
  mediaUrls?: string[];
  reviewFeedback?: string | null;
}

export async function GET(): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json(null, { status: 401 });
  try {
    const res = await fetch(`${API_BASE}/v1/projects/mine`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ items: [], canCreate: true }, { status: 200 });
    const body = (await res.json()) as { items?: MyProject[] };
    const items = body.items ?? [];

    const active = items.find((p) => NON_TERMINAL.includes(p.status));
    return NextResponse.json({
      items,
      canCreate: !active,
      // One sentence, already in Arabic, already naming the obstacle. The menu
      // renders this verbatim — it does not build a message from a status code.
      blockedReasonAr: active ? 'لديك مشروع نشط' : null,
      blockingProjectId: active?.id ?? null,
    });
  } catch {
    // A dead API must not make the menu claim the user has no projects — that
    // would render the "start your first project" invitation to someone who
    // has four. Null items = unknown, and the menu shows nothing rather than a lie.
    return NextResponse.json({ items: null, canCreate: false, blockedReasonAr: null }, { status: 200 });
  }
}
