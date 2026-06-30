import { ContestsManager } from '@/components/ventures/wathba/dashboard/wathba-dashboard-contests-manager';
import { listContests } from '@/lib/api/wathba';

export default async function ContestsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const initial = (await listContests(id)) ?? [];
  return <ContestsManager projectId={id} initial={initial} />;
}
