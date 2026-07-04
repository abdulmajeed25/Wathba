import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { WathbaDiscoverCategory } from '@/components/ventures/wathba/wathba-discover-category';
import { getCategoryBySlug, listDiscover, type DiscoveryFilter } from '@/lib/api/wathba';

export const revalidate = 60;

const VALID: DiscoveryFilter[] = ['trending', 'nearly_funded', 'just_launched', 'near_you', 'staff_pick'];
function validFilter(f?: string): DiscoveryFilter | undefined {
  return VALID.includes(f as DiscoveryFilter) ? (f as DiscoveryFilter) : undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ catSlug: string; subSlug: string }>;
}): Promise<Metadata> {
  const { catSlug, subSlug } = await params;
  const cat = await getCategoryBySlug(catSlug);
  const sub = cat?.children.find((c) => c.slug === subSlug);
  return {
    title: sub ? `${sub.nameAr} · ${cat!.nameAr} · وثبة` : 'استكشف · وثبة',
    description: sub ? `اكتشف مشاريع ${sub.nameAr} على وثبة` : undefined,
  };
}

export default async function SubcategoryDiscoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ catSlug: string; subSlug: string }>;
  searchParams: Promise<{ filter?: string; region?: string }>;
}) {
  const { catSlug, subSlug } = await params;
  const sp = await searchParams;
  const cat = await getCategoryBySlug(catSlug);
  if (!cat) notFound();
  const sub = cat.children.find((c) => c.slug === subSlug);
  if (!sub) notFound();

  const filter = validFilter(sp.filter);
  const result = await listDiscover({
    categorySlug: catSlug,
    subSlug,
    filter,
    region: sp.region,
    take: 24,
  });

  return (
    <WathbaShell>
      <WathbaDiscoverCategory cat={cat} sub={sub} result={result} activeFilter={filter} />
    </WathbaShell>
  );
}
