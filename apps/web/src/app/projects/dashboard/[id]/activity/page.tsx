import type { Metadata } from 'next';

import { WathbaDashboardAuditTimeline } from '@/components/ventures/wathba/dashboard/wathba-dashboard-audit-timeline';

export const metadata: Metadata = { title: 'سجل النشاط · وثبة' };
export const dynamic = 'force-dynamic';

/**
 * Creator self-audit timeline (Creator-CC / CC-18). Owner-gating is enforced on
 * the API (GET /v1/projects/:id/audit); the layout already blocks non-owners.
 */
export default async function DashboardActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  return <WathbaDashboardAuditTimeline projectId={id} />;
}
