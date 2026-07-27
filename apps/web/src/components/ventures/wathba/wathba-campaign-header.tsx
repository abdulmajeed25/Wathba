'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { WathbaProject as WathbaProjectShape } from './wathba-data';
import { resolveCampaign } from './wathba-campaign-shared';
import { WathbaCampaignRail } from './wathba-campaign-rail';
import { Icon } from './wathba-icons';

/**
 * TABS — the PERSISTENT campaign header rendered by the (campaign) route
 * group layout: header strip (back link + badges + h1 + tagline), hero band
 * (video/gallery + sticky funding rail) and the trust band. It does not
 * re-render between tab navigations — only the content area below swaps.
 *
 * Extracted 1:1 from the pre-TABS one-page WathbaCampaign.
 */
export function WathbaCampaignHeader({
  id,
  project,
}: {
  id: string;
  project?: WathbaProjectShape;
}) {
  const { active, rich, isReal } = resolveCampaign(id, project);

  return (
    <div>
      {/* ── HEADER STRIP ──────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 26px 0' }}>
        <Link
          href="/projects/discover-all"
          style={{
            fontSize: 13, color: 'var(--muted)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            // STAKES/S-13 (M5) — ≥24px tap target.
            marginBottom: 10, padding: '4px 2px', minHeight: 24, textDecoration: 'none',
          }}
        >
          <Icon name="arrow_forward" size={17} /> اكتشف
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          {rich.weLoveBadge && (
            <span
              style={{
                fontSize: 11, fontWeight: 700,
                background: rich.weLoveBadge === 'بشراكة وثبة'
                  ? 'rgba(var(--purple-rgb),.10)'
                  : 'rgba(var(--accent-rgb),.10)',
                color: rich.weLoveBadge === 'بشراكة وثبة' ? 'var(--purple)' : 'var(--accent-ink)',
                border: `1px solid ${rich.weLoveBadge === 'بشراكة وثبة' ? 'rgba(var(--purple-rgb),.30)' : 'rgba(var(--accent-rgb),.30)'}`,
                padding: '4px 11px', borderRadius: 20,
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}
            >
              <Icon name="verified" size={12} color={rich.weLoveBadge === 'بشراكة وثبة' ? 'var(--purple)' : 'var(--accent)'} />
              {rich.weLoveBadge}
            </span>
          )}
          <span style={{
            fontSize: 12, fontWeight: 700,
            background: 'rgba(var(--ink-rgb),.05)',
            color: 'var(--muted)',
            padding: '4px 11px', borderRadius: 20,
          }}>{active.cat}</span>
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: 'var(--muted2)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Icon name="location_on" size={13} color="var(--muted2)" /> {active.loc}
          </span>
        </div>

        <h1 style={{
          fontSize: 42, fontWeight: 700, letterSpacing: '-1.1px',
          maxWidth: 880, marginBottom: 12,
        }}>
          {active.titleAr}
        </h1>
        <p style={{ fontSize: 18, color: 'var(--text-soft)', maxWidth: 820, lineHeight: 1.55 }}>
          {rich.tagline}
        </p>
      </section>

      {/* ── HERO BAND: gallery (8) + funding rail (4) ─────────────────── */}
      {/* S-13 (M5) — .wathba-hero-band stacks below 760px: the fixed 2-col
          grid squeezed the video column to a ~29px sliver on phones. */}
      <section
        className="wathba-hero-band"
        style={{
          maxWidth: 1320, margin: '0 auto',
          padding: '22px 26px 0',
          display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 28,
          alignItems: 'start',
        }}
      >
        <HeroMedia youtubeId={rich.youtubeId} alt={rich.heroImage.alt} />
        {/* S-13 — the rail gets the PAGE id, never the fixture-skin id. */}
        <WathbaCampaignRail
          projectId={isReal ? id : active.id}
          projectTitle={active.titleAr}
          raisedFmt={active.raisedFmt}
          goalFmt={active.goalFmt}
          pct={active.pct}
          pctW={active.pctW}
          pctColor={active.pctColor}
          barGrad={active.barGrad}
          backersFmt={active.backersFmt}
          daysLeft={active.daysLeft}
          goal={active.goal}
          releaseThresholdPct={active.releaseThresholdPct ?? 80}
        />
      </section>

      {/* ── TRUST BAND ─────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1320, margin: '36px auto 0', padding: '0 26px' }}>
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid rgba(var(--ink-rgb),.08)',
            borderRadius: 18, padding: '20px 24px',
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22,
          }}
        >
          <TrustCol
            icon="favorite"
            title="منصة تجمع المبدعين بالداعمين"
            body="مشاريع تختارها وثبة بعناية، يدعمها مجتمع يؤمن بفكرتها قبل أن تصبح منتجاً."
          />
          <TrustCol
            icon="query_stats"
            title="شفافية حيّة + تتبّع كل ريال"
            body="لوحة شفافية مباشرة على كل مشروع تُظهر بالضبط كيف يُنفَق التمويل، مرحلة بمرحلة."
          />
          <TrustCol
            icon="lightbulb"
            title="التحرير على مراحل · عتبة ٨٠٪"
            body="لا تُسحب الأموال إلا عند بلوغ ٨٠٪ من الهدف. يُصرف التمويل دفعات حسب المراحل."
          />
        </div>
      </section>
    </div>
  );
}

/* ────────────────────────── Hero media (video or img) ──────────────────── */

function HeroMedia({ youtubeId, alt }: { youtubeId: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      style={{
        aspectRatio: '16/9',
        borderRadius: 20, overflow: 'hidden',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        position: 'relative',
      }}
    >
      {loaded ? (
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
          title={alt}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ width: '100%', height: '100%', border: 0 }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          aria-label="تشغيل فيديو الحملة"
          style={{
            position: 'absolute', inset: 0, cursor: 'pointer',
            background: `url(https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg) center/cover, var(--ph-bg)`,
            border: 'none', fontFamily: 'inherit',
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,.55))',
            }}
          />
          <span
            style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 78, height: 78, borderRadius: '50%',
              background: 'rgba(0,0,0,.78)',
              color: 'white', fontSize: 36,
              display: 'grid', placeItems: 'center',
              boxShadow: '0 12px 40px rgba(0,0,0,.4)',
            }}
          >
            ▶
          </span>
          <span
            style={{
              position: 'absolute', bottom: 16, insetInlineStart: 18,
              color: 'white', fontSize: 13, fontWeight: 600,
              textShadow: '0 2px 8px rgba(0,0,0,.7)',
            }}
          >
            فيديو الحملة · ٢ دقيقة
          </span>
        </button>
      )}
    </div>
  );
}

/* ────────────────────────── Trust band column ──────────────────────────── */

function TrustCol({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div
        style={{
          width: 36, height: 36, borderRadius: 11,
          background: 'rgba(var(--accent-rgb),.10)',
          color: 'var(--accent-ink)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}
      >
        <Icon name={icon} size={20} color="var(--accent)" />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{title}</div>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>{body}</p>
      </div>
    </div>
  );
}
