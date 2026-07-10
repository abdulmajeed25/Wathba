'use client';

import type { WathbaProject as WathbaProjectShape } from './wathba-data';
import { resolveCampaign } from './wathba-campaign-shared';
import { Num } from './wathba-icons';

/**
 * TABS — التحديثات tab (fixture projects only): the demo updates list.
 * Real projects render the live list server-side in the route page.
 */
export function WathbaTabUpdatesFixture({ id, project }: { id: string; project?: WathbaProjectShape }) {
  const { rich } = resolveCampaign(id, project);
  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 18 }}>تحديثات المبدع</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rich.updates.map((u) => (
          <article
            key={u.n}
            style={{
              background: 'var(--card)',
              border: '1px solid rgba(var(--ink-rgb),.08)',
              borderRadius: 16, padding: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <Num
                style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: 'rgba(var(--accent-rgb),.12)',
                  color: 'var(--accent-ink)',
                  display: 'inline-grid', placeItems: 'center',
                  fontSize: 13, fontWeight: 700,
                }}
              >
                #{u.n}
              </Num>
              <span style={{
                fontSize: 11, fontWeight: 700, color: 'var(--accent-ink)',
                background: 'rgba(var(--accent-rgb),.08)',
                border: '1px solid rgba(var(--accent-rgb),.20)',
                padding: '3px 10px', borderRadius: 20,
              }}>
                {u.tag}
              </span>
              <Num style={{ fontSize: 12, color: 'var(--muted2)', marginInlineStart: 'auto' }}>
                {u.date}
              </Num>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{u.title}</h3>
            <p style={{ fontSize: 14, color: 'var(--text-soft)', lineHeight: 1.75 }}>{u.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
