import { DashboardUpdatesComposer } from '@/components/ventures/wathba/dashboard/wathba-dashboard-updates-composer';
import { listProjectUpdates } from '@/lib/api/wathba';

/**
 * Per-project creator dashboard — Updates composer + list. SSR-fetches the
 * existing updates so the creator sees the current numbered series and the
 * composer adds the next #N on submit.
 */
export default async function UpdatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const page = await listProjectUpdates(id, { take: 50 });
  const items = page?.items ?? [];

  return <DashboardUpdatesComposer projectId={id} initial={items} />;
}
