import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { categoryCount, categoryHref } from '@/components/ventures/wathba/wathba-categories';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { WathbaDiscoverAll } from '@/components/ventures/wathba/wathba-discover-all';
import { getDiscoverFacets, listCategories, listDiscoverAll } from '@/lib/api/wathba';

export const metadata: Metadata = {
  title: 'اكتشف · وثبة',
  description: 'اكتشف كل مشاريع وثبة مع تصفية متقدمة حسب الفئة والموقع والهدف ونسبة التمويل.',
};

const KEYS = ['status', 'includeEnded', 'cat', 'region', 'goalMin', 'goalMax', 'raisedMin', 'raisedMax', 'pct', 'only', 'collection', 'sort'] as const;

export default async function DiscoverAllPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const sp: Record<string, string | undefined> = {};
  for (const k of KEYS) {
    const v = raw[k];
    if (typeof v === 'string' && v) sp[k] = v;
  }

  const signedIn = Boolean((await cookies()).get('wathba_session')?.value);
  const [initial, facets, cats] = await Promise.all([
    listDiscoverAll({ ...sp, take: '24' }),
    getDiscoverFacets(sp),
    // HOME-REVIEW O4 — see the <nav> below.
    listCategories(),
  ]);

  const safeInitial = initial ?? { items: [], total: 0, page: 0, take: 24, hasMore: false };

  return (
    <WathbaShell>
      <WathbaDiscoverAll initial={safeInitial} facets={facets} sp={sp} signedIn={signedIn} />

      {/*
        HOME-REVIEW O4 — the discovery tree's server-rendered entry point.
        THE thing this fixes: the sitemap declared ~200 category and
        subcategory URLs and not one of them appeared in server-rendered HTML.
        They were built by the mega-menu and entered the DOM only on hover, so
        a crawler that does not execute JS — which includes some search-engine
        paths — could reach none of them, while the sitemap promised all of
        them.

        Only the TOP level is listed. Each category page already renders its own
        subcategories server-side (measured: 19 links on /projects/discover/art),
        so link-following reaches the whole tree from here; repeating ~200
        subcategory links on this page would add weight and no reach.

        This page, not the homepage: commit 607f810 made «اكتشف» THE discovery
        entry, and a complete category index is what that page is for. The
        homepage keeps its eight-chip strip, which is a design decision about
        rhythm rather than about crawlability.

        It is a real <nav><ul> of real <a href>s — server-rendered, no JS, no
        hover. That is the entire point; a client-rendered version of this list
        would restore the exact defect.
      */}
      {cats && cats.length > 0 && (
        <nav
          aria-label="كل الفئات"
          style={{ maxWidth: 1320, margin: '0 auto', padding: '8px 26px 56px' }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>تصفّح كل الفئات</h2>
          <ul
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              listStyle: 'none',
              padding: 0,
              margin: 0,
            }}
          >
            {cats.map((c) => (
              <li key={c.slug}>
                <Link
                  href={categoryHref(c.slug)}
                  style={{
                    // minHeight 32 clears the 24px floor A2 enforces.
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    minHeight: 32,
                    padding: '0 14px',
                    borderRadius: 999,
                    background: 'var(--card)',
                    border: '1px solid rgba(var(--ink-rgb),.10)',
                    color: 'inherit',
                    textDecoration: 'none',
                    fontSize: 13.5,
                    fontWeight: 600,
                  }}
                >
                  {c.nameAr}
                  <span style={{ fontSize: 12, color: 'var(--muted2)', fontWeight: 500 }}>
                    {categoryCount(c.liveCount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </WathbaShell>
  );
}
