import { getProjectDetail } from '@/lib/api/wathba';
import { DashboardOverview } from '@/components/ventures/wathba/dashboard/wathba-dashboard-overview';

export default async function DashboardOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const project = await getProjectDetail(id);
  return <DashboardOverview project={project} />;
}
