import Image from 'next/image';
import Link from 'next/link';

import type { ApiEditorialCard, ApiHomeProjectCard, ApiSpotlightPayload } from '@/lib/api/wathba';

import { Icon, Num } from './wathba-icons';
import { HeroParallax, Reveal } from './wathba-motion';

/**
 * Batch POLISH Unit 1/2 — «تحت الأضواء» (/spotlight).
 *
 * EDITORIAL PRINCIPLE (the reason this page is shaped the way it is): every
 * section here selects on WHAT THE WORK HAS DONE — money raised, momentum,
 * editorial judgement, the story it can tell. None selects on who made it.
 * The old nav menu had a «مبدعات سعوديات» rail; it is deliberately gone, and
 * nothing identity-derived replaced it. The single inclusion rail
 * («أصحاب الهمم») keys off the project's own CATEGORY — a choice the creator
 * makes about their project — and is written about the projects, not about a
 * demographic.
 *
 * A note on the art direction: this dataset carries no cover imagery at all
 * (0 of 53 projects have mediaUrls), so the page is built to be beautiful
 * TYPOGRAPHICALLY — gradient washes, a large Arabic display voice, generous
 * rhythm — and to get better, not merely different, when photography lands.
 * Images render through next/image with explicit sizing whenever present, so
 * arrival costs no layout shift.
 *
 * Server component: no client JS is needed to render any of it.
 */

const MAX = 1320;

export function WathbaSpotlight({ data }: { data: ApiSpotlightPayload | null }) {
  // A total outage of the API is the only true empty state — individual empty
  // rails just don't render.
  if (!data || (!data.hero && data.biggest.length === 0)) return <SpotlightEmpty />;

  const { hero, biggest, staffPicks, inventive, inclusion, stories } = data;

  return (
    <div className="wathba-fade">
      {hero && <Hero p={hero} />}

      <Section
        id="biggest"
        eyebrow="الأداء"
        title="الأكبر والأنجح"
        lede="مشاريع بلغت أعلى تمويل وأقوى زخم على وثبة — من كل الفئات، دون استثناء."
        items={biggest}
      />
      <Section
        id="staff-picks"
        eyebrow="اختيار التحرير"
        title="مختارات وثبة"
        lede="يختارها فريق وثبة يدوياً: عمل نراه يستحق أن يُرى."
        items={staffPicks}
        premium
      />
      <Section
        id="inventive"
        eyebrow="الجسارة"
        title="إبداعات مميزة"
        lede="أعمال تجرّب شيئاً لم يُجرَّب بعد."
        items={inventive}
      />
      <Section
        id="inclusion"
        eyebrow="إتاحة"
        title="أصحاب الهمم"
        lede="مشاريع تبني أدوات ومنتجات وتجارب أكثر إتاحة للجميع."
        items={inclusion}
      />

      {stories.length > 0 && <Stories items={stories} />}

      <div style={{ maxWidth: MAX, margin: '0 auto', padding: '10px 26px 80px' }}>
        <Link
          href="/projects/discover-all"
          className="lift"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 9,
            padding: '14px 22px',
            borderRadius: 14,
            background: 'var(--cta-grad)',
            color: 'var(--on-accent)',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          <Icon name="explore" size={20} color="var(--on-accent)" />
          تصفّح كل المشاريع
        </Link>
      </div>
    </div>
  );
}

/* ───────────────────────── hero ───────────────────────── */

function Hero({ p }: { p: ApiHomeProjectCard }) {
  return (
    <section
      aria-labelledby="spotlight-hero-title"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(var(--ink-rgb),.07)',
        // Full-bleed: the wash runs edge to edge behind a contained column, so
        // the section reads cinematic without the text ever leaving the grid.
        background: 'var(--surface-0)',
        // Reserved so the wash and the entrance can never change the section's
        // height — the hero is the LCP element here and must not move.
        minHeight: 'clamp(430px, 46vw, 560px)',
        display: 'grid',
        alignItems: 'center',
      }}
    >
      {/* Decorative depth. Two brand-green washes plus a fine grain, drifting
          slowly on scroll — the art direction while this dataset has no
          photography at all. Sized in %, so it costs no layout. */}
      <HeroParallax>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(1200px 460px at 82% -12%, rgba(var(--accent-rgb),.24), transparent 68%),' +
              'radial-gradient(980px 420px at 6% 112%, rgba(var(--accent2-rgb),.18), transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.5,
            background:
              'repeating-linear-gradient(115deg, rgba(var(--ink-rgb),.028) 0 1px, transparent 1px 8px)',
          }}
        />
      </HeroParallax>
      <div
        style={{
          maxWidth: MAX,
          margin: '0 auto',
          padding: '72px 26px 64px',
          display: 'grid',
          gridTemplateColumns: p.imageUrl ? '1.05fr .95fr' : '1fr',
          gap: 40,
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
        className="wathba-spotlight-hero"
      >
        <div style={{ maxWidth: p.imageUrl ? undefined : 860 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '6px 13px',
              borderRadius: 30,
              background: 'rgba(var(--accent-rgb),.12)',
              color: 'var(--accent-ink)',
              fontSize: 12.5,
              fontWeight: 700,
              marginBottom: 18,
            }}
          >
            <Icon name="diamond" size={15} color="var(--accent)" />
            تحت الأضواء
          </div>

          <h1
            id="spotlight-hero-title"
            style={{
              fontSize: 'clamp(30px, 4.6vw, 54px)',
              lineHeight: 1.12,
              fontWeight: 700,
              margin: '0 0 16px',
            }}
          >
            {p.titleAr}
          </h1>

          {p.shortDescAr && (
            <p
              style={{
                fontSize: 'clamp(15px, 1.5vw, 18.5px)',
                lineHeight: 1.75,
                color: 'var(--muted)',
                margin: '0 0 26px',
                maxWidth: 640,
              }}
            >
              {p.shortDescAr}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', marginBottom: 28 }}>
            <Stat value={`${p.fundedPct}%`} label="مُموَّل" />
            <Divider />
            <Stat value={String(p.backersCount)} label="داعم" />
          </div>

          <Link
            href={hrefOf(p)}
            className="lift"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              padding: '15px 26px',
              borderRadius: 15,
              background: 'var(--cta-grad)',
              color: 'var(--on-accent)',
              fontWeight: 700,
              fontSize: 15.5,
              textDecoration: 'none',
            }}
          >
            شاهد المشروع
            <Icon name="arrow_back" size={19} color="var(--on-accent)" />
          </Link>
        </div>

        {p.imageUrl && (
          <div
            style={{
              position: 'relative',
              aspectRatio: '4 / 3',
              borderRadius: 22,
              overflow: 'hidden',
              boxShadow: 'var(--card-shadow-h)',
            }}
          >
            <Image
              src={p.imageUrl}
              alt=""
              fill
              priority
              sizes="(max-width: 980px) 92vw, 560px"
              style={{ objectFit: 'cover' }}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <Num style={{ fontSize: 27, fontWeight: 700, color: 'var(--text)' }}>{value}</Num>
      <div style={{ fontSize: 12.5, color: 'var(--muted2)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 34, background: 'rgba(var(--ink-rgb),.12)' }} />;
}

/* ─────────────────────── sections ─────────────────────── */

function Section({
  id,
  eyebrow,
  title,
  lede,
  items,
  premium,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede: string;
  items: ApiHomeProjectCard[];
  premium?: boolean;
}) {
  // "Every section renders only when it has data" — an empty rail is worse than
  // no rail, so this returns nothing rather than an apologetic placeholder.
  if (items.length === 0) return null;

  const [lead, ...rest] = items;

  return (
    <Reveal
      as="section"
      id={id}
      // scroll-margin so the sticky header never covers the heading when the nav
      // menu deep-links to #id.
      style={{ scrollMarginTop: 90, padding: '58px 0', ...(premium ? { background: 'var(--band)' } : {}) }}
      aria-labelledby={`${id}-title`}
    >
      <div style={{ maxWidth: MAX, margin: '0 auto', padding: '0 26px' }}>
        <div style={{ marginBottom: 26, maxWidth: 720 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '1.4px',
              color: 'var(--accent-ink)',
              marginBottom: 9,
            }}
          >
            {eyebrow}
          </div>
          <h2
            id={`${id}-title`}
            style={{ fontSize: 'clamp(23px, 2.6vw, 33px)', fontWeight: 700, margin: '0 0 10px' }}
          >
            {title}
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--muted)', margin: 0 }}>{lede}</p>
        </div>

        {/* Magazine rhythm: one lead card carrying the section, the rest in a
            calmer grid beside it. Falls back to a plain grid on one item. */}
        <div
          className="wathba-spotlight-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: rest.length > 0 ? '1.15fr 1fr' : '1fr',
            gap: 22,
            alignItems: 'start',
          }}
        >
          {lead && <LeadCard p={lead} />}
          {rest.length > 0 && (
            <div style={{ display: 'grid', gap: 14 }}>
              {rest.map((p) => (
                <RowCard key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Reveal>
  );
}

function LeadCard({ p }: { p: ApiHomeProjectCard }) {
  return (
    <Link
      href={hrefOf(p)}
      className="lift"
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <Art p={p} ratio="16 / 9" />
      <div style={{ padding: '18px 20px 20px' }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', lineHeight: 1.35 }}>{p.titleAr}</h3>
        {p.shortDescAr && (
          <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--muted)', margin: '0 0 12px' }}>
            {p.shortDescAr}
          </p>
        )}
        <Funded p={p} />
      </div>
    </Link>
  );
}

function RowCard({ p }: { p: ApiHomeProjectCard }) {
  return (
    <Link
      href={hrefOf(p)}
      className="lift"
      style={{
        display: 'grid',
        gridTemplateColumns: '104px 1fr',
        gap: 14,
        alignItems: 'center',
        textDecoration: 'none',
        color: 'inherit',
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        borderRadius: 15,
        padding: 12,
      }}
    >
      <Art p={p} ratio="4 / 3" radius={11} />
      <div style={{ minWidth: 0 }}>
        <h3 style={{ fontSize: 15.5, fontWeight: 700, margin: '0 0 6px', lineHeight: 1.4 }}>{p.titleAr}</h3>
        <Funded p={p} compact />
      </div>
    </Link>
  );
}

/** Sized by aspect-ratio in both branches, so a late image costs no shift. */
function Art({ p, ratio, radius = 0 }: { p: ApiHomeProjectCard; ratio: string; radius?: number }) {
  return (
    <div style={{ position: 'relative', aspectRatio: ratio, borderRadius: radius, overflow: 'hidden' }}>
      {p.imageUrl ? (
        <Image
          src={p.imageUrl}
          alt=""
          fill
          loading="lazy"
          sizes="(max-width: 760px) 92vw, 520px"
          style={{ objectFit: 'cover' }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(135deg, rgba(var(--accent-rgb),.16), rgba(var(--accent2-rgb),.10) 60%, rgba(var(--ink-rgb),.04))',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Icon name="rocket_launch" size={26} color="rgba(var(--accent-rgb),.55)" />
        </div>
      )}
    </div>
  );
}

function Funded({ p, compact }: { p: ApiHomeProjectCard; compact?: boolean }) {
  const pct = Math.min(p.fundedPct, 100);
  return (
    <div>
      <div
        style={{ height: compact ? 4 : 6, borderRadius: 30, background: 'rgba(var(--ink-rgb),.08)', overflow: 'hidden' }}
        role="progressbar"
        aria-valuenow={p.fundedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`نسبة التمويل ${p.fundedPct}%`}
      >
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--grad-bar)', borderRadius: 30 }} />
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginTop: 5 }}>
        <Num style={{ fontSize: 12, color: 'var(--accent-ink)', fontWeight: 700 }}>{p.fundedPct}% مُموَّل</Num>
        <Num style={{ fontSize: 11.5, color: 'var(--muted2)' }}>{p.backersCount} داعم</Num>
      </div>
    </div>
  );
}

/* ──────────────────────── stories ─────────────────────── */

function Stories({ items }: { items: ApiEditorialCard[] }) {
  return (
    <Reveal as="section" id="stories" style={{ scrollMarginTop: 90, padding: '58px 0' }} aria-labelledby="stories-title">
      <div style={{ maxWidth: MAX, margin: '0 auto', padding: '0 26px' }}>
        <div style={{ marginBottom: 26, maxWidth: 720 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '1.4px', color: 'var(--accent-ink)', marginBottom: 9 }}>
            من الفكرة إلى الواقع
          </div>
          <h2
            id="stories-title"
            style={{ fontSize: 'clamp(23px, 2.6vw, 33px)', fontWeight: 700, margin: '0 0 10px' }}
          >
            قصص ملهمة
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--muted)', margin: 0 }}>
            مشاريع بدأت كفكرة على وثبة ووصلت إلى أيدي داعميها.
          </p>
        </div>

        <div className="wathba-spotlight-stories" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {items.slice(0, 3).map((c) => (
            <Link
              key={c.id}
              href={`/stories/${c.slug}`}
              className="lift"
              style={{
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
                background: 'var(--card)',
                border: '1px solid rgba(var(--ink-rgb),.08)',
                borderRadius: 18,
                overflow: 'hidden',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div style={{ position: 'relative', aspectRatio: '16 / 10', overflow: 'hidden' }}>
                {c.imageUrl ? (
                  <Image src={c.imageUrl} alt="" fill loading="lazy" sizes="(max-width: 760px) 92vw, 420px" style={{ objectFit: 'cover' }} />
                ) : (
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(135deg, rgba(var(--accent-rgb),.14), rgba(var(--gold-rgb),.10))',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Icon name="auto_stories" size={26} color="rgba(var(--accent-rgb),.55)" />
                  </div>
                )}
              </div>
              <div style={{ padding: '16px 18px 18px' }}>
                <h3 style={{ fontSize: 16.5, fontWeight: 700, margin: '0 0 8px', lineHeight: 1.45 }}>{c.titleAr}</h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--muted)', margin: 0 }}>{c.bodyAr}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

/* ───────────────────────── empty ──────────────────────── */

function SpotlightEmpty() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '90px 26px', textAlign: 'center' }}>
      <Icon name="diamond" size={38} color="var(--accent)" />
      <h1 style={{ fontSize: 27, fontWeight: 700, margin: '16px 0 10px' }}>تحت الأضواء</h1>
      <p style={{ fontSize: 15.5, lineHeight: 1.8, color: 'var(--muted)', marginBottom: 24 }}>
        لا تتوفّر مختارات حالياً. تصفّح كل المشاريع في الوقت الحالي.
      </p>
      <Link
        href="/projects/discover-all"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 9,
          padding: '13px 22px',
          borderRadius: 14,
          background: 'var(--cta-grad)',
          color: 'var(--on-accent)',
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        <Icon name="explore" size={19} color="var(--on-accent)" />
        اكتشف المشاريع
      </Link>
    </div>
  );
}

function hrefOf(p: ApiHomeProjectCard): string {
  return p.slug ? `/p/${p.slug}` : `/projects/${p.id}`;
}
