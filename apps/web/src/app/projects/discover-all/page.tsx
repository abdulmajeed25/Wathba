import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { WathbaDiscoverAll } from '@/components/ventures/wathba/wathba-discover-all';
import { getDiscoverFacets, listDiscoverAll } from '@/lib/api/wathba';

export const metadata: Metadata = {
  title: 'اكتشف · وثبة',
  description: 'استكشف كل مشاريع وثبة مع تصفية متقدمة حسب الفئة والموقع والهدف ونسبة التمويل.',
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
  const [initial, facets] = await Promise.all([
    listDiscoverAll({ ...sp, take: '24' }),
    getDiscoverFacets(sp),
  ]);

  const safeInitial = initial ?? { items: [], total: 0, page: 0, take: 24, hasMore: false };

  return (
    <WathbaShell>
      <WathbaDiscoverAll initial={safeInitial} facets={facets} sp={sp} signedIn={signedIn} />
    </WathbaShell>
  );
}
