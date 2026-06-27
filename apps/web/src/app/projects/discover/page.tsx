import type { Metadata } from 'next';

import { adaptApiVenture } from '@/components/ventures/wathba/wathba-data';
import { WathbaDiscover } from '@/components/ventures/wathba/wathba-discover';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { listVentures } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'استكشف · وثبة' };

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; sort?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const live = await listVentures();
  const projects = live
    ? live.map(adaptApiVenture).filter((p): p is NonNullable<typeof p> => p !== null)
    : undefined;
  return (
    <WathbaShell>
      <WathbaDiscover
        initialCat={sp.cat ?? 'all'}
        initialSort={sp.sort ?? 'trending'}
        initialStatus={sp.status ?? 'all'}
        projects={projects && projects.length > 0 ? projects : undefined}
      />
    </WathbaShell>
  );
}
