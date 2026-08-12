'use client';

import type { WathbaProject as WathbaProjectShape } from './wathba-data';
import { resolveCampaign } from './wathba-campaign-shared';
import { CreatorCard } from './wathba-tab-story';
import { WathbaCreatorTab } from './wathba-creator-tab';

/**
 * TABS — المبدع tab: real projects render the live creator profile
 * (bio, verified badge, other projects, follow); fixtures keep the
 * demo creator card.
 */
export function WathbaTabCreator({ id, project }: { id: string; project?: WathbaProjectShape }) {
  const { active, isReal } = resolveCampaign(id, project);
  if (isReal && active.createdById) {
    return <WathbaCreatorTab userId={active.createdById} />;
  }
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <CreatorCard projectId={active.id} name={active.creator} loc={active.loc} />
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid rgba(var(--ink-rgb),.08)',
          borderRadius: 16, padding: 22,
        }}
      >
        <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>عن المبدع</h3>
        <p style={{ fontSize: 14, color: 'var(--text-soft)', lineHeight: 1.75 }}>
          فريق وثبة يتحقّق من هوية كل مبدع عبر «نفاذ» قبل نشر أي حملة. الفريق هنا
          أكمل خطوة التحقّق، له ثلاثة مشاريع سابقة، وله تقييم 4.8/5 من داعميه.
        </p>
      </div>
    </div>
  );
}
