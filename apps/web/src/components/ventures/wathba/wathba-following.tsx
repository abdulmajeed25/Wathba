'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Batch ACCOUNT §3.4 — «متابَعاتي».
 *
 * Three tabs because there are three relations, and the whole point of the
 * batch is that they stop being one blurred idea:
 *
 *   · مبدعون أتابعهم — CreatorFollow. Public, and it notifies.
 *   · مشاريع أتابعها — ProjectFollow. Private, and it notifies.
 *   · متابِعوني      — the same CreatorFollow read from the other side.
 *
 * Saved projects are NOT a tab here. A bookmark is not a follow, and putting
 * it beside these two would undo the distinction in the one screen built to
 * teach it. Saving lives at /saved.
 */

type Tab = 'creators' | 'projects' | 'followers';

const TABS: Array<{ key: Tab; labelAr: string }> = [
  { key: 'creators', labelAr: 'مبدعون أتابعهم' },
  { key: 'projects', labelAr: 'مشاريع أتابعها' },
  { key: 'followers', labelAr: 'متابِعوني' },
];

interface Row {
  id: string;
  name?: string;
  handle?: string | null;
  titleAr?: string;
  slug?: string | null;
  status?: string;
  followersCount?: number;
  createdProjectsCount?: number;
}

const EMPTY: Record<Tab, { copy: string; href: string; cta: string }> = {
  creators: { copy: 'لا تتابع أي مبدع بعد. متابعة مبدع تُعلمك عند إطلاقه مشروعاً جديداً.', href: '/projects', cta: 'تصفّح المشاريع' },
  projects: { copy: 'لا تتابع أي مشروع بعد. متابعة المشروع تُرسل لك تحديثاته وتذكيراً قبل انتهاء الحملة.', href: '/projects/discover-all', cta: 'اكتشف مشاريع' },
  followers: { copy: 'لا أحد يتابعك بعد. انشر مشروعاً أو شارك ملفك ليبدأ الناس بمتابعتك.', href: '/projects/start', cta: 'ابدأ مشروعك' },
};

export function WathbaFollowing() {
  const [tab, setTab] = useState<Tab>('creators');
  const [rows, setRows] = useState<Row[] | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(undefined);
    fetch(`/api/me/following?type=${tab}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: Row[] }) => alive && setRows(d.items ?? []))
      .catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, [tab]);

  /**
   * Optimistic, with rollback. The row disappears immediately because that is
   * what the click means; if the request fails it comes back, because a list
   * that silently keeps something you removed is worse than a slow one.
   */
  async function unfollow(row: Row) {
    if (!rows) return;
    const before = rows;
    setBusy(row.id);
    setRows(rows.filter((r) => r.id !== row.id));
    const url = tab === 'projects'
      ? `/api/projects/${encodeURIComponent(row.id)}/follow`
      : `/api/creators/${encodeURIComponent(row.id)}/follow`;
    try {
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setRows(before);
    } finally {
      setBusy(null);
    }
  }

  const empty = EMPTY[tab];

  return (
    <section style={{ maxWidth: 720, margin: '0 auto', padding: '28px 16px 64px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>متابَعاتي</h1>
      <p style={{ fontSize: 13.5, color: 'var(--muted2)', marginBottom: 18, lineHeight: 1.8 }}>
        متابعة المبدع علاقة عامة تظهر في ملفه؛ متابعة المشروع اشتراك خاص بتحديثاته. الحفظ شيء ثالث — بلا إشعارات — وتجده في <Link href="/saved" style={{ color: 'var(--accent-ink)' }}>المشاريع المحفوظة</Link>.
      </p>

      <div role="tablist" aria-label="متابَعاتي" style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(var(--ink-rgb),.1)', marginBottom: 14 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              padding: '9px 12px', fontSize: 14, fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? 'var(--accent-ink)' : 'var(--muted)',
              borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`,
            }}
          >
            {t.labelAr}
          </button>
        ))}
      </div>

      {rows === undefined && <div aria-hidden style={{ display: 'grid', gap: 8 }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ height: 62, borderRadius: 12, background: 'rgba(var(--ink-rgb),.06)' }} />)}
      </div>}

      {rows && rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '36px 16px' }}>
          <p style={{ fontSize: 14, color: 'var(--muted2)', lineHeight: 1.9, margin: '0 0 14px' }}>{empty.copy}</p>
          <Link href={empty.href} style={{ display: 'inline-block', background: 'var(--grad)', color: 'var(--on-accent)', fontWeight: 700, fontSize: 14, padding: '10px 20px', borderRadius: 12, textDecoration: 'none' }}>
            {empty.cta}
          </Link>
        </div>
      )}

      {rows && rows.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {rows.map((r) => (
            <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid rgba(var(--ink-rgb),.1)', borderRadius: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <Link
                  href={tab === 'projects' ? `/projects/${encodeURIComponent(r.slug ?? r.id)}` : `/u/${encodeURIComponent(r.handle ?? r.id)}`}
                  style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)', textDecoration: 'none', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {r.titleAr ?? r.name}
                </Link>
                <span style={{ fontSize: 12, color: 'var(--muted2)' }}>
                  {tab === 'projects'
                    ? 'تصلك تحديثات هذا المشروع'
                    : `${(r.createdProjectsCount ?? 0).toLocaleString('ar-SA')} مشاريع · ${(r.followersCount ?? 0).toLocaleString('ar-SA')} متابِع`}
                </span>
              </div>
              {tab !== 'followers' && (
                <button
                  type="button"
                  onClick={() => unfollow(r)}
                  disabled={busy === r.id}
                  style={{ border: '1px solid rgba(var(--ink-rgb),.14)', background: 'transparent', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 10, cursor: 'pointer' }}
                >
                  {tab === 'projects' ? 'إلغاء متابعة المشروع' : 'إلغاء المتابعة'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
