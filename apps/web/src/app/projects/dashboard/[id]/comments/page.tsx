import { DashboardCommentsManager } from '@/components/ventures/wathba/dashboard/wathba-dashboard-comments-manager';
import { listProjectComments } from '@/lib/api/wathba';

/**
 * Per-project creator dashboard — Comments moderation. SSR-fetches the latest
 * 50 top-level comments and hands them to the client manager component for
 * pin/hide/delete actions.
 */
export default async function CommentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const page = await listProjectComments(id, { take: 50 });
  const items = page?.items ?? [];

  return <DashboardCommentsManager projectId={id} initial={items} />;
}
