'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import type { WathbaProject as WathbaProjectShape } from './wathba-data';
import { LEGACY_TAB_TO_ROUTE, resolveCampaign } from './wathba-campaign-shared';
import { WathbaRewards } from './wathba-rewards';
import { WathbaStory, WathbaStoryTOC } from './wathba-story';
import { Icon, Num } from './wathba-icons';

/**
 * TABS — the الحملة (story) tab content: 3-col TOC | story + risks |
 * creator card + rewards rail. Extracted from the pre-TABS CampaignTab.
 */
export function WathbaTabStory({
  id,
  project,
}: {
  id: string;
  project?: WathbaProjectShape;
}) {
  const { active, rich } = resolveCampaign(id, project);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '200px minmax(0, 1fr) 360px',
        gap: 36, alignItems: 'start',
      }}
    >
      <WathbaStoryTOC blocks={rich.story} />

      <article style={{ maxWidth: 720 }}>
        <WathbaStory blocks={rich.story} />

        {/* Risks section pinned to the bottom of the story column */}
        <div
          id="story-risks"
          style={{
            marginTop: 40, padding: 22,
            background: 'rgba(var(--ink-rgb),.04)',
            border: '1px solid rgba(var(--ink-rgb),.10)',
            borderRadius: 16,
          }}
        >
          <h2 style={{
            fontSize: 22, fontWeight: 700, marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Icon name="shield" size={20} color="var(--muted)" />
            {rich.risksTitle}
          </h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.85, color: 'var(--text-soft)' }}>
            {rich.risksBody}
          </p>
        </div>
      </article>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'sticky', top: 96 }}>
        <CreatorCard projectId={active.id} name={active.creator} loc={active.loc} />
        <WathbaRewards projectId={active.id} tiers={rich.rewards} />
      </div>
    </div>
  );
}

/**
 * TABS back-compat — the pre-TABS page deep-linked sections via #anchors and
 * ?tab=. Fragments never reach the server, so this client effect on the
 * story page maps every legacy anchor to its new sub-route. Mounted ONLY on
 * /projects/[id] (and /p/[slug]) — sub-routes never re-trigger it.
 */
export function WathbaLegacyTabRedirect({ id }: { id: string }) {
  const router = useRouter();
  useEffect(() => {
    const key = (
      window.location.hash.replace(/^#/, '') ||
      new URLSearchParams(window.location.search).get('tab') ||
      ''
    ).toLowerCase();
    const route = LEGACY_TAB_TO_ROUTE[key];
    if (route) router.replace(`/projects/${id}/${route}`);
  }, [id, router]);
  return null;
}

/* ────────────────────────── Creator card (shared with creator tab) ─────── */

export function CreatorCard({ projectId, name, loc }: { projectId: string; name: string; loc: string }) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.09)',
        borderRadius: 18, padding: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--grad)', color: 'var(--on-accent)',
            display: 'grid', placeItems: 'center',
            fontWeight: 700, fontSize: 17,
          }}
        >
          {name.trim().charAt(0)}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{name}</div>
          <Num style={{ fontSize: 11.5, color: 'var(--muted2)' }}>
            ٣ مشاريع · مبدع موثّق ✓
          </Num>
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 14 }}>
        فريق صغير شغوف من {loc} يبني فكرته الأولى على وثبة، ويحدّث الداعمين أسبوعياً
        بأدلّة موثّقة من خلف الكواليس.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <Link
          href={`/sign-in?next=${encodeURIComponent(`/projects/${projectId}`)}`}
          style={{
            flex: 1, textAlign: 'center',
            background: 'transparent',
            border: '1px solid rgba(var(--ink-rgb),.16)',
            color: 'var(--text)', fontWeight: 600, fontSize: 12.5,
            padding: '9px', borderRadius: 11, textDecoration: 'none',
          }}
        >
          متابعة
        </Link>
        <Link
          href={`/sign-in?next=${encodeURIComponent(`/projects/${projectId}/comments`)}`}
          style={{
            flex: 1, textAlign: 'center',
            background: 'transparent',
            border: '1px solid rgba(var(--ink-rgb),.16)',
            color: 'var(--text)', fontWeight: 600, fontSize: 12.5,
            padding: '9px', borderRadius: 11, textDecoration: 'none',
          }}
        >
          تواصل
        </Link>
      </div>
    </div>
  );
}
