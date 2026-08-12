'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Batch ACCOUNT / U5 — «متابَعاتي».
 *
 * THREE tabs because there are three relations, and the whole point of the
 * batch is that they stop being one blurred idea:
 *
 *   مبدعون أتابعهم — CreatorFollow. Public, and it notifies.
 *   مشاريع أتابعها — ProjectFollow. Private, and it notifies.
 *   متابِعوني      — the same CreatorFollow read from the other side.
 *
 * Saved projects are NOT a tab here. A bookmark is not a follow, and putting it
 * beside these two would undo the distinction in the one screen built to teach
 * it. Saving lives at /saved.
 */

type Tab = 'creators' | 'projects' | 'followers';

const TABS: ReadonlyArray<{ key: Tab; labelAr: string }> = [
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
  followersCount?: number;
  createdProjectsCount?: number;
}

const EMPTY: Record<Tab, { copy: string; href: string; cta: string }> = {
  creators: {
    copy: 'لا تتابع أي مبدع بعد. متابعة المبدع تُعلمك عند إطلاقه مشروعاً جديداً.',
    href: '/projects', cta: 'تصفّح المشاريع',
  },
  projects: {
    copy: 'لا تتابع أي مشروع بعد. متابعة المشروع تُرسل لك تحديثاته وتذكيراً قبل انتهاء الحملة.',
    href: '/projects/discover-all', cta: 'اكتشف مشاريع',
  },
  followers: {
    copy: 'لا أحد يتابعك بعد. انشر مشروعاً أو شارك ملفك ليبدأ الناس بمتابعتك.',
    href: '/projects/start', cta: 'ابدأ مشروعك',
  },
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
   * Optimistic, with rollback. The row leaves immediately because that is what
   * the click MEANS; if the request fails it comes back, because a list that
   * silently keeps something you removed is worse than a slow one.
   */
  async function unfollow(row: Row): Promise<void> {
    if (!rows) return;
    const before = rows;
    setBusy(row.id);
    setRows(rows.filter((r) => r.id !== row.id));
    const url = tab === 'projects'
      ? `/api/project-follows/${encodeURIComponent(row.id)}`
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
    <section className="wathba-follow-page">
      <h1>متابَعاتي</h1>
      <p className="wathba-follow-lede">
        متابعة المبدع علاقة عامة تظهر في ملفه؛ متابعة المشروع اشتراك خاص بتحديثاته.
        الحفظ شيء ثالث — بلا إشعارات — وتجده في{' '}
        <Link href="/saved">المشاريع المحفوظة</Link>.
      </p>

      <div role="tablist" aria-label="متابَعاتي" className="wathba-follow-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'is-active' : undefined}
            onClick={() => setTab(t.key)}
          >
            {t.labelAr}
          </button>
        ))}
      </div>

      {rows === undefined && (
        <div aria-hidden className="wathba-follow-skeletons">
          <span /><span /><span />
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="wathba-follow-empty">
          <p>{empty.copy}</p>
          <Link href={empty.href}>{empty.cta}</Link>
        </div>
      )}

      {rows && rows.length > 0 && (
        <ul className="wathba-follow-list">
          {rows.map((r) => (
            <li key={r.id}>
              <div>
                <Link
                  href={tab === 'projects'
                    ? `/projects/${encodeURIComponent(r.slug ?? r.id)}`
                    : `/u/${encodeURIComponent(r.handle ?? r.id)}`}
                >
                  {r.titleAr ?? r.name}
                </Link>
                <span>
                  {tab === 'projects'
                    ? 'تصلك تحديثات هذا المشروع'
                    /* Latin digits, per the U3 decision. */
                    : `${r.createdProjectsCount ?? 0} مشاريع · ${r.followersCount ?? 0} متابِع`}
                </span>
              </div>
              {tab !== 'followers' && (
                <button type="button" onClick={() => unfollow(r)} disabled={busy === r.id}>
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
