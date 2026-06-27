import type { Metadata } from 'next';

import { adaptApiVenture } from '@/components/ventures/wathba/wathba-data';
import { WathbaSearch } from '@/components/ventures/wathba/wathba-search';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { listVentures } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'البحث · وثبة' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const live = await listVentures();
  const projects = live
    ? live.map(adaptApiVenture).filter((p): p is NonNullable<typeof p> => p !== null)
    : undefined;
  return (
    <WathbaShell>
      <WathbaSearch
        initialQ={sp.q ?? ''}
        projects={projects && projects.length > 0 ? projects : undefined}
      />
    </WathbaShell>
  );
}
