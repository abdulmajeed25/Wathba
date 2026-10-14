import { listAddOns, listRewardTiers } from '@/lib/api/wathba';
import { DashboardRewardsManager } from '@/components/ventures/wathba/dashboard/wathba-dashboard-rewards-manager';

export default async function RewardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const [tiers, addons] = await Promise.all([listRewardTiers(id), listAddOns(id)]);
  // A failed read is not an empty collection: preserve the retry path rather
  // than encouraging the owner to recreate rewards that already exist.
  if (tiers === null || addons === null) throw new Error('Unable to load campaign rewards');
  return (
    <DashboardRewardsManager
      projectId={id}
      initialTiers={tiers}
      initialAddOns={addons}
    />
  );
}
