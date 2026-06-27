import type { Metadata } from 'next';

import { WathbaPledge } from '@/components/ventures/wathba/wathba-pledge';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `ادعم ${id} · وثبة` };
}

export default async function ProjectBackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tier?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  return (
    <WathbaShell>
      <WathbaPledge projectId={id} initialTier={sp.tier ?? 't2'} />
    </WathbaShell>
  );
}
