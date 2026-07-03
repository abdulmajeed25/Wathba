import type { Metadata } from 'next';

import { WathbaDashboardAnalytics } from '@/components/ventures/wathba/dashboard/wathba-dashboard-analytics';
import { getProjectAnalytics, getProjectDetail, getCreatorFollowers } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'التحليلات · وثبة' };
export const dynamic = 'force-dynamic';

/**
 * Creator analytics (Creator-CC / CC-16) + follower roster (CC-17). Owner-gating
 * is enforced on the API; the dashboard layout already blocks non-owners.
 */
export default async function DashboardAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const project = await getProjectDetail(id);
  const [analytics, followers] = await Promise.all([
    getProjectAnalytics(id),
    project ? getCreatorFollowers(project.createdBy) : Promise.resolve(null),
  ]);
  return <WathbaDashboardAnalytics analytics={analytics} followers={followers} />;
}
