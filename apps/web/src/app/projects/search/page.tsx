import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { WathbaDiscoverAll } from '@/components/ventures/wathba/wathba-discover-all';
import { getDiscoverFacets, listDiscoverAll } from '@/lib/api/wathba';

/**
 * Batch SEARCH Part 3 — SEARCH PAGE = DISCOVER PAGE, unified: this route
 * renders the SAME WathbaDiscoverAll component + /v1/discover query layer
 * as /projects/discover-all; the only difference is that ?q= binds as one
 * more combinable, URL-encoded predicate (shareable, back/forward safe).
 */

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  return {
    title: q ? `${q} · البحث · وثبة` : 'البحث · وثبة',
    description: q
      ? `نتائج البحث عن «${q}» في مشاريع وثبة — مع تصفية متقدمة حسب الفئة والموقع والهدف.`
      : 'ابحث في كل مشاريع وثبة مع تصفية متقدمة حسب الفئة والموقع والهدف ونسبة التمويل.',
  };
}

const KEYS = ['q', 'status', 'includeEnded', 'cat', 'tag', 'hasVideo', 'duration', 'region', 'goalMin', 'goalMax', 'raisedMin', 'raisedMax', 'pct', 'only', 'collection', 'sort'] as const;

export default async function SearchPage({
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
  const [initial, facets] = await Promise.all([
    listDiscoverAll({ ...sp, take: '24' }),
    getDiscoverFacets(sp),
  ]);

  const safeInitial = initial ?? { items: [], total: 0, page: 0, take: 24, hasMore: false };

  return (
    <WathbaShell>
      <WathbaDiscoverAll initial={safeInitial} facets={facets} sp={sp} signedIn={signedIn} q={sp.q} />
    </WathbaShell>
  );
}
