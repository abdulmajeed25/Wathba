'use client';

import type { WathbaProject as WathbaProjectShape } from './wathba-data';
import { resolveCampaign } from './wathba-campaign-shared';
import { WathbaTransparency } from './wathba-transparency';

/** TABS — الشفافية tab: the live spending/escrow transparency dashboard. */
export function WathbaTabTransparency({ id, project }: { id: string; project?: WathbaProjectShape }) {
  const { active } = resolveCampaign(id, project);
  return <WathbaTransparency projectId={active.id} raisedFmt={active.raisedFmt} />;
}
