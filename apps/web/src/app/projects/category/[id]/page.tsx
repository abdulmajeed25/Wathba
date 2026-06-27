import type { Metadata } from 'next';

import { adaptApiVenture } from '@/components/ventures/wathba/wathba-data';
import { WathbaCategory } from '@/components/ventures/wathba/wathba-category';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { listVentures } from '@/lib/api/wathba';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `فئة ${id} · وثبة` };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const live = await listVentures();
  const projects = live
    ? live.map(adaptApiVenture).filter((p): p is NonNullable<typeof p> => p !== null)
    : undefined;
  return (
    <WathbaShell>
      <WathbaCategory
        catId={id}
        projects={projects && projects.length > 0 ? projects : undefined}
      />
    </WathbaShell>
  );
}
