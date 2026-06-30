import { notFound } from 'next/navigation';

import { DashboardSettings } from '@/components/ventures/wathba/dashboard/wathba-dashboard-settings';
import { getProjectDetail } from '@/lib/api/wathba';

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
  const project = await getProjectDetail(id);
  if (!project) notFound();
  return <DashboardSettings project={project} />;
}
