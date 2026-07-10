'use client';

import type { WathbaProject as WathbaProjectShape } from './wathba-data';
import { resolveCampaign } from './wathba-campaign-shared';
import { WathbaFaq } from './wathba-faq';
import { Icon } from './wathba-icons';
import type { ApiFaqItem } from '@/lib/api/wathba';

/**
 * TABS — الأسئلة tab: real projects get the live Q&A component (list +
 * ask-a-question box for signed-in users); fixtures render the demo list.
 */
export function WathbaTabFaqs({ id, project }: { id: string; project?: WathbaProjectShape }) {
  const { active, rich, isReal } = resolveCampaign(id, project);
  if (isReal) {
    return (
      <WathbaFaq
        projectId={id}
        items={(rich.faqs ?? []).map<ApiFaqItem>((f, i) => ({
          id: `fixture-${i}`,
          projectId: id,
          questionAr: f.q,
          answerAr: f.a,
          sortOrder: i,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))}
        isAuthenticated={false}
      />
    );
  }
  void active;
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>الأسئلة الشائعة</h2>
      {rich.faqs.map((f, i) => (
        <details
          key={i}
          style={{
            background: 'var(--card)',
            border: '1px solid rgba(var(--ink-rgb),.08)',
            borderRadius: 14, padding: '14px 18px',
          }}
        >
          <summary
            style={{
              cursor: 'pointer', fontSize: 15, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 10,
              listStyle: 'none',
            }}
          >
            <Icon name="help" size={18} color="var(--accent)" />
            {f.q}
          </summary>
          <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--muted)', marginTop: 10, paddingInlineStart: 28 }}>
            {f.a}
          </p>
        </details>
      ))}
    </div>
  );
}
