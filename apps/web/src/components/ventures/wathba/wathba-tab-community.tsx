'use client';

import type { WathbaProject as WathbaProjectShape } from './wathba-data';
import { resolveCampaign } from './wathba-campaign-shared';
import { WathbaCommunityTab } from './wathba-community-tab';
import { Icon, Num } from './wathba-icons';

/**
 * TABS — المجتمع tab: real projects render the live geography +
 * new-vs-returning data; fixtures keep the demo stats.
 */
export function WathbaTabCommunity({ id, project }: { id: string; project?: WathbaProjectShape }) {
  const { active, isReal } = resolveCampaign(id, project);
  if (isReal) return <WathbaCommunityTab projectId={id} />;
  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 18 }}>المجتمع</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Stat label="إجمالي الداعمين" value={active.backersFmt} icon="favorite" />
        <Stat label="داعمون عائدون" value="42٪" icon="check_circle" />
        <Stat label="داعمون جدد" value="58٪" icon="lightbulb" />
        <Stat label="أكبر مساهم" value="24,000 ر.س" icon="workspace_premium" />
      </div>
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid rgba(var(--ink-rgb),.08)',
          borderRadius: 16, padding: 22,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>التوزيع الجغرافي</h3>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>
          62٪ من الداعمين من السعودية، 18٪ من الإمارات، 6٪ من قطر، 4٪ من الكويت،
          والباقي 10٪ موزّع على 14 دولة أخرى.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        borderRadius: 14, padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Icon name={icon} size={16} color="var(--accent)" />
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
      </div>
      <Num style={{ fontSize: 20, fontWeight: 700 }}>{value}</Num>
    </div>
  );
}
