import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getMe } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'مقترَح لك · وثبة' };
export const dynamic = 'force-dynamic';

interface Rec { id: string; slug?: string | null; titleAr: string; shortDescAr?: string }

/**
 * Batch ACCOUNT §7.2 — «مقترَح لك».
 *
 * NOT a new recommender. GET /v1/discover/recommended already exists
 * (discover.controller.ts, `recommendedForUser`): LIVE projects in the
 * categories this reader has backed. This page gives that existing heuristic a
 * place to live, which is what it never had.
 *
 * Stated plainly because the batch asked: this is a heuristic over your own
 * backing history, not a learned model, and it holds no per-user profile.
 */
export default async function RecommendationsPage() {
  const me = await getMe();
  if (!me) redirect('/sign-in?next=%2Frecommendations');

  const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const { cookies } = await import('next/headers');
  const token = (await cookies()).get('wathba_session')?.value;
  let items: Rec[] = [];
  try {
    const res = await fetch(`${API_BASE}/v1/discover/recommended`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.ok) {
      const body = (await res.json()) as { items?: Rec[] } | Rec[];
      items = Array.isArray(body) ? body : body.items ?? [];
    }
  } catch { items = []; }

  return (
    <WathbaShell>
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '28px 16px 64px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>مقترَح لك</h1>
        <p style={{ fontSize: 13.5, color: 'var(--muted2)', marginBottom: 20, lineHeight: 1.8 }}>
          مشاريع نشطة في الفئات التي دعمتها. الاقتراح مبني على سجل دعمك وحده.
        </p>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px' }}>
            <p style={{ fontSize: 14, color: 'var(--muted2)', lineHeight: 1.9, margin: '0 0 14px' }}>
              لا اقتراحات بعد — ادعم مشروعاً أو احفظ ما يعجبك، وستظهر هنا مشاريع تشبهه.
            </p>
            <Link href="/projects/discover-all" style={{ display: 'inline-block', background: 'var(--grad)', color: 'var(--on-accent)', fontWeight: 700, fontSize: 14, padding: '10px 20px', borderRadius: 12, textDecoration: 'none' }}>
              اكتشف مشاريع
            </Link>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
            {items.map((p) => (
              <li key={p.id} style={{ border: '1px solid rgba(var(--ink-rgb),.1)', borderRadius: 12, padding: '14px 16px' }}>
                <Link href={`/projects/${encodeURIComponent(p.slug ?? p.id)}`} style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>
                  {p.titleAr}
                </Link>
                {p.shortDescAr && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted2)', lineHeight: 1.8 }}>{p.shortDescAr}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </WathbaShell>
  );
}
