import type { Metadata } from 'next';

import { WathbaPledge } from '@/components/ventures/wathba/wathba-pledge';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getProjectDetail, listRewardTiers } from '@/lib/api/wathba';

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
  // Live project + tiers so the pledge posts real UUIDs to /v1/pledges.
  // Both return null for fixture slugs (p1…p8) — the component then falls
  // back to the demo fixtures and the submit path stays disabled-safe.
  const [detail, tiers] = await Promise.all([getProjectDetail(id), listRewardTiers(id)]);
  return (
    <WathbaShell>
      <WathbaPledge
        projectId={id}
        initialTier={sp.tier ?? 't2'}
        liveTiers={tiers}
        liveTitleAr={detail?.titleAr ?? null}
      />
    </WathbaShell>
  );
}
