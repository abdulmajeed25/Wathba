import Image from 'next/image';
import Link from 'next/link';

import type { ApiHomePayload, ApiHomeProjectCard, ApiEditorialCard } from '@/lib/api/wathba';
import { WathbaCarousel } from './wathba-carousel';
import { WathbaHeroBanners } from './wathba-hero-banners';
import { Num } from './wathba-icons';

/**
 * Batch HOME — the magazine body (S1..S12, Kickstarter home parity, Wathba-
 * adapted). Sections render in ADMIN-DEFINED order (HomepageSection) and only
 * when they have data — the page stays complete with half the sections off.
 * Server component: project data ISR'd upstream; only the carousels/banners
 * hydrate. One h1 lives in WathbaHome above — everything here is h2/h3.
 */

/**
 * HOME-REVIEW — the magazine's sections as a key → renderer map.
 *
 * These used to render as one contiguous block BELOW everything in
 * wathba-home. They are now merged into that file's ordered list, so a
 * magazine section can sit between two code-defined ones — which is the whole
 * point: the proof (a featured project, campaigns closing, success stories)
 * belongs above the creator call-to-action, not after it.
 *
 * Order and activation still come from HomepageSection via GET /v1/home; this
 * only stops the block from being positionally welded to the bottom.
 */
export function wathbaMagazineRenderers(payload: ApiHomePayload): Record<string, () => React.ReactNode> {
  return {
    hero_banners: () =>
      payload.heroBanners.length > 0 ? <WathbaHeroBanners banners={payload.heroBanners} /> : null,
    featured_recommended: () =>
      payload.featured || payload.trending.length > 0 ? (
        <Section key="s2" k="featured_recommended" title="">
          <div className="wathba-mag-duo" style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 24 }}>
            {payload.featured && (
              <div>
                <SectionTitle>مشروع مميز</SectionTitle>
                <BigProjectCard p={payload.featured} />
              </div>
            )}
            {payload.trending.length > 0 && (
              <div>
                <SectionTitle>موصى بها لك</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {payload.trending.slice(0, 4).map((p) => (
                    <MiniProjectCard key={p.id} p={p} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      ) : null,
    announcements: () =>
      payload.announcements.length > 0 ? (
        <Section key="s3" k="announcements" title="">
          <div className="wathba-mag-duo" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {payload.announcements.map((c) => (
              <EditorialBanner key={c.id} c={c} />
            ))}
          </div>
        </Section>
      ) : null,
    collection_showcase: () =>
      payload.showcase ? (
        <Section key="s4" k="collection_showcase" title={`من حملات وثبة: ${payload.showcase.nameAr}`}>
          <div className="wathba-mag-duo" style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 24 }}>
            <BigProjectCard p={payload.showcase.featured} />
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>المزيد من الحملة</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {payload.showcase.grid.map((p) => (
                  <MiniProjectCard key={p.id} p={p} />
                ))}
              </div>
              <Link
                href={`/projects/discover-all?collection=${payload.showcase.slug}`}
                style={{ display: 'inline-block', marginTop: 8, padding: '6px 0', minHeight: 24, fontSize: 13, fontWeight: 700, color: 'var(--accent-ink)', textDecoration: 'none' }}
              >
                كل مشاريع الحملة ←
              </Link>
            </div>
          </div>
        </Section>
      ) : null,
    brand_program: () => (
      <Section key="s5" k="brand_program" title="">
        <div className="wathba-mag-duo" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ ...bannerCard, background: 'linear-gradient(130deg, rgba(5,166,97,.14), rgba(3,169,142,.04)), var(--card)' }}>
            <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>الفكرة تبدأ بإيمان</h3>
            <p style={{ fontSize: 13.5, color: 'var(--text-soft)', lineHeight: 1.7, marginBottom: 12 }}>
              وثبة منصة الدعم الجماعي السعودية بضمان التنفيذ: لا يُخصم ريال واحد قبل بلوغ الحملة
              عتبتها، وكل مبدع موثّق عبر نفاذ.
            </p>
            <Link href="/projects/about" style={bannerLink}>تعرّف على وثبة ←</Link>
          </div>
          {payload.programBanner ? (
            <EditorialBanner c={payload.programBanner} />
          ) : (
            <div style={bannerCard}>
              <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>صندوق دعم المشاريع الناشئة</h3>
              <p style={{ fontSize: 13.5, color: 'var(--text-soft)', lineHeight: 1.7 }}>قريباً.</p>
            </div>
          )}
        </div>
      </Section>
    ),
    home_stretch: () =>
      payload.homeStretch.length > 0 ? (
        <Section key="s6" k="home_stretch" title="على وشك الاكتمال" more="/projects/discover-all?pct=p75_100">
          <WathbaCarousel label="مشاريع على وشك الاكتمال">
            {payload.homeStretch.map((p) => (
              <CarouselProjectCard key={p.id} p={p} />
            ))}
          </WathbaCarousel>
        </Section>
      ) : null,
    success_stories: () =>
      payload.successStories.length > 0 ? (
        <Section key="s7" k="success_stories" title="قصص نجاح">
          <CardRow cards={payload.successStories} readMore />
        </Section>
      ) : null,
    creator_interviews: () =>
      payload.creatorInterviews.length > 0 ? (
        <Section key="s8" k="creator_interviews" title="حوارات مع المبدعين">
          <CardRow cards={payload.creatorInterviews} readMore />
        </Section>
      ) : null,
    fresh_favorites: () =>
      payload.freshFavorites.length > 0 ? (
        <Section key="s9" k="fresh_favorites" title="مفضلات جديدة" more="/projects/discover-all?sort=newest">
          <WathbaCarousel label="مفضلات جديدة">
            {payload.freshFavorites.map((p) => (
              <CarouselProjectCard key={p.id} p={p} />
            ))}
          </WathbaCarousel>
        </Section>
      ) : null,
    creators_corner: () =>
      payload.resources.length > 0 ? (
        <Section key="s10" k="creators_corner" title="ركن المبدعين">
          <div className="wathba-mag-duo" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {payload.resources.map((c) => (
              <EditorialBanner key={c.id} c={c} compact />
            ))}
          </div>
        </Section>
      ) : null,
    funding_tips: () =>
      payload.tips.length > 0 ? (
        <Section key="s11" k="funding_tips" title="نصائح التمويل الجماعي">
          <CardRow cards={payload.tips} />
        </Section>
      ) : null,
    trust_duo: () =>
      payload.trustGuides.length > 0 ? (
        <Section key="s12" k="trust_duo" title="">
          <div className="wathba-mag-duo" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {payload.trustGuides.map((c) => (
              <EditorialBanner key={c.id} c={c} />
            ))}
          </div>
        </Section>
      ) : null,
  };
}

/* ── building blocks ─────────────────────────────────────────────── */

function Section({ k, title, more, children }: { k: string; title: string; more?: string; children: React.ReactNode }) {
  return (
    <section
      data-section={k}
      style={{
        maxWidth: 1320, margin: '0 auto', padding: '0 26px',
        // POLISH — `content-visibility: auto` used to live here with
        // `contain-intrinsic-size: auto 420px`, to skip layout/paint for the
        // magazine sections until they neared the viewport.
        //
        // It was responsible for essentially ALL of the homepage's CLS. These
        // sections are 150–335px tall in reality, so every one of them
        // COLLAPSED from the 420px placeholder the moment it was scrolled into
        // view, dragging everything below it upwards. Measured: 0.0034 without
        // scrolling, 0.64 with — a single shift of 0.6414, and the page sat in
        // the "poor" band (>0.25) for as long as the directive was here.
        //
        // Tuning the placeholder cannot fix it: no single value fits a 150–335px
        // range, and per-section values would drift the first time copy or the
        // viewport changed. The render-skipping was worth less than the layout
        // stability it was spending, so it is gone. LCP was re-measured after
        // removal to confirm the cost did not simply move.
      }}
    >
      {title && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>{title}</h2>
          {more && (
            <Link href={more} style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-ink)', textDecoration: 'none', padding: '6px 0', display: 'inline-block' }}>
              اكتشف المزيد ←
            </Link>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>{children}</h2>;
}

function href(p: ApiHomeProjectCard): string {
  return p.slug ? `/p/${p.slug}` : `/projects/${p.id}`;
}

function ProjectArt({ p, height }: { p: ApiHomeProjectCard; height: number }) {
  return p.imageUrl ? (
    <div style={{ position: 'relative', height, borderRadius: 12, overflow: 'hidden' }}>
      <Image src={p.imageUrl} alt="" fill style={{ objectFit: 'cover' }} sizes="(max-width: 760px) 90vw, 400px" />
    </div>
  ) : (
    <div className="wathba-ph" style={{ height, borderRadius: 12 }} />
  );
}

function Funded({ p }: { p: ApiHomeProjectCard }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 5, borderRadius: 30, background: 'rgba(var(--ink-rgb),.08)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(p.fundedPct, 100)}%`, background: 'var(--grad-bar)', borderRadius: 30 }} />
      </div>
      <Num style={{ fontSize: 11.5, color: 'var(--accent-ink)', fontWeight: 700, display: 'inline-block', marginTop: 4 }}>
        {p.fundedPct}% مُموَّل
      </Num>
    </div>
  );
}

function BigProjectCard({ p }: { p: ApiHomeProjectCard }) {
  return (
    <Link href={href(p)} className="lift" style={{ ...cardBase, display: 'block' }}>
      <ProjectArt p={p} height={230} />
      <h3 style={{ fontSize: 17, fontWeight: 700, margin: '12px 0 6px' }}>{p.titleAr}</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{p.shortDescAr}</p>
      <Funded p={p} />
    </Link>
  );
}

function MiniProjectCard({ p }: { p: ApiHomeProjectCard }) {
  return (
    <Link href={href(p)} className="lift" style={{ ...cardBase, display: 'block', padding: 12 }}>
      <ProjectArt p={p} height={90} />
      <h3 style={{ fontSize: 13, fontWeight: 700, marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {p.titleAr}
      </h3>
      <Funded p={p} />
    </Link>
  );
}

function CarouselProjectCard({ p }: { p: ApiHomeProjectCard }) {
  return (
    <Link
      href={href(p)}
      className="lift"
      style={{ ...cardBase, display: 'block', flex: '0 0 260px', scrollSnapAlign: 'start' }}
    >
      <ProjectArt p={p} height={130} />
      <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {p.titleAr}
      </h3>
      <Funded p={p} />
    </Link>
  );
}

function cardLink(c: ApiEditorialCard): string | null {
  if (c.slug && c.bodyLongAr) return `/stories/${c.slug}`;
  return c.linkUrl ?? null;
}

function EditorialBanner({ c, compact }: { c: ApiEditorialCard; compact?: boolean }) {
  const link = cardLink(c);
  const inner = (
    <div style={{ ...bannerCard, minHeight: compact ? 120 : 150 }}>
      <h3 style={{ fontSize: compact ? 16 : 19, fontWeight: 700, marginBottom: 8 }}>{c.titleAr}</h3>
      <p style={{ fontSize: 13.5, color: 'var(--text-soft)', lineHeight: 1.7, marginBottom: link ? 12 : 0 }}>{c.bodyAr}</p>
      {link && <span style={bannerLink}>{c.linkLabelAr ?? 'اقرأ المزيد'} ←</span>}
    </div>
  );
  return link ? (
    <Link href={link} className="lift" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      {inner}
    </Link>
  ) : (
    inner
  );
}

function CardRow({ cards, readMore }: { cards: ApiEditorialCard[]; readMore?: boolean }) {
  return (
    <div className="wathba-mag-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {cards.map((c) => {
        const link = cardLink(c);
        const body = (
          <article style={{ ...cardBase, height: '100%' }}>
            <h3 style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 8, lineHeight: 1.5 }}>{c.titleAr}</h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65 }}>{c.bodyAr}</p>
            {readMore && link && (
              <span style={{ ...bannerLink, fontSize: 12.5, display: 'inline-block', marginTop: 10 }}>اقرأ المزيد ←</span>
            )}
          </article>
        );
        return link ? (
          <Link key={c.id} href={link} className="lift" style={{ textDecoration: 'none', color: 'inherit' }}>
            {body}
          </Link>
        ) : (
          <div key={c.id}>{body}</div>
        );
      })}
    </div>
  );
}

const cardBase: React.CSSProperties = {
  background: 'var(--card)', border: '1px solid rgba(var(--ink-rgb),.08)',
  borderRadius: 16, padding: 16, textDecoration: 'none', color: 'inherit',
};
const bannerCard: React.CSSProperties = {
  ...cardBase, padding: '22px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
};
/**
 * The banner links sat in a 20px line box — below the 24px minimum in WCAG 2.5.8
 * (AA). inline-flex + minHeight grows the target without moving the text: the
 * extra height is centred, so the banner's layout is unchanged and only the
 * hittable area grows. Measured before at 20px, after at 24px.
 */
const bannerLink: React.CSSProperties = {
  fontSize: 13.5, fontWeight: 700, color: 'var(--accent-ink)', textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center', minHeight: 24,
};
