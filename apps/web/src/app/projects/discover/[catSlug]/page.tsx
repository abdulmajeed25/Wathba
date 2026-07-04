import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { WathbaDiscoverCategory } from '@/components/ventures/wathba/wathba-discover-category';
import { getCategoryBySlug, listDiscover, type DiscoveryFilter } from '@/lib/api/wathba';

export const revalidate = 60; // ISR — filter states are shareable + cached.

const VALID: DiscoveryFilter[] = ['trending', 'nearly_funded', 'just_launched', 'near_you', 'staff_pick'];
function validFilter(f?: string): DiscoveryFilter | undefined {
  return VALID.includes(f as DiscoveryFilter) ? (f as DiscoveryFilter) : undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ catSlug: string }>;
}): Promise<Metadata> {
  const { catSlug } = await params;
  const cat = await getCategoryBySlug(catSlug);
  return {
    title: cat ? `${cat.nameAr} · استكشف · وثبة` : 'استكشف · وثبة',
    description: cat ? `اكتشف مشاريع ${cat.nameAr} على وثبة` : undefined,
  };
}

export default async function CategoryDiscoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ catSlug: string }>;
  searchParams: Promise<{ filter?: string; region?: string }>;
}) {
  const { catSlug } = await params;
  const sp = await searchParams;
  const cat = await getCategoryBySlug(catSlug);
  if (!cat) notFound();

  const filter = validFilter(sp.filter);
  const result = await listDiscover({ categorySlug: catSlug, filter, region: sp.region, take: 24 });

  return (
    <WathbaShell>
      <WathbaDiscoverCategory cat={cat} result={result} activeFilter={filter} />
    </WathbaShell>
  );
}
