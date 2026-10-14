import { notFound } from 'next/navigation';

import { DashboardSettings } from '@/components/ventures/wathba/dashboard/wathba-dashboard-settings';
import { getProjectDetailLive } from '@/lib/api/wathba';
import { CampaignChangeRequests } from '@/components/ventures/wathba/dashboard/campaign-change-requests';

/**
 * Creator Dashboard — "الإعدادات" (Settings). Server-fetches the project
 * (the layout already verified ownership) and hands the detail object to
 * the client form. The form mutates via the /api/projects/[id] proxy and
 * calls router.refresh() to re-render this server component.
 */
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const project = await getProjectDetailLive(id);
  if (!project) notFound();
  return <div className="space-y-6">
    {['LIVE', 'PAUSED'].includes(project.status) && <CampaignChangeRequests project={project} />}
    <DashboardSettings project={project} />
  </div>;
}
