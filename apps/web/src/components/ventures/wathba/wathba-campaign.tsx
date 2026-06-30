'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import {
  deriveLiveProject,
  type WathbaProject as WathbaProjectShape,
  wathbaProjects,
} from './wathba-data';
import { getRichCampaign } from './wathba-rich';
import { WathbaCampaignRail } from './wathba-campaign-rail';
import { WathbaComments } from './wathba-comments';
import { WathbaRewards } from './wathba-rewards';
import { WathbaStory, WathbaStoryTOC } from './wathba-story';
import { Icon, Num } from './wathba-icons';
import { useTabCounts } from '@/lib/hooks/use-tab-counts';

/**
 * Kickstarter-style campaign page.
 *
 * Layout:
 *   - Header strip (back link + cat·loc + H1 + tagline + we-love badge)
 *   - Hero band: gallery/video (8/12) + sticky funding rail (4/12)
 *   - Trust band (3 cols) — adapted to Wathba's model
 *   - Sticky tab bar — 8 tabs deep-linked via #anchors
 *   - Campaign tab body: 3-col TOC | story | creator+rewards
 *   - Rewards / Creator / FAQ / Updates / Comments / Community / Transparency
 *     / Risks tabs each render their own panel
 *
 * Public-by-default per M1 — all action buttons (back, post comment, etc.)
 * are auth-gated by the middleware via /sign-in?next=<orig> bounces.
 */

type TabId =
  | 'campaign' | 'rewards' | 'creator' | 'faq'
  | 'updates' | 'comments' | 'community' | 'transparency';

interface RichTabDef {
  id: TabId;
  label: string;
  icon: string;
  badge?: string;
}

export function WathbaCampaign({
  id,
  project,
}: {
  id: string;
  project?: WathbaProjectShape;
}) {
  const found = project ?? wathbaProjects.find((p) => p.id === id) ?? wathbaProjects[0]!;
  const active = deriveLiveProject(found);
  const rich = getRichCampaign(found.id, found.titleAr);
  const [tab, setTab] = useState<TabId>('campaign');

  // Live tab counts — overrides static fixture badges when the API responds.
  // Falls back silently to the fixture counts so the page never breaks.
  const live = useTabCounts(active.id);
  const tabs: RichTabDef[] = [
    { id: 'campaign',     label: 'الحملة',       icon: 'auto_stories' },
    { id: 'rewards',      label: 'المكافآت',     icon: 'redeem',  badge: String(live?.rewards ?? rich.rewards.length) },
    { id: 'creator',      label: 'المبدع',       icon: 'person' },
    { id: 'faq',          label: 'الأسئلة',      icon: 'help',    badge: String(live?.faq ?? rich.faqs.length) },
    { id: 'updates',      label: 'التحديثات',    icon: 'campaign', badge: String(live?.updates ?? rich.updates.length) },
    { id: 'comments',     label: 'التعليقات',    icon: 'forum',   badge: String(live?.comments ?? rich.comments.length) },
    { id: 'community',    label: 'المجتمع',      icon: 'category' },
    { id: 'transparency', label: 'الشفافية',     icon: 'query_stats' },
  ];

  // Allow deep-linking via location.hash on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const h = window.location.hash.replace(/^#/, '');
    if (h && tabs.find((t) => t.id === h)) setTab(h as TabId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {/* ── HEADER STRIP ──────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 26px 0' }}>
        <Link
          href="/projects/discover"
          style={{
            fontSize: 13, color: 'var(--muted)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginBottom: 14, textDecoration: 'none',
          }}
        >
          <Icon name="arrow_forward" size={17} /> استكشف
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          {rich.weLoveBadge && (
            <span
              style={{
                fontSize: 11, fontWeight: 700,
                background: rich.weLoveBadge === 'بشراكة وثبة'
                  ? 'rgba(var(--purple-rgb),.10)'
                  : 'rgba(var(--accent-rgb),.10)',
                color: rich.weLoveBadge === 'بشراكة وثبة' ? 'var(--purple)' : 'var(--accent)',
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
      <section
        style={{
          maxWidth: 1320, margin: '0 auto',
          padding: '22px 26px 0',
          display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 28,
          alignItems: 'start',
        }}
      >
        <HeroMedia youtubeId={rich.youtubeId} alt={rich.heroImage.alt} />
        <WathbaCampaignRail
          projectId={active.id}
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

      {/* ── STICKY TAB BAR + DEEP-LINK ANCHORS ────────────────────────── */}
      <TabsPrimitive.Root value={tab} onValueChange={(v) => { setTab(v as TabId); history.replaceState(null, '', `#${v}`); }}>
        <div
          style={{
            position: 'sticky', top: 0, zIndex: 30,
            background: 'var(--bg)',
            borderBottom: '1px solid rgba(var(--ink-rgb),.08)',
            marginTop: 36,
          }}
        >
          <div
            style={{
              maxWidth: 1320, margin: '0 auto', padding: '0 26px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <TabsPrimitive.List loop style={{ display: 'flex', gap: 18, overflowX: 'auto' }}>
              {tabs.map((t) => {
                const isActive = t.id === tab;
                return (
                  <TabsPrimitive.Trigger
                    key={t.id} value={t.id}
                    style={{
                      cursor: 'pointer', padding: '16px 4px',
                      background: 'transparent',
                      borderTop: 'none', borderInline: 'none',
                      borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                      color: isActive ? 'var(--accent)' : 'var(--muted)',
                      fontSize: 14.5, fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      whiteSpace: 'nowrap', fontFamily: 'inherit',
                    }}
                  >
                    <Icon name={t.icon} size={17} />
                    {t.label}
                    {t.badge && (
                      <Num style={{
                        fontSize: 11,
                        background: 'rgba(var(--ink-rgb),.08)',
                        color: 'var(--muted)',
                        padding: '2px 7px', borderRadius: 20,
                      }}>
                        {t.badge}
                      </Num>
                    )}
                  </TabsPrimitive.Trigger>
                );
              })}
            </TabsPrimitive.List>

            {/* secondary CTA pinned right of the tab bar */}
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(var(--ink-rgb),.16)',
                  color: 'var(--text)', fontFamily: 'inherit',
                  fontWeight: 600, fontSize: 12.5, padding: '8px 12px',
                  borderRadius: 11, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}
              >
                <Icon name="notifications" size={14} /> ذكّرني
              </button>
              <Link
                href={`/projects/${active.id}/back`}
                style={{
                  background: 'var(--grad)', color: 'var(--on-accent)',
                  fontWeight: 700, fontSize: 12.5, padding: '8px 14px',
                  borderRadius: 11, textDecoration: 'none',
                }}
              >
                ادعم المشروع
              </Link>
            </div>
          </div>
        </div>

        {/* ── TAB PANELS ───────────────────────────────────────────────── */}
        <section style={{ maxWidth: 1320, margin: '0 auto', padding: '36px 26px 80px' }}>
          <TabsPrimitive.Content value="campaign">
            <CampaignTab projectId={active.id} creatorName={active.creator} loc={active.loc} rich={rich} />
          </TabsPrimitive.Content>

          <TabsPrimitive.Content value="rewards">
            <div style={{ maxWidth: 820, margin: '0 auto' }}>
              <WathbaRewards projectId={active.id} tiers={rich.rewards} />
            </div>
          </TabsPrimitive.Content>

          <TabsPrimitive.Content value="creator">
            <CreatorTab projectId={active.id} name={active.creator} loc={active.loc} />
          </TabsPrimitive.Content>

          <TabsPrimitive.Content value="faq">
            <FaqTab faqs={rich.faqs} />
          </TabsPrimitive.Content>

          <TabsPrimitive.Content value="updates">
            <UpdatesTab updates={rich.updates} />
          </TabsPrimitive.Content>

          <TabsPrimitive.Content value="comments">
            <WathbaComments projectId={active.id} comments={rich.comments} />
          </TabsPrimitive.Content>

          <TabsPrimitive.Content value="community">
            <CommunityTab backers={active.backersFmt} />
          </TabsPrimitive.Content>

          <TabsPrimitive.Content value="transparency">
            <TransparencyTab raisedFmt={active.raisedFmt} />
          </TabsPrimitive.Content>
        </section>
      </TabsPrimitive.Root>
    </div>
  );
}

/* ────────────────────────── Campaign tab (3-col) ───────────────────────── */

function CampaignTab({
  projectId, creatorName, loc, rich,
}: {
  projectId: string; creatorName: string; loc: string;
  rich: ReturnType<typeof getRichCampaign>;
}) {
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
        <CreatorCard projectId={projectId} name={creatorName} loc={loc} />
        <WathbaRewards projectId={projectId} tiers={rich.rewards} />
      </div>
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
          color: 'var(--accent)',
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

/* ────────────────────────── Creator card + tab ─────────────────────────── */

function CreatorCard({ projectId, name, loc }: { projectId: string; name: string; loc: string }) {
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
          href={`/sign-in?next=${encodeURIComponent(`/projects/${projectId}#comments`)}`}
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

function CreatorTab({ projectId, name, loc }: { projectId: string; name: string; loc: string }) {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <CreatorCard projectId={projectId} name={name} loc={loc} />
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
          أكمل خطوة التحقّق، له ثلاثة مشاريع سابقة، وله تقييم ٤.٨/٥ من داعميه.
        </p>
      </div>
    </div>
  );
}

/* ────────────────────────── small tabs ────────────────────────────────── */

function FaqTab({ faqs }: { faqs: ReturnType<typeof getRichCampaign>['faqs'] }) {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>الأسئلة الشائعة</h2>
      {faqs.map((f, i) => (
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

function UpdatesTab({ updates }: { updates: ReturnType<typeof getRichCampaign>['updates'] }) {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 18 }}>تحديثات المبدع</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {updates.map((u) => (
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
                  color: 'var(--accent)',
                  display: 'inline-grid', placeItems: 'center',
                  fontSize: 13, fontWeight: 700,
                }}
              >
                #{u.n}
              </Num>
              <span style={{
                fontSize: 11, fontWeight: 700, color: 'var(--accent)',
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

function CommunityTab({ backers }: { backers: string }) {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 18 }}>المجتمع</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Stat label="إجمالي الداعمين" value={backers} icon="favorite" />
        <Stat label="داعمون عائدون" value="٤٢٪" icon="check_circle" />
        <Stat label="داعمون جدد" value="٥٨٪" icon="lightbulb" />
        <Stat label="أكبر مساهم" value="٢٤٬٠٠٠ ر.س" icon="workspace_premium" />
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
          ٦٢٪ من الداعمين من السعودية، ١٨٪ من الإمارات، ٦٪ من قطر، ٤٪ من الكويت،
          والباقي ١٠٪ موزّع على ١٤ دولة أخرى.
        </p>
      </div>
    </div>
  );
}

function TransparencyTab({ raisedFmt }: { raisedFmt: string }) {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Icon name="query_stats" size={22} color="var(--pos)" />
          <h2 style={{ fontSize: 24, fontWeight: 700 }}>لوحة الشفافية الحيّة</h2>
        </div>
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.65 }}>
          نوضّح بالضبط كيف يُنفَق كل ريال تدعمنا به. تُحدَّث اللوحة تلقائياً مع كل
          مرحلة من مراحل المشروع. لمزيد من التفاصيل (المراحل + جدول الصرف الزمني)،
          افتح صفحة الشفافية الكاملة من هنا.
        </p>
      </div>
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid rgba(var(--ink-rgb),.08)',
          borderRadius: 16, padding: 22,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>إجمالي المُجمَّع حتى الآن</span>
          <Num style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{raisedFmt}</Num>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          ميزانية المشروع موزّعة على ٤ بنود رئيسية: تصنيع وإنتاج (٤٨٪)، بحث وتطوير
          (٢٤٪)، شحن وتغليف (١٦٪)، تشغيل وتسويق (١٢٪).
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
