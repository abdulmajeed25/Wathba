import type { Metadata } from 'next';

import { getProjectDetail } from '@/lib/api/wathba';
import { WathbaDashboardBackers } from '@/components/ventures/wathba/dashboard/wathba-dashboard-backers';

export const metadata: Metadata = { title: 'الداعمون · وثبة' };
export const dynamic = 'force-dynamic';

/**
 * Creator backer roster (Creator-CC / CC-02 + CC-03). Kickstarter Backer
 * Report parity: filter/search, per-pledge fulfillment status, bulk update,
 * and PDPL-scoped CSV export. Money stays read-only (CREATOR-NO-MONEY).
 */
export default async function DashboardBackersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const project = await getProjectDetail(id);
  const tiers = (project?.rewardTiers ?? [])
    .map((t) => ({ id: String(t.id ?? ''), titleAr: String(t.titleAr ?? '') }))
    .filter((t) => t.id);

  return (
    <WathbaDashboardBackers
      projectId={id}
      projectStatus={project?.status ?? 'DRAFT'}
      tiers={tiers}
    />
  );
}
