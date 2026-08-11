import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';

import {
  deriveProject,
  type DerivedProject,
  type WathbaProject,
  wathbaBudgetRows,
  wathbaCategories,
  wathbaHowSteps,
  wathbaProjects,
  wathbaRanks,
  wathbaTickerMessages,
} from './wathba-data';
import { categoryCount, categoryHref, categoryIcon, type HomeCategory } from './wathba-categories';
import type { ApiPopularFacet } from '@/lib/api/wathba';
import { toArabicDigits } from './discover-all-constants';
import { WathbaHomeStats } from './wathba-home-stats';
import { WathbaHomeTrending } from './wathba-home-trending';
import { Icon, Num } from './wathba-icons';

/**
 * HOME-REVIEW — the homepage renders as ONE ordered list of sections.
 *
 * It used to render as two: seven blocks hardcoded here, then the
 * admin-composed magazine underneath. Nothing below the fold could ever move
 * above anything above it, so the page's strongest evidence — a real project
 * told properly, campaigns about to close, success stories — sat permanently
 * beneath the creator call-to-action that reads as the end of the page.
 *
 * Both sets are now keyed renderers merged into one map, ordered by
 * HomepageSection.sortOrder (GET /v1/home → sections). Ordering the homepage is
 * a data change through the governed content.homepage-section.update operation,
 * not a deploy — and the two halves can finally interleave.
 *
 * The hero is deliberately NOT in the map. It is the page's opening and the LCP
 * element, and its cover is preloaded by the route; making it reorderable would
 * invite moving the one thing that must stay first.
 */

export interface HomeSectionRenderers {
  [key: string]: () => ReactNode;
}

/**
 * HOME-REVIEW — vertical rhythm, owned in ONE place.
 *
 * Spacing used to be a property of each section, set inline and independently:
 * the code blocks carried `margin: 74px auto 0` (and a 56 and a 14), the
 * magazine's Section carried `padding: 30px 26px 6px`, and the trending grid
 * had a 64. Measured on the page that produced gaps of 0, 64, 74 and 116 — and
 * critically, SEVEN consecutive magazine sections touching at 0px, because
 * their padding is internal and their boxes simply abut.
 *
 * A reader cannot tell a new chapter from the next item in the same one when
 * every boundary looks the same, and the reorder made that worse rather than
 * better: the new sequence has real act boundaries that nothing marked.
 *
 * So the LIST owns the rhythm now. Two values, and the difference between them
 * is the whole point:
 *   ACT_GAP    96px — a new chapter begins
 *   WITHIN_GAP 56px — the next thing in this chapter
 *
 * The acts are the ones the running order was built around (see
 * prisma/seed-home-order.mjs, which documents the same grouping): arrival ·
 * the work · the case · commitment · resources · editorial · exit.
 */
const ACT_GAP = 'var(--gap-act)';
const WITHIN_GAP = 'var(--gap-within)';

const ACT_OF: Record<string, string> = {
  live_ticker: 'arrival',
  categories: 'arrival',
  trending: 'arrival',

  home_stretch: 'work',
  featured_recommended: 'work',

  transparency: 'case',
  success_stories: 'case',
  creator_interviews: 'case',
  trust_duo: 'case',

  backer_ranks: 'commitment',
  how_it_works: 'commitment',
  creator_cta: 'commitment',

  creators_corner: 'resources',
  funding_tips: 'resources',

  hero_banners: 'editorial',
  announcements: 'editorial',
  brand_program: 'editorial',
  collection_showcase: 'editorial',

  fresh_favorites: 'exit',
};

/** The sections this file owns, as a key → renderer map. */
/**
 * HOME-REVIEW O4 — the chip row. Live taxonomy, canonical URLs.
 *
 * Eight, not all twenty-one: the review's layout plan gives this slot a quiet
 * chip strip between the hero and the trending grid, and three rows of chips is
 * not that. The COMPLETE list is server-rendered on /projects/discover-all, the
 * page commit 607f810 made "THE discovery entry", so a crawler still reaches
 * every category without JS — see wathba-categories.ts.
 *
 * Ordered by live project count, so the row leads with where the platform
 * actually has projects rather than with a hardcoded order.
 */
const HOME_CHIPS = 8;

/**
 * Batch DISCOVERY-ENGINE Unit 5 — the row the platform learned.
 *
 * A SECOND row under the curated category chips, never a replacement for them.
 * The curated row is an editorial statement about what Wathba is; this one is a
 * measurement of what readers actually did last month. Collapsing the two would
 * lose whichever one happened to score lower, and they are not the same claim.
 *
 * Visually quieter than the chips above on purpose: smaller, pill-shaped, no
 * icons, no counts. It should read as a shortcut strip, not a second navigation.
 *
 * Renders NOTHING when the list is empty — a heading over an empty row is worse
 * than no row, and the API returns [] whenever it is unreachable.
 *
 * RTL: the row is laid out with flex + wrap and logical padding only, so it
 * flows right-to-left with the document. No arrows, so nothing needs mirroring.
 */
function PopularFacetRow({ facets }: { facets?: ApiPopularFacet[] }) {
  if (!facets?.length) return null;
  return (
    <div style={{ marginTop: 22 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--muted)',
          marginBottom: 10,
        }}
      >
        الأكثر بحثاً هذا الأسبوع
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {facets.map((f) => (
          <Link
            key={`${f.key}:${f.value}`}
            href={f.href}
            data-popular-facet={`${f.key}:${f.value}`}
            style={{
              cursor: 'pointer',
              // Logical padding — this row is mirrored by `dir`, not by CSS.
              paddingBlock: 8,
              paddingInline: 14,
              borderRadius: 999,
              border: '1px solid rgba(var(--ink-rgb),.1)',
              background: 'var(--card)',
              color: 'var(--text-soft)',
              fontSize: 13.5,
              textDecoration: 'none',
              // WCAG 2.5.8 — the pill is 34px tall on its own padding, but a
              // wrapped row of short Arabic labels can render shorter.
              minHeight: 24,
              display: 'inline-flex',
              alignItems: 'center',
              transition: 'border-color var(--dur-hover) var(--ease-out)',
            }}
          >
            {f.labelAr}
          </Link>
        ))}
      </div>
    </div>
  );
}


export function wathbaHomeRenderers(
  list: DerivedProject[],
  featured: DerivedProject,
  categories?: HomeCategory[],
  popularFacets?: ApiPopularFacet[],
): HomeSectionRenderers {
  // The fixture stays as the API-unreachable fallback ONLY, mapped onto the
  // real URL space so it can never resurrect /projects/category/<slug>. Its
  // invented counts («٨٤٢ مشروع») are dropped rather than shown as facts.
  const chips: HomeCategory[] = (
    categories?.length
      ? [...categories].sort((a, b) => b.liveCount - a.liveCount)
      : wathbaCategories.map((c) => ({ slug: c.id, nameAr: c.ar, liveCount: 0 }))
  ).slice(0, HOME_CHIPS);

  return {
    live_ticker: () => (
      <Fragment>
      {/* ============================ LIVE TICKER ============================ */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '0 26px' }}>
        <div
          style={{
            border: '1px solid rgba(var(--ink-rgb),.07)',
            background: 'rgba(var(--ink-rgb),.02)',
            borderRadius: 14,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              flexShrink: 0,
              padding: '12px 18px',
              background: 'rgba(52,211,153,.1)',
              borderInlineEnd: '1px solid rgba(var(--ink-rgb),.07)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--pos-ink)',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--pos)',
                animation: 'wathba-pulsering 2s infinite',
              }}
            />
            مباشر الآن
          </div>
          <div
            style={{
              overflow: 'hidden',
              flex: 1,
              WebkitMask:
                'linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                gap: 40,
                whiteSpace: 'nowrap',
                padding: '12px 0',
                animation: 'wathba-ticker 26s linear infinite',
                fontSize: 13.5,
                color: 'var(--muted)',
              }}
            >
              {[...wathbaTickerMessages, ...wathbaTickerMessages].map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      </Fragment>
    ),
    categories: () => (
      <Fragment>
      {/* ============================ CATEGORIES ============================ */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '0 26px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: 24, fontWeight: 700 }}>تصفّح حسب الفئة</h2>
          <Link
            href="/projects/discover-all"
            style={{
              cursor: 'pointer',
              fontSize: 14,
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              // STAKES/S-2 — ≥24px tap target (WCAG 2.5.8 AA).
              minHeight: 24,
              textDecoration: 'none',
            }}
          >
            عرض الكل
            <Icon name="arrow_back" size={18} />
          </Link>
        </div>
        <div
          style={{
            display: 'grid',
            /*
             * auto-fit, not a fixed 8.
             *
             * At 360 this held eight 74px tracks — 593px of chips in a 308px
             * box with no scroller — so four categories were off-screen and
             * «القصص المصورة» was clipped at the edge. Exactly the defect the
             * rank tiers had, on the most-visited page on the site.
             *
             * The learned-facet row directly beneath this one uses flex-wrap
             * and has always wrapped correctly; this is the row that did not.
             *
             * 120px floor: a chip is an icon over a short category name and a
             * count, so it stays legible at two-up on a phone and still lays
             * out eight across on a desktop.
             */
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 14,
          }}
        >
          {chips.map((c) => (
            <Link
              key={c.slug}
              href={categoryHref(c.slug)}
              // Unit 5 added a SECOND chip row below this one. The curated row
              // needs to be countable on its own, or a test asserting "the
              // editorial row survived" silently counts both.
              data-category-chip={c.slug}
              style={{
                cursor: 'pointer',
                background: 'var(--card)',
                border: '1px solid rgba(var(--ink-rgb),.08)',
                borderRadius: 18,
                padding: '20px 12px',
                textAlign: 'center',
                boxShadow: 'var(--card-shadow)',
                transition:
                  'transform var(--dur-hover) var(--ease-out),box-shadow var(--dur-hover) var(--ease-out),border-color var(--dur-hover) var(--ease-out)',
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  margin: '0 auto 12px',
                  borderRadius: 14,
                  background: 'rgba(var(--accent-rgb),.1)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name={categoryIcon(c.slug)} size={25} color="var(--accent)" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{c.nameAr}</div>
              <Num style={{ fontSize: 11.5, color: 'var(--muted2)', marginTop: 3 }}>
                {categoryCount(c.liveCount)}
              </Num>
            </Link>
          ))}
        </div>
        <PopularFacetRow facets={popularFacets} />
      </section>

      </Fragment>
    ),
    trending: () => (
      <Fragment>
      {/* ============================ TRENDING ============================ */}
      <WathbaHomeTrending list={list} />

      </Fragment>
    ),
    transparency: () => (
      <Fragment>
      {/* ========================= TRANSPARENCY BAND ========================= */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '0 26px' }}>
        <div
          style={{
            background: 'var(--band)',
            border: '1px solid rgba(var(--ink-rgb),.08)',
            borderRadius: 26,
            padding: 44,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 46,
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -60,
              insetInlineEnd: -60,
              width: 240,
              height: 240,
              borderRadius: '50%',
              background: 'radial-gradient(circle,rgba(var(--accent-rgb),.18),transparent 70%)',
            }}
          />
          <div style={{ position: 'relative' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(52,211,153,.1)',
                border: '1px solid rgba(52,211,153,.3)',
                color: 'var(--pos-ink)',
                padding: '6px 13px',
                borderRadius: 30,
                fontSize: 12.5,
                fontWeight: 700,
                marginBottom: 18,
              }}
            >
              <Icon name="visibility" size={16} />
              شفافية مطلقة
            </div>
            <h2
              style={{
                fontSize: 32,
                fontWeight: 700,
                lineHeight: 1.2,
                marginBottom: 14,
              }}
            >
              تابع كل ريال
              <br />
              إلى أين يذهب
            </h2>
            <p style={{ fontSize: 15.5, color: 'var(--text-soft)', lineHeight: 1.7, marginBottom: 24 }}>
              لكل مشروع لوحة ميزانية حيّة تُظهر كيف تُنفَق أموالك، مع تحديثات مالية دورية موثّقة.
              لا مفاجآت — فقط ثقة.
            </p>
            <Link
              href={`/projects/${featured.id}`}
              style={{
                cursor: 'pointer',
                background: 'transparent',
                border: '1px solid rgba(var(--ink-rgb),.18)',
                color: 'var(--text)',
                fontWeight: 600,
                fontSize: 15,
                padding: '13px 22px',
                borderRadius: 13,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              شاهد لوحة الشفافية
            </Link>
          </div>
          <div
            style={{
              position: 'relative',
              background: 'var(--surface2)',
              border: '1px solid rgba(var(--ink-rgb),.08)',
              borderRadius: 18,
              padding: 24,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: 'var(--muted2)',
                marginBottom: 18,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>توزيع الميزانية — سِرب</span>
              <Num style={{ color: 'var(--accent-ink)' }}>{featured.raisedFmt}</Num>
            </div>
            {wathbaBudgetRows.map((b) => (
              <div key={b.label} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    marginBottom: 7,
                  }}
                >
                  <span style={{ color: 'var(--text-soft)' }}>{b.label}</span>
                  <Num style={{ color: 'var(--muted)' }}>%{toArabicDigits(b.pct)}</Num>
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 30,
                    background: 'rgba(var(--ink-rgb),.06)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ height: '100%', width: b.w, background: b.color, borderRadius: 30 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      </Fragment>
    ),
    backer_ranks: () => (
      <Fragment>
      {/* ============================ RANKS TEASER ============================ */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '0 26px', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(251,191,36,.1)',
            border: '1px solid rgba(251,191,36,.3)',
            color: 'var(--gold-ink)',
            padding: '6px 13px',
            borderRadius: 30,
            fontSize: 12.5,
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          <Icon name="workspace_premium" size={16} fill />
          نظام رتب الداعمين
        </div>
        <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>
          كل دعمٍ يرفع مكانتك
        </h2>
        <p
          style={{
            fontSize: 16,
            color: 'var(--text-soft)',
            maxWidth: 560,
            margin: '0 auto 38px',
          }}
        >
          ادعم أكثر، افتح رتباً أعلى ومزايا حصرية: شارات، وصول مبكر، ولقاءات مع المبدعين.
        </p>
        <div
          style={{
            display: 'grid',
            // Same five backer ranks as /projects/ranks, same fix: five fixed
            // tracks summed to 629px inside a 308px box at 360.
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 16,
          }}
        >
          {wathbaRanks.map((r) => (
            <div
              key={r.id}
              style={{
                background: 'var(--card)',
                border: `1px solid ${r.border}`,
                borderRadius: 18,
                padding: '26px 16px',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  margin: '0 auto 14px',
                  borderRadius: '50%',
                  background: r.bg,
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: r.glow,
                }}
              >
                <Icon name={r.icon} size={28} fill color={r.icoColor} />
              </div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                  marginBottom: 4,
                  color: r.titleColor,
                }}
              >
                {r.ar}
              </div>
              <Num
                style={{ fontSize: 11.5, color: 'var(--muted2)', letterSpacing: '1px', marginBottom: 8 }}
              >
                {r.en}
              </Num>
              <Num style={{ fontSize: 12.5, color: 'var(--muted)' }}>{toArabicDigits(r.req)}</Num>
            </div>
          ))}
        </div>
        <Link
          href="/projects/ranks"
          style={{
            cursor: 'pointer',
            marginTop: 34,
            background: 'transparent',
            border: '1px solid rgba(var(--ink-rgb),.18)',
            color: 'var(--text)',
            fontWeight: 600,
            fontSize: 15,
            padding: '13px 26px',
            borderRadius: 13,
            display: 'inline-block',
            textDecoration: 'none',
          }}
        >
          اكتشف كل المزايا
        </Link>
      </section>

      </Fragment>
    ),
    how_it_works: () => (
      <Fragment>
      {/* ============================ HOW IT WORKS ============================ */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '0 26px' }}>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          كيف تعمل وثبة
        </h2>
        <p style={{ fontSize: 15, color: 'var(--muted2)', textAlign: 'center', marginBottom: 40 }}>
          ثلاث خطوات تفصلك عن تحقيق فكرتك
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>
          {wathbaHowSteps.map((s) => (
            <div
              key={s.n}
              style={{
                background: 'var(--card)',
                border: '1px solid rgba(var(--ink-rgb),.08)',
                borderRadius: 20,
                padding: 30,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <Num
                decorative
                style={{
                  position: 'absolute',
                  top: -14,
                  insetInlineEnd: 18,
                  fontSize: 88,
                  fontWeight: 700,
                  color: 'rgba(var(--accent-rgb),.06)',
                }}
              >
                {s.n}
              </Num>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 15,
                  background:
                    'linear-gradient(135deg,rgba(var(--accent2-rgb),.2),rgba(var(--accent-rgb),.2))',
                  display: 'grid',
                  placeItems: 'center',
                  marginBottom: 18,
                  position: 'relative',
                }}
              >
                <Icon name={s.icon} size={27} color="var(--accent)" />
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 9, position: 'relative' }}>
                {s.titleAr}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.65, position: 'relative' }}>
                {s.descAr}
              </p>
            </div>
          ))}
        </div>
      </section>

      </Fragment>
    ),
    creator_cta: () => (
      <Fragment>
      {/* ============================ CTA BAND ============================ */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '0 26px' }}>
        <div
          style={{
            borderRadius: 28,
            padding: '56px 44px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            background: 'var(--cta-grad)',
            backgroundSize: '220% 220%',
            animation: 'wathba-gshift 9s ease infinite',
          }}
        >
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2
              style={{
                fontSize: 38,
                fontWeight: 700,
                color: 'var(--on-accent)',
                marginBottom: 14,
              }}
            >
              عندك فكرة؟ لنطلقها معاً.
            </h2>
            <p
              style={{
                fontSize: 17,
                color: 'rgba(6,18,31,.78)',
                maxWidth: 520,
                margin: '0 auto 30px',
              }}
            >
              انضم لآلاف المبدعين الذين حوّلوا أفكارهم إلى مشاريع ناجحة على وثبة.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                href="/projects/start"
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  background: 'var(--chip-fill)',
                  color: 'var(--chip-ink)',
                  fontWeight: 700,
                  fontSize: 16,
                  padding: '15px 30px',
                  borderRadius: 14,
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                ابدأ مشروعك الآن
              </Link>
              <Link
                href="/projects/how"
                style={{
                  border: '1px solid rgba(6,18,31,.4)',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: 'var(--on-accent)',
                  fontWeight: 700,
                  fontSize: 16,
                  padding: '15px 30px',
                  borderRadius: 14,
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                تعلّم المزيد
              </Link>
            </div>
          </div>
        </div>
      </section>
      </Fragment>
    ),
  };
}

export function WathbaHome({
  projects,
  hero,
  order,
  extraRenderers,
  categories,
  popularFacets,
}: {
  projects?: WathbaProject[];
  hero?: ReactNode;
  /** The live taxonomy for the chip row. Undefined when the API is down. */
  categories?: HomeCategory[];
  /** Batch DISCOVERY-ENGINE Unit 5 — the LEARNED row. Empty ⇒ not rendered. */
  popularFacets?: ApiPopularFacet[];
  /** Section keys in render order (HomepageSection.sortOrder). */
  order?: string[];
  /** The magazine's renderers, merged into the same ordered list. */
  extraRenderers?: HomeSectionRenderers;
} = {}) {
  const list = (projects ?? wathbaProjects).map(deriveProject);

  // Design lines 1533–1538.

  // The fallback fixture always has >=1 entry, so list[0]! is safe.
  const featured = list.find((p) => p.id === 'p1' || p.id === 'sirb') ?? list[0]!;

  const own = wathbaHomeRenderers(list, featured, categories, popularFacets);
  const renderers: HomeSectionRenderers = { ...own, ...extraRenderers };

  // OWN_ORDER is this file's historical sequence and doubles as the safety net.
  const OWN_ORDER = [
    'live_ticker',
    'categories',
    'trending',
    'transparency',
    'backer_ranks',
    'how_it_works',
    'creator_cta',
  ];

  // The API is now the source of order — which means a key MISSING from
  // HomepageSection would silently delete that section from the page. The
  // magazine could always afford that (its sections are optional editorial),
  // but «تصفّح حسب الفئة» and «المشاريع الرائجة» disappearing because a seed
  // row was never inserted is not a degradation anyone would choose. Any
  // code-owned key the API did not mention is appended in its own order, so
  // the worst case is a stale sequence rather than a missing page.
  const fromApi = order?.length ? order : [];
  const keys = fromApi.length
    ? [...fromApi, ...OWN_ORDER.filter((k) => !fromApi.includes(k))]
    : OWN_ORDER;

  return (
    <div className="wathba-fade">
      {/* ============================== HERO ============================== */}
      {/* STAKES/S-14 (F-09) — .wathba-home-hero stacks below 760px: the
          fixed 2-col grid squeezed at 360px and re-laid out on hydration,
          which was the home page's CLS (~0.5 mobile).

          HERO-METRICS — the two columns now share ONE declared height rather
          than each landing wherever its content lands. Measured before this:
          the text column was 502px and the card column 544px, and with
          `align-items:center` the 42px difference was split 22 above / 20
          below, which is what read as "the card is taller than the text". None
          of those 42px were the card — the card was 492px; the arrow row hung
          16 + 36px underneath it. It is inside the cover now (see the rotator),
          so the column IS the card.

          --hero-col-h is declared INLINE, not in the shell's <style> block, for
          the reason recorded in wathba-theme.ts: a custom property declared in a
          body stylesheet is briefly undefined, and this one sizes the LCP
          element. The per-breakpoint overrides in wathba-shell.tsx therefore
          carry !important — an inline declaration outranks a plain stylesheet
          rule, and an override that silently loses is how the dots-hide rule
          spent its whole life doing nothing.

          align-items START, not center. With the columns equal it changes
          nothing today; it means that if they ever diverge the card grows
          DOWNWARD instead of pushing the text column — and the text column's
          bottom edge is where the stat row lives, which is the thing that has
          to stay inside the first viewport. */}
      <section
        className="wathba-home-hero"
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          // 64 → 40. The single cheapest 24px of first-viewport budget: at
          // 1280x680 the stat row's bottom edge was 31px past the fold.
          padding: '40px 26px 30px',
          display: 'grid',
          // minmax(0,…) on BOTH tracks. A grid item's min-width defaults to
          // auto, so a bare `fr` track cannot shrink below its content's
          // min-content — the failure mode already documented twice in this
          // file's media queries.
          gridTemplateColumns: 'minmax(0,1.08fr) minmax(0,0.92fr)',
          gap: 48,
          alignItems: 'start',
          ['--hero-col-h' as string]: '500px',
          ['--hero-cover-h' as string]: '240px',
        }}
      >
        {/* A flex column of exactly --hero-col-h, so the stat row's distance
            from the top of the hero is a number this file chose rather than the
            sum of five margins. `margin-top:auto` on the stats parks them on
            that bottom edge; the CTA row keeps a minimum gap so the two never
            collide when the copy runs long. */}
        <div
          className="wathba-hero-copy"
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 'var(--hero-col-h)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              background: 'rgba(var(--accent-rgb),.1)',
              border: '1px solid rgba(var(--accent-rgb),.28)',
              color: 'var(--accent-ink)',
              padding: '7px 14px',
              borderRadius: 30,
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 20,
              // A flex item shrinks by default; this pill is 31px of content
              // and must stay 31px.
              flex: '0 0 auto',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--accent)',
                animation: 'wathba-pulsering 2s infinite',
              }}
            />
            منصة الدعم الجماعي الأولى عربياً
          </div>
          {/* Arabic display type, so two Latin-typography habits had to go.
              -1.5px tracking pulls cursive joins apart — Arabic letter-spacing
              is 0 or nothing, never negative. And 1.05 leading is sized for
              Latin caps: the shadda on «حوّل» sat against the top of the line
              box and the «س» tail of «ملموس» was clipped at the bottom. 1.3 is
              the floor for Arabic display and clears both.

              Height goes 130px → 161px here, which the layout absorbs: on
              desktop the hero card (492px) is already taller than this column
              (471px), so the section does not grow.

              HERO-METRICS — and 62px was 62px at EVERY width, including 360.
              There was no type scale in this hero at all. On a 360px phone the
              headline alone measured 242px tall — three lines, because «إلى
              واقعٍ ملموس» cannot fit one at that size — and it was the single
              biggest reason the mobile hero ran 1.81 viewports tall with the
              rotating card starting 108px BELOW the fold.

              The upper bound is reached at ~590px, which is inside the stacked
              band: from 760px up — every two-column layout — this evaluates to
              exactly the 62px it always was. Desktop and tablet are unchanged
              to the pixel, which matters because --hero-col-h is tuned against
              this column's measured height and the desktop LCP element is the
              card cover, not the headline.

              THE SLOPE IS SET BY A CLIFF, not by taste. «إلى واقعٍ ملموس» wraps
              at some size, and when it does the headline jumps from two lines to
              three — 120px to 187px at 360, in one pixel of font size. Measured
              ceilings: 46px at 360, 52px at 390, 56px at 414, which is a
              remarkably flat ~12.8vw. 10.5vw sits 21-29% under that everywhere,
              so a different font load or a copy edit cannot tip it over. Going
              closer to the cliff would buy a few points of size and reintroduce
              exactly the content-driven height this batch removed.

              The size is free at the fold: the column's min-height is
              --hero-col-h and its natural content is under that on a phone, so
              a taller headline eats the auto gap above the stat row rather than
              pushing it down. Measured at 360: stat row bottom 694 either way.

              line-height stays 1.3 and tracking stays normal at every size —
              those are the Arabic rules recorded above, and a responsive size
              does not relax them. The 34px floor only binds below a 324px
              viewport; it is a guard, not a design value. */}
          <h1
            style={{
              fontSize: 'clamp(34px, 10.5vw, 62px)',
              lineHeight: 1.3,
              fontWeight: 700,
              marginBottom: 20,
            }}
          >
            حوّل فكرتك
            <br />
            إلى{' '}
            <span
              style={{
                background: 'linear-gradient(120deg,var(--blue),var(--accent) 60%,var(--purple))',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              واقعٍ ملموس
            </span>
          </h1>
          <p
            style={{
              fontSize: 18.5,
              lineHeight: 1.7,
              color: 'var(--text-soft)',
              maxWidth: 480,
              marginBottom: 26,
            }}
          >
            وثبة تجمع المبدعين بمجتمعٍ يؤمن بهم. اعرض مشروعك، اجمع التمويل بشفافية كاملة،
            وكافئ داعميك برتبٍ ومزايا فريدة.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
            <Link
              href="/projects/start"
              style={{
                border: 'none',
                cursor: 'pointer',
                background: 'var(--grad)',
                color: 'var(--on-accent)',
                fontWeight: 700,
                fontSize: 16,
                padding: '15px 28px',
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                textDecoration: 'none',
              }}
            >
              <Icon name="bolt" size={21} fill />
              أطلق مشروعك
            </Link>
            <Link
              href="/projects/discover-all"
              style={{
                cursor: 'pointer',
                background: 'transparent',
                border: '1px solid rgba(var(--ink-rgb),.16)',
                color: 'var(--text)',
                fontWeight: 600,
                fontSize: 16,
                padding: '15px 28px',
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                textDecoration: 'none',
              }}
            >
              <Icon name="explore" size={21} />
              اكتشف المشاريع
            </Link>
          </div>
          {/* The credibility row sits on the column's bottom edge, so its
              distance from the fold is --hero-col-h and nothing else. */}
          <div style={{ marginTop: 'auto' }}>
            <WathbaHomeStats />
          </div>
        </div>

        {/* Batch HERO — the rotating showcase. The static card below is the
            fallback and stays reachable: an API that returns nothing must
            leave a hero on the page, not a hole where the hero was. */}
        {hero ? (
          hero
        ) : (
          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                inset: -24,
                background: 'radial-gradient(circle at 60% 30%,rgba(var(--accent-rgb),.22),transparent 65%)',
                filter: 'blur(8px)',
                zIndex: 0,
              }}
            />
            <Link
              href={`/projects/${featured.id}`}
              style={{
                position: 'relative',
                zIndex: 1,
                background: 'var(--card)',
                border: '1px solid rgba(var(--ink-rgb),.09)',
                borderRadius: 24,
                overflow: 'hidden',
                cursor: 'pointer',
                boxShadow: '0 30px 70px -30px rgba(0,0,0,.8)',
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
              }}
            >
              <div className="wathba-ph" style={{ height: 248, position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    top: 16,
                    insetInlineStart: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    background: 'rgba(6,18,31,.85)',
                    backdropFilter: 'blur(6px)',
                    border: '1px solid rgba(var(--accent-rgb),.4)',
                    color: 'var(--on-scrim-accent)',
                    padding: '7px 13px',
                    borderRadius: 30,
                    fontSize: 12.5,
                    fontWeight: 700,
                  }}
                >
                  <Icon name="favorite" size={16} fill />
                  مشروع نحبه
                </div>
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                  <Num style={{ fontSize: 12, color: 'var(--ph-label)', letterSpacing: '1px' }}>
                    [ صورة المشروع ]
                  </Num>
                </div>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    // Both edges — a stretch, not a side.
                    insetInline: 0,
                    height: 90,
                    background: 'linear-gradient(0deg,var(--surface2),transparent)',
                  }}
                />
              </div>
              <div style={{ padding: '22px 24px 26px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12.5,
                    color: 'var(--muted2)',
                    marginBottom: 10,
                  }}
                >
                  <span style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>{featured.cat}</span>·
                  <span>{featured.loc}</span>
                </div>
                <h3 style={{ fontSize: 23, fontWeight: 700, marginBottom: 6 }}>
                  {featured.titleAr}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: 'var(--muted)',
                    lineHeight: 1.6,
                    marginBottom: 20,
                  }}
                >
                  {featured.desc}
                </p>
                <div
                  style={{
                    height: 9,
                    borderRadius: 30,
                    background: 'rgba(var(--ink-rgb),.08)',
                    overflow: 'hidden',
                    marginBottom: 14,
                  }}
                >
                  {/* scaleX, not width: a transform does not touch layout, and
                      the origin is the reading start so the bar grows the way
                      the language runs. Same treatment as .wathba-hero-bar,
                      which is why they now share the rule — this one animated
                      `width` over 1.4s, which is both layout-bound and roughly
                      six times the reveal step. */}
                  <div
                    className="wathba-bar"
                    style={{
                      height: '100%',
                      width: '100%',
                      background: 'var(--grad-bar)',
                      borderRadius: 30,
                      transform: `scaleX(${Math.min(featured.pct, 100) / 100})`,
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                  }}
                >
                  <div>
                    <Num style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                      {featured.raisedFmt}
                    </Num>
                    <span style={{ fontSize: 13, color: 'var(--muted2)', marginInlineStart: 6 }}>
                      من {featured.goalFmt}
                    </span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Num style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-ink)' }}>
                      %{toArabicDigits(featured.pct)}
                    </Num>
                    <div style={{ fontSize: 11, color: 'var(--muted2)' }}>مُموَّل</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Num style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                      {toArabicDigits(featured.daysLeft)}
                    </Num>
                    <div style={{ fontSize: 11, color: 'var(--muted2)' }}>يوم متبقٍ</div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}
      </section>

      {(() => {
        // Spacing is decided against the PREVIOUS SECTION THAT ACTUALLY
        // RENDERED, not the previous key. A section returns null when it has no
        // data (half the magazine can be switched off in ops), and measuring
        // from a key that drew nothing would leave a 96px hole where a chapter
        // boundary used to be.
        let lastAct: string | null = null;
        return keys.map((k) => {
          const node = renderers[k]?.() ?? null;
          if (!node) return null;
          const act = ACT_OF[k] ?? k;
          const first = lastAct === null;
          const gap = first ? WITHIN_GAP : act === lastAct ? WITHIN_GAP : ACT_GAP;
          lastAct = act;
          return (
            <div key={k} style={{ marginTop: gap }}>
              {node}
            </div>
          );
        });
      })()}
    </div>
  );
}
