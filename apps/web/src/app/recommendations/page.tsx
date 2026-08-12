import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getMe } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'مقترَح لك · وثبة' };
export const dynamic = 'force-dynamic';

interface Rec { id: string; slug?: string | null; titleAr: string; shortDescAr?: string }

/**
 * Batch ACCOUNT / U5 — «مقترَح لك».
 *
 * NOT a new recommender. GET /v1/discover/recommended already exists and
 * returns LIVE projects in the categories this reader has backed. The audit
 * found the engine present and merely unlinked; this gives it the page it
 * never had.
 *
 * Stated plainly on the page because the batch asked: this is a heuristic over
 * your own backing history, not a learned model, and it builds no per-user
 * profile — the same PDPL posture as the rest of the platform.
 */
export default async function RecommendationsPage() {
  if (!(await getMe())) redirect('/sign-in?next=%2Frecommendations');
  const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const token = (await cookies()).get('wathba_session')?.value;

  let items: Rec[] = [];
  try {
    const res = await fetch(`${API_BASE}/v1/discover/recommended`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.ok) {
      const body = (await res.json()) as { items?: Rec[] } | Rec[];
      items = Array.isArray(body) ? body : (body.items ?? []);
    }
  } catch {
    items = [];
  }

  return (
    <WathbaShell>
      <section className="wathba-follow-page">
        <h1>مقترَح لك</h1>
        <p className="wathba-follow-lede">
          مشاريع نشطة في الفئات التي دعمتها. الاقتراح مبني على سجل دعمك وحده.
        </p>
        {items.length === 0 ? (
          <div className="wathba-follow-empty">
            <p>لا اقتراحات بعد — ادعم مشروعاً أو احفظ ما يعجبك، وستظهر هنا مشاريع تشبهه.</p>
            <Link href="/projects/discover-all">اكتشف مشاريع</Link>
          </div>
        ) : (
          <ul className="wathba-follow-list">
            {items.map((p) => (
              <li key={p.id}>
                <div>
                  <Link href={`/projects/${encodeURIComponent(p.slug ?? p.id)}`}>{p.titleAr}</Link>
                  {p.shortDescAr && <span>{p.shortDescAr}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </WathbaShell>
  );
}
