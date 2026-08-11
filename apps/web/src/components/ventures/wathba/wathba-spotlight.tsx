import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

import type { ApiEditorialCard, ApiHomeProjectCard, ApiSpotlightPayload } from '@/lib/api/wathba';

import { WathbaCardVideo, WathbaCardVideoGlyph } from './wathba-card-video';
import { Icon, Num } from './wathba-icons';
import { toArabicDigits } from './discover-all-constants';
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
        variant="band-trio"
      />
      <Section
        id="inventive"
        eyebrow="الجسارة"
        title="إبداعات مميزة"
        lede="أعمال تجرّب شيئاً لم يُجرَّب بعد."
        items={inventive}
        variant="full-bleed"
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
  // THE PREMISE CHANGED. This page was built for a dataset with no cover
  // imagery at all, and said in its own header comment that it should get
  // better — not merely different — when photography landed. It has: the
  // SPOTLIGHT-PLUS audit counted 14 covers on this page, 11 decoded.
  //
  // So the hero picks its form from the data instead of assuming the empty
  // case. With a cover it becomes a full-bleed stage; without one it keeps the
  // typographic wash, which is still the right answer for a bare record.
  return p.imageUrl ? <HeroCinematic p={p} /> : <HeroTypographic p={p} />;
}

/**
 * The cover as the ground, edge to edge.
 *
 * Everything inside pins its own ink to a FIXED light palette rather than the
 * theme's. That looks like a token violation and is the opposite: this section
 * no longer stands on `--surface-0`, it stands on a photograph, so the theme
 * has nothing to say about what is legible here. `var(--text)` would render
 * near-black over a dark scrim in light mode — the same "a root owns ink AND
 * ground" rule that broke the auth pages, applied to an element that has taken
 * ownership of its own ground.
 */
function HeroCinematic({ p }: { p: ApiHomeProjectCard }) {
  return (
    <section
      aria-labelledby="spotlight-hero-title"
      style={{
        position: 'relative',
        overflow: 'hidden',
        // `isolate` keeps the scrim's stacking context local, so a z-index here
        // can never reach over the site header.
        isolation: 'isolate',
        // RESERVED, and this is the CLS guarantee: the section's height is a
        // pure function of the viewport, never of whether the cover has
        // decoded. The art fills a box that is already the right size.
        minHeight: 'clamp(520px, 72vh, 760px)',
        display: 'grid',
        // Anchored to the bottom — a poster, not a centred banner.
        alignItems: 'end',
      }}
    >
      {/* THE STAGE — deliberately NOT wrapped in HeroParallax.

          The first version drifted the cover on scroll, reusing the primitive
          the typographic hero uses for its gradient washes. Measured, that was
          a bad trade: the primitive carries `will-change: transform`, which on
          two small gradient divs is free and on a 1366x770 photographic layer
          promotes a texture roughly 3.6x the LCP element's old painted area.
          The cover is the LCP element, so the cost lands on the number that
          matters most. It is also redundant motion — this surface already
          moves, because hovering it plays the film. */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        {/* Hover anywhere on the stage plays the film. On a surface this large
            that is close to autoplay, and it is the intent: this is the one
            page whose whole job is to make the work look alive. The safeties
            are the component's, unchanged — muted, looping, one at a time,
            never before the LCP window closes, and nothing at all on a coarse
            pointer or under reduced motion. */}
        <WathbaCardVideo videoUrl={p.videoUrl} poster={p.imageUrl}>
          <Image
            src={p.imageUrl!}
            alt=""
            fill
            priority
            sizes="100vw"
            style={{ objectFit: 'cover' }}
          />
        </WathbaCardVideo>
      </div>

      {/* MEASURED, so nobody re-investigates the image. This hero costs ~280ms
          of LCP against the contained hero it replaced (20 paired runs, slower
          in 18). The findings, because every one of them is counter-intuitive:

            · LCP == FCP in 40/40 samples. The hero paints at the page's FIRST
              paint, so this is a first-paint cost that LCP inherits, not an
              "LCP element" problem.
            · The cover is NOT the cost. It downloads at 71ms, and hiding it
              entirely makes first paint SLOWER (1040ms vs 1008ms) because the
              h1 becomes the largest paint instead.
            · The cost is the scrim below: a viewport-sized translucent layer
              composited over a viewport-sized image before anything paints.
              Hiding it recovers 90-290ms — and it carries WCAG AA on this
              copy, so it stays.

          Three cheaper formulations were tested paired, 20 pairs each, and
          NONE beat chance: a flat fill plus one gradient (-60ms, 12/20), a
          shorter hero (+102ms, 9/20), and a GPU filter on the image instead of
          an overlay (+66ms, 7/20). Two were outright worse.

          This box is a 6-core shared vCPU under load; real hardware composites
          a viewport gradient in single-digit milliseconds. The regression is
          accepted deliberately — CLS is 0 and contrast is AA. If you are here
          to optimise it, the ~500ms of pre-paint time on this page is the
          target, not the hero. */}
      {/* THE SCRIM, and it is load-bearing for accessibility, not decoration.
          Two layers: a flat floor that holds no matter what the photograph
          does, and a directional wash heaviest at the START edge — right, in
          RTL — where the text actually sits. A gradient alone would put the
          copy at the mercy of a bright cover.

          Worst case is a pure-white photo. Composited the two layers reach
          ~0.75 alpha under the text column, which lands white on ~10:1. The
          far end thins out to nothing, which is why the copy is bounded to
          the start 58% and never travels into it. */}
      <div
        aria-hidden
        className="wathba-spotlight-scrim"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background:
            'linear-gradient(to left, rgba(4,10,7,.80) 0%, rgba(4,10,7,.66) 38%, rgba(4,10,7,.20) 78%, rgba(4,10,7,.08) 100%),' +
            'linear-gradient(to top, rgba(4,10,7,.62) 0%, rgba(4,10,7,.10) 46%, transparent 72%)',
          pointerEvents: 'none',
        }}
      />

      {p.videoUrl ? <WathbaCardVideoGlyph /> : null}

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: MAX,
          width: '100%',
          margin: '0 auto',
          padding: '96px 26px 58px',
        }}
      >
        <div style={{ maxWidth: 'min(58%, 760px)' }} className="wathba-spotlight-copy">
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 14px',
              borderRadius: 30,
              // A DARK chip, and it has to be dark. The first version was a
              // white 22% glass fill, which lightens the ground beneath its own
              // white text: measured 3.42:1 at 360, where this pill sits at the
              // top of the hero and the mobile scrim is at its thinnest. The
              // rule the rest of this file follows applies to the chip too — an
              // element that paints its own ground owns its own contrast, and
              // must not borrow legibility from a scrim it happens to sit on.
              // At 66% over a pure-white photograph this floors at ~6:1.
              //
              // NO backdrop-filter. A blur here sits above the LCP element and
              // forces the compositor to read back a region of it before the
              // badge can paint — measurable cost on the one element whose
              // paint time is the metric. A flat fill at this size is
              // indistinguishable on a photograph anyway.
              background: 'rgba(4,10,7,.66)',
              border: '1px solid rgba(255,255,255,.28)',
              color: '#fff',
              fontSize: 12.5,
              fontWeight: 700,
              marginBottom: 20,
            }}
          >
            {/* The mark keeps the brand green even on art — identity leads. */}
            <Icon name="diamond" size={15} color="var(--accent)" />
            تحت الأضواء
          </div>

          <h1
            id="spotlight-hero-title"
            style={{
              // The display voice the rest of the page does not have. Nothing
              // else on /spotlight goes past 54px; this is the crescendo.
              fontSize: 'clamp(38px, 6.6vw, 88px)',
              // 1.3, NOT the 1.12 this hero used to carry. Arabic ascenders and
              // descenders are taller than Latin ones and a display line-height
              // under ~1.3 clips tails and diacritics — at 88px it clipped
              // visibly. No letter-spacing at any size: negative tracking
              // breaks the cursive joins.
              lineHeight: 1.3,
              letterSpacing: 0,
              fontWeight: 700,
              color: '#fff',
              margin: '0 0 18px',
              textShadow: '0 2px 30px rgba(0,0,0,.42)',
            }}
          >
            {p.titleAr}
          </h1>

          {p.shortDescAr && (
            <p
              style={{
                fontSize: 'clamp(15px, 1.5vw, 19px)',
                lineHeight: 1.75,
                color: 'rgba(255,255,255,.90)',
                margin: '0 0 30px',
                maxWidth: 620,
                textShadow: '0 1px 18px rgba(0,0,0,.40)',
              }}
            >
              {p.shortDescAr}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', marginBottom: 30 }}>
            <Stat value={`%${toArabicDigits(p.fundedPct)}`} label="مُموَّل" onArt />
            <Divider onArt />
            <Stat value={toArabicDigits(p.backersCount)} label="داعم" onArt />
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
      </div>
    </section>
  );
}

/** No cover: the gradient wash the page was originally built around. */
function HeroTypographic({ p }: { p: ApiHomeProjectCard }) {
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
          position: 'relative',
          zIndex: 1,
        }}
        className="wathba-spotlight-hero"
      >
        <div style={{ maxWidth: 860 }}>
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
            {/* COUNTS AND PERCENTAGES ARE ARABIC-INDIC on this platform; money
                and reference ids are deliberately Latin (formatSar pins
                `ar-SA-u-nu-latn`). <Num> supplies the typeface and tabular
                figures — it does NOT convert digits, which is what these three
                sites assumed. The hero read «964 داعم» while the card beneath it
                read «٨٤٧ داعم». */}
            <Stat value={`%${toArabicDigits(p.fundedPct)}`} label="مُموَّل" />
            <Divider />
            <Stat value={toArabicDigits(p.backersCount)} label="داعم" />
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

      </div>
    </section>
  );
}

// `onArt` = standing on a photograph rather than on a themed surface, so the
// theme's ink tokens do not apply. See the note on HeroCinematic.
function Stat({ value, label, onArt }: { value: string; label: string; onArt?: boolean }) {
  return (
    <div>
      <Num style={{ fontSize: onArt ? 30 : 27, fontWeight: 700, color: onArt ? '#fff' : 'var(--text)' }}>
        {value}
      </Num>
      <div
        style={{
          fontSize: 12.5,
          color: onArt ? 'rgba(255,255,255,.82)' : 'var(--muted2)',
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Divider({ onArt }: { onArt?: boolean }) {
  return (
    <div
      style={{
        width: 1,
        height: 34,
        background: onArt ? 'rgba(255,255,255,.32)' : 'rgba(var(--ink-rgb),.12)',
      }}
    />
  );
}

/* ─────────────────────── sections ─────────────────────── */

/**
 * Batch SPOTLIGHT-PLUS P2 — chapters that are shaped like what they mean.
 *
 * Every section on this page used to render through one structure: a lead card
 * beside a rail of rows. The audit measured the result — biggest 756px,
 * staff-picks 756px, inventive 756px — three consecutive identical blocks.
 * Nothing crescendoed, and alternating the background colour was the only
 * signal that a new chapter had begun.
 *
 * So the variant is chosen by what the chapter IS, not by alternating for its
 * own sake:
 *
 *   lead-rail  الأكبر والأنجح — the opener, and the canonical magazine form.
 *              One project carries the chapter; the others report beneath it.
 *   band-trio  مختارات وثبة — the editors picked three. Three tall portraits,
 *              equal weight, centred heading, on the premium band. Deliberate
 *              and spacious, because that is what a hand-picked shortlist is.
 *   full-bleed إبداعات مميزة — «الجسارة», boldness. The art breaks the
 *              container and runs to the edges with no card chrome at all.
 *
 * Structure varies, not just colour — which was the whole finding.
 */
type SectionVariant = 'lead-rail' | 'band-trio' | 'full-bleed';

function Section({
  id,
  eyebrow,
  title,
  lede,
  items,
  premium,
  variant = 'lead-rail',
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede: string;
  items: ApiHomeProjectCard[];
  premium?: boolean;
  variant?: SectionVariant;
}) {
  // "Every section renders only when it has data" — an empty rail is worse than
  // no rail, so this returns nothing rather than an apologetic placeholder.
  if (items.length === 0) return null;

  const [lead, ...rest] = items;
  const centred = variant === 'band-trio';

  return (
    <Reveal
      as="section"
      id={id}
      // -flat: the chapter itself only fades. Its children carry the movement,
      // in order — see the stagger block in wathba-shell.tsx for why both
      // moving at once reads as drift rather than arrival.
      className="wathba-reveal-flat"
      // scroll-margin so the sticky header never covers the heading when the nav
      // menu deep-links to #id.
      style={{
        scrollMarginTop: 90,
        padding: variant === 'band-trio' ? '74px 0' : '58px 0',
        ...(premium ? { background: 'var(--band)' } : {}),
      }}
      aria-labelledby={`${id}-title`}
    >
      <div style={{ maxWidth: MAX, margin: '0 auto', padding: '0 26px' }}>
        <div
          className="wathba-stagger-item"
          style={{
            marginBottom: centred ? 34 : 26,
            maxWidth: 720,
            // The header leads the chapter in, so it is step 0.
            '--i': 0,
            ...(centred ? { marginInline: 'auto', textAlign: 'center' } : {}),
          } as CSSProperties}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              // Tracking is a LATIN device. Arabic is cursive: positive
              // letter-spacing pulls the joins apart, so the eyebrow earns its
              // hierarchy from weight and the accent ink instead.
              color: 'var(--accent-ink)',
              marginBottom: 9,
            }}
          >
            {eyebrow}
          </div>
          <h2
            id={`${id}-title`}
            style={{
              fontSize: centred ? 'clamp(26px, 3.2vw, 40px)' : 'clamp(23px, 2.6vw, 33px)',
              fontWeight: 700,
              // 1.35: Arabic descenders and diacritics need the room, and these
              // headings wrap to two lines at 360.
              lineHeight: 1.35,
              margin: '0 0 10px',
            }}
          >
            {title}
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--muted)', margin: 0 }}>{lede}</p>
        </div>
      </div>

      {variant === 'full-bleed' ? (
        // Escapes the MAX container deliberately — that is the chapter's whole
        // argument. 14px of inset rather than 0 so the art reads as full-bleed
        // without a card looking like it was clipped by the viewport.
        <div
          className="wathba-spotlight-band"
          style={{
            display: 'grid',
            // auto-fit, NOT auto-fill: the item count is fixed, so auto-fill
            // would keep adding empty tracks on a wide screen and shrink the
            // art. auto-fit collapses them instead — and at 360 it drops to a
            // single column on its own, which is what stops this becoming the
            // five-track grid that hid content on a phone elsewhere.
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 16,
            padding: '0 14px',
          }}
        >
          {items.map((p, i) => (
            <Step key={p.id} i={i + 1}>
              <TileCard p={p} ratio="3 / 2" bare />
            </Step>
          ))}
        </div>
      ) : (
        <div style={{ maxWidth: MAX, margin: '0 auto', padding: '0 26px' }}>
          {variant === 'band-trio' ? (
            <div
              className="wathba-spotlight-trio"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 22,
              }}
            >
              {items.map((p, i) => (
                <Step key={p.id} i={i + 1}>
                  <TileCard p={p} ratio="4 / 5" />
                </Step>
              ))}
            </div>
          ) : (
            /* Magazine rhythm: one lead card carrying the section, the rest in
               a calmer grid beside it. Falls back to a plain grid on one item. */
            <div
              className="wathba-spotlight-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: rest.length > 0 ? '1.15fr 1fr' : '1fr',
                gap: 22,
                alignItems: 'start',
              }}
            >
              {lead && (
                <Step i={1}>
                  <LeadCard p={lead} />
                </Step>
              )}
              {rest.length > 0 && (
                <div style={{ display: 'grid', gap: 14 }}>
                  {rest.map((p, i) => (
                    <Step key={p.id} i={i + 2}>
                      <RowCard p={p} />
                    </Step>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Reveal>
  );
}

/**
 * One step of a chapter's entrance.
 *
 * A wrapper rather than a prop on each card: LeadCard, RowCard and TileCard
 * would each need the same two lines threaded through them, and the wrapper is
 * a grid item in every layout here — the card fills it and nothing shifts.
 */
function Step({ i, children }: { i: number; children: ReactNode }) {
  return (
    <div className="wathba-stagger-item" style={{ '--i': i } as CSSProperties}>
      {children}
    </div>
  );
}

/**
 * One tile, two dresses — the only difference between a shortlist portrait and
 * a full-bleed band item is the ratio and whether it wears card chrome, so
 * they are one component rather than two near-copies.
 */
function TileCard({ p, ratio, bare }: { p: ApiHomeProjectCard; ratio: string; bare?: boolean }) {
  return (
    <Link
      href={hrefOf(p)}
      className={bare ? 'lift lift-bare' : 'lift'}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        ...(bare
          ? {}
          : {
              background: 'var(--card)',
              border: '1px solid rgba(var(--ink-rgb),.08)',
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: 'var(--card-shadow)',
            }),
      }}
    >
      <Art p={p} ratio={ratio} radius={bare ? 14 : 0} />
      <div style={{ padding: bare ? '14px 4px 0' : '16px 18px 18px' }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px', lineHeight: 1.4 }}>{p.titleAr}</h3>
        <Funded p={p} compact />
      </div>
    </Link>
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
/**
 * Batch SPOTLIGHT-PLUS P0 — the showcase plays its videos.
 *
 * /spotlight rendered ZERO <video> and zero ▶ glyphs while the homepage
 * trending grid has played hover-video since Stage 1. The audit measured it:
 * `WathbaCardVideo` appeared 4× in wathba-home-trending.tsx and 0× here, on the
 * page whose whole job is to be the most alive surface on the site.
 *
 * The same component, not a second implementation. It already owns hover
 * INTENT (150ms), the LCP window, one-video-at-a-time, pointer-coarse and
 * reduced-motion opt-outs — all of which took a batch to get right and none of
 * which should be re-derived here.
 *
 * `videoUrl` needs no API work: /v1/spotlight maps its cards through the same
 * `toCard` as the homepage, and that already runs `cardVideoUrl(p)` — so a
 * creator who attached a video and then chose the poster arrives here as null
 * and stays a still image. The per-project choice is respected because it is
 * decided server-side, once.
 */
function Art({ p, ratio, radius = 0 }: { p: ApiHomeProjectCard; ratio: string; radius?: number }) {
  return (
    <div style={{ position: 'relative', aspectRatio: ratio, borderRadius: radius, overflow: 'hidden' }}>
      <WathbaCardVideo videoUrl={p.videoUrl} poster={p.imageUrl}>
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
      </WathbaCardVideo>
      {p.videoUrl ? <WathbaCardVideoGlyph /> : null}
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
        <Num style={{ fontSize: 12, color: 'var(--accent-ink)', fontWeight: 700 }}>%{toArabicDigits(p.fundedPct)} مُموَّل</Num>
        <Num style={{ fontSize: 11.5, color: 'var(--muted2)' }}>{toArabicDigits(p.backersCount)} داعم</Num>
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
