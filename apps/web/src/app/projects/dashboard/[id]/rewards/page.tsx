import { listAddOns, listRewardTiers } from '@/lib/api/wathba';
import { DashboardRewardsManager } from '@/components/ventures/wathba/dashboard/wathba-dashboard-rewards-manager';

export default async function RewardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const [tiers, addons] = await Promise.all([listRewardTiers(id), listAddOns(id)]);
  return (
    <DashboardRewardsManager
      projectId={id}
      initialTiers={tiers ?? []}
      initialAddOns={addons ?? []}
    />
  );
}
