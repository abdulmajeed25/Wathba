'use client';

import type { WathbaProject as WathbaProjectShape } from './wathba-data';
import { resolveCampaign } from './wathba-campaign-shared';
import { WathbaRewards } from './wathba-rewards';

/** TABS — المكافآت tab: the tier grid (CTAs deep-link to /back?tier=…). */
export function WathbaTabRewards({ id, project }: { id: string; project?: WathbaProjectShape }) {
  const { active, rich } = resolveCampaign(id, project);
  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <WathbaRewards projectId={active.id} tiers={rich.rewards} />
    </div>
  );
}
