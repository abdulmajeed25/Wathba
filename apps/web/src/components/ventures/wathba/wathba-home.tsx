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

/** The sections this file owns, as a key → renderer map. */
export function wathbaHomeRenderers(list: DerivedProject[], featured: DerivedProject): HomeSectionRenderers {
  return {
    live_ticker: () => (
      <Fragment>
      {/* ============================ LIVE TICKER ============================ */}
      <section style={{ maxWidth: 1320, margin: '14px auto 0', padding: '0 26px' }}>
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
      <section style={{ maxWidth: 1320, margin: '56px auto 0', padding: '0 26px' }}>
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
            gridTemplateColumns: 'repeat(8,1fr)',
            gap: 14,
          }}
        >
          {wathbaCategories.map((c) => (
            <Link
              key={c.id}
              href={`/projects/category/${c.id}`}
              style={{
                cursor: 'pointer',
                background: 'var(--card)',
                border: '1px solid rgba(var(--ink-rgb),.08)',
                borderRadius: 18,
                padding: '20px 12px',
                textAlign: 'center',
                boxShadow: 'var(--card-shadow)',
                transition: 'transform .35s cubic-bezier(.2,.7,.2,1),box-shadow .35s,border-color .35s',
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
                <Icon name={c.icon} size={25} color="var(--accent)" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{c.ar}</div>
              <Num style={{ fontSize: 11.5, color: 'var(--muted2)', marginTop: 3 }}>
                {c.count}
              </Num>
            </Link>
          ))}
        </div>
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
      <section style={{ maxWidth: 1320, margin: '74px auto 0', padding: '0 26px' }}>
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
              left: -60,
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
                  <Num style={{ color: 'var(--muted)' }}>{b.pct}%</Num>
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
      <section style={{ maxWidth: 1320, margin: '74px auto 0', padding: '0 26px', textAlign: 'center' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16 }}>
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
              <Num style={{ fontSize: 12.5, color: 'var(--muted)' }}>{r.req}</Num>
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
      <section style={{ maxWidth: 1320, margin: '74px auto 0', padding: '0 26px' }}>
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
                  left: 18,
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
      <section style={{ maxWidth: 1320, margin: '74px auto 0', padding: '0 26px' }}>
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
}: {
  projects?: WathbaProject[];
  hero?: ReactNode;
  /** Section keys in render order (HomepageSection.sortOrder). */
  order?: string[];
  /** The magazine's renderers, merged into the same ordered list. */
  extraRenderers?: HomeSectionRenderers;
} = {}) {
  const list = (projects ?? wathbaProjects).map(deriveProject);

  // Design lines 1533–1538.

  // The fallback fixture always has >=1 entry, so list[0]! is safe.
  const featured = list.find((p) => p.id === 'p1' || p.id === 'sirb') ?? list[0]!;

  const own = wathbaHomeRenderers(list, featured);
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
          which was the home page's CLS (~0.5 mobile). */}
      <section
        className="wathba-home-hero"
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: '64px 26px 30px',
          display: 'grid',
          gridTemplateColumns: '1.05fr .95fr',
          gap: 54,
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative' }}>
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
              marginBottom: 24,
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
              (471px), so the section does not grow. */}
          <h1
            style={{
              fontSize: 62,
              lineHeight: 1.3,
              fontWeight: 700,
              marginBottom: 22,
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
              marginBottom: 32,
            }}
          >
            وثبة تجمع المبدعين بمجتمعٍ يؤمن بهم. اعرض مشروعك، اجمع التمويل بشفافية كاملة،
            وكافئ داعميك برتبٍ ومزايا فريدة.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 42 }}>
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
          <WathbaHomeStats />
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
                    right: 16,
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
                    left: 0,
                    right: 0,
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
                  <div
                    style={{
                      height: '100%',
                      width: featured.pctW,
                      background: 'var(--grad-bar)',
                      borderRadius: 30,
                      transition: 'width 1.4s cubic-bezier(.2,.7,.2,1)',
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
                      {featured.pct}%
                    </Num>
                    <div style={{ fontSize: 11, color: 'var(--muted2)' }}>مُموَّل</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Num style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                      {featured.daysLeft}
                    </Num>
                    <div style={{ fontSize: 11, color: 'var(--muted2)' }}>يوم متبقٍ</div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}
      </section>

      {keys.map((k) => (
        <Fragment key={k}>{renderers[k]?.() ?? null}</Fragment>
      ))}
    </div>
  );
}
