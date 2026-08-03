'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Icon, Num } from './wathba-icons';

/**
 * Batch HERO — the rotating featured project card.
 *
 * One static card became a showcase of the whole platform: four buckets, ten
 * slides, ten seconds each.
 *
 * WHY EVERY SLIDE IS IN THE DOM AT ONCE. The card sits above the fold and its
 * content changes every ten seconds, so a naive swap would move the page under
 * the reader on a timer — the worst kind of layout shift, because it happens
 * when nobody is touching anything. All slides therefore live in the SAME grid
 * cell (`grid-area: 1/1`): the box is as tall as the tallest slide from first
 * paint and rotation cannot resize it. This is the pattern wathba-hero-banners
 * already uses, and its comment records that a min-height box shifted for real.
 *
 * MOTION. Incoming slides translate in from the reading-start side and settle;
 * the outgoing one fades and drifts the opposite way. Transforms and opacity
 * only, CSS transitions rather than keyframes so a reader who clicks a dot
 * mid-fade retargets smoothly instead of restarting. Two durations, because the
 * two triggers are different events: an auto-advance nobody asked for is slow
 * and calm (520ms), a click is feedback and must feel instant (240ms).
 *
 * The transition CSS lives in wathba-shell.tsx with the other .wathba-* rules,
 * gated on `prefers-reduced-motion: no-preference` — so a reader who asked for
 * less motion gets a plain swap even before this component's own JS opts out of
 * auto-rotation.
 */

export interface HeroSlideData {
  id: string;
  slug: string | null;
  titleAr: string;
  shortDescAr: string;
  imageUrl: string | null;
  creatorName: string;
  categoryAr: string | null;
  categorySlug: string | null;
  region: string | null;
  fundedPct: number;
  raisedHalalas: string;
  goalHalalas: string;
  backersCount: number;
  daysLeft: number;
  isStaffPick: boolean;
  bucket: 'strong' | 'diverse' | 'almost' | 'fresh';
}

const DWELL_MS = 10_000;

/** Bucket → the badge the slide wears. */
const BADGE: Record<HeroSlideData['bucket'], { label: string; icon: string }> = {
  strong: { label: 'قوية', icon: 'bolt' },
  diverse: { label: 'متنوعة', icon: 'category' },
  almost: { label: 'قاربت الاكتمال', icon: 'trending_up' },
  fresh: { label: 'وصلت حديثاً', icon: 'celebration' },
};

const REGION_AR: Record<string, string> = {
  RIYADH: 'الرياض', MAKKAH: 'مكة المكرمة', MADINAH: 'المدينة المنورة', QASSIM: 'القصيم',
  EASTERN: 'المنطقة الشرقية', ASIR: 'عسير', TABUK: 'تبوك', HAIL: 'حائل',
  NORTHERN_BORDERS: 'الحدود الشمالية', JAZAN: 'جازان', NAJRAN: 'نجران', BAHAH: 'الباحة', JAWF: 'الجوف',
};

/**
 * Latin digits, matching fmtNum() in wathba-data.ts, which is what this card
 * showed before it rotated. The site is not internally consistent about
 * numerals — the discover cards use Arabic-Indic — but the hero is not the
 * place to start changing that, so it holds the convention it already had.
 */
const money = new Intl.NumberFormat('en-US');
const sar = (halalas: string): string => money.format(Math.round(Number(halalas) / 100));

const wantsMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

export function WathbaHeroRotator({ slides }: { slides: HeroSlideData[] }) {
  const [idx, setIdx] = useState(0);
  const [prev, setPrev] = useState(-1);
  const [paused, setPaused] = useState(false);
  // Server and first client paint must agree, so motion starts undecided and is
  // resolved after mount. Rendering `motion ? … : …` during hydration would
  // mismatch for a reduced-motion reader.
  const [motion, setMotion] = useState(true);
  const [fast, setFast] = useState(false);
  const live = useRef<HTMLDivElement>(null);

  useEffect(() => setMotion(wantsMotion()), []);

  const go = useCallback(
    (next: number, viaControl: boolean) => {
      setFast(viaControl);
      setPrev(idx);
      setIdx(((next % slides.length) + slides.length) % slides.length);
    },
    [idx, slides.length],
  );

  // Auto-advance. Off entirely for reduced motion, a single slide, while
  // hovered/focused, and — the edge case that matters — while the tab is in the
  // background, where a timer would otherwise burn through the whole pool
  // unseen and the reader would return to a random slide.
  useEffect(() => {
    if (!motion || paused || slides.length < 2) return;
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setFast(false);
      setPrev((_) => idx);
      setIdx((i) => (i + 1) % slides.length);
    }, DWELL_MS);
    return () => clearInterval(t);
  }, [motion, paused, slides.length, idx]);

  // Announce only after a change, never on mount — a live region that fires at
  // load talks over the page the reader just arrived at.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (live.current) {
      live.current.textContent = `المشروع ${idx + 1} من ${slides.length}: ${slides[idx]!.titleAr}`;
    }
  }, [idx, slides]);

  if (slides.length === 0) return null;

  const dur = fast ? 240 : 520;
  const cur = slides[idx]!;

  return (
    <div
      style={{ position: 'relative' }}
      aria-roledescription="carousel"
      aria-label="مشاريع مختارة"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        style={{
          position: 'absolute',
          inset: -24,
          background: 'radial-gradient(circle at 60% 30%,rgba(var(--accent-rgb),.22),transparent 65%)',
          filter: 'blur(8px)',
          zIndex: 0,
        }}
      />

      {/* The grid IS the layout contract: one cell, every slide inside it. */}
      <div
        data-testid="wathba-hero-rotator"
        style={{ position: 'relative', zIndex: 1, display: 'grid' }}
      >
        {slides.map((p, i) => {
          const state = i === idx ? 'current' : i === prev ? 'prev' : 'idle';
          return (
            <div
              key={p.id}
              className="wathba-hero-slide"
              data-state={state}
              data-bucket={p.bucket}
              data-testid={i === idx ? 'wathba-hero-slide-current' : undefined}
              aria-hidden={i !== idx}
              // Non-current slides keep their link out of the tab order. Without
              // this, tabbing through the hero walks ten invisible cards.
              inert={i !== idx}
              // minWidth:0 — a grid item refuses to shrink below its
              // min-content without it, and the stat row's min-content is
              // wider than a 390px phone. The card overflowed by ~22px.
              style={{ gridArea: '1 / 1', minWidth: 0, ['--hero-dur' as string]: `${dur}ms` }}
            >
              <Link
                href={`/projects/${p.id}`}
                data-testid="wathba-hero-link"
                style={{
                  background: 'var(--card)',
                  border: '1px solid rgba(var(--ink-rgb),.09)',
                  borderRadius: 24,
                  overflow: 'hidden',
                  boxShadow: '0 30px 70px -30px rgba(0,0,0,.8)',
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'block',
                }}
              >
                <div className="wathba-ph" style={{ height: 248, position: 'relative' }}>
                  {/* Only the window carries an image, and that is the whole
                      LCP story on this page.

                      `loading="lazy"` does NOT defer these: every slide shares
                      one grid cell, so all ten are inside the viewport as far as
                      the browser is concerned — merely transparent. Rendering
                      all ten <Image>s fetched ~350KB of covers before the page
                      could paint, and first paint went from ~240ms (measured on
                      a sibling page with the same shell) to ~880ms. The slides
                      still all mount, because the box has to stay as tall as the
                      tallest of them; only the images are windowed.

                      `next` is in the window a full dwell before it is shown, so
                      it is loaded and decoded by the time it appears. */}
                  {p.imageUrl && (i === idx || i === (idx + 1) % slides.length || i === prev) && (
                    <Image
                      src={p.imageUrl}
                      alt=""
                      fill
                      sizes="(max-width: 760px) 92vw, 620px"
                      priority={i === 0}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      // Anchored to the top so the crop drops the bottom strip.
                      // Generated covers carry their category in a pill down
                      // there, and this card lays a 90px scrim over exactly that
                      // band — the pill came out half-eaten, reading as a
                      // rendering fault rather than a label. Nothing is lost:
                      // the category is spelled out in text directly below.
                      style={{ objectFit: 'cover', objectPosition: 'top' }}
                    />
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      top: 16,
                      insetInlineEnd: 16,
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
                    <Icon name={BADGE[p.bucket].icon} size={15} fill />
                    {BADGE[p.bucket].label}
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
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
                    <span style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>{p.categoryAr ?? 'وثبة'}</span>
                    {p.region && <span>· {REGION_AR[p.region] ?? p.region}</span>}
                    <span style={{ marginInlineStart: 'auto' }}>{p.creatorName}</span>
                  </div>
                  {/* No negative tracking: it breaks Arabic cursive joins. */}
                  <h3 style={{ fontSize: 23, fontWeight: 700, marginBottom: 6, lineHeight: 1.35 }}>
                    {p.titleAr}
                  </h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: 'var(--muted)',
                      lineHeight: 1.7,
                      marginBottom: 20,
                      // Two lines reserved whatever the copy, so a short pitch
                      // and a long one occupy the same height.
                      minHeight: '2.8em',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {p.shortDescAr}
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
                      className="wathba-hero-bar"
                      style={{
                        height: '100%',
                        width: '100%',
                        background: 'var(--grad-bar)',
                        borderRadius: 30,
                        // scaleX, not width: a transform does not touch layout.
                        // The origin is the reading start, so it grows the way
                        // the language runs.
                        transform: `scaleX(${Math.min(p.fundedPct, 100) / 100})`,
                      }}
                    />
                  </div>
                  {/* Four stats where the static card had three, so this row
                      has to be able to wrap: on a narrow phone the money
                      block alone is most of the width. */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-end',
                      flexWrap: 'wrap',
                      gap: '12px 14px',
                    }}
                  >
                    <div>
                      <Num style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                        {sar(p.raisedHalalas)}
                      </Num>
                      <span style={{ fontSize: 13, color: 'var(--muted2)', marginInlineStart: 6 }}>
                        من {sar(p.goalHalalas)}
                      </span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Num style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-ink)' }}>
                        {p.fundedPct}%
                      </Num>
                      <div style={{ fontSize: 11, color: 'var(--muted2)' }}>مُموَّل</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Num style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                        {money.format(p.backersCount)}
                      </Num>
                      <div style={{ fontSize: 11, color: 'var(--muted2)' }}>داعم</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Num style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{p.daysLeft}</Num>
                      <div style={{ fontSize: 11, color: 'var(--muted2)' }}>يوم متبقٍ</div>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {/* Controls sit OUTSIDE the card so they are not inside its link. */}
      {slides.length > 1 && (
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            marginTop: 16,
            // This row, not the card, was setting the hero's minimum width:
            // ten 24px dots + nine 8px gaps + two 36px buttons + gaps = 412px,
            // against 338px of usable width on a 390px phone. A grid item will
            // not shrink below that, and in RTL the overflow runs LEFT — the
            // card hung 48px off the side of the screen. The DOTS wrap inside
            // the row now, rather than the row itself wrapping — letting the
            // outer row wrap dropped the two arrows onto separate lines.
            flexWrap: 'nowrap',
          }}
        >
          {/* Arrows mirror: in RTL «التالي» advances leftward. */}
          <button
            type="button"
            className="wathba-hero-ctl"
            onClick={() => go(idx - 1, true)}
            aria-label="المشروع السابق"
          >
            <Icon name="arrow_forward" size={18} />
          </button>

          <div
            className="wathba-hero-dots"
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', minWidth: 0 }}
            role="tablist"
            aria-label="اختيار المشروع"
          >
            {slides.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                className="wathba-hero-dot"
                data-active={i === idx ? '1' : '0'}
                aria-selected={i === idx}
                aria-label={`المشروع ${i + 1}: ${p.titleAr}`}
                onClick={() => go(i, true)}
              >
                <span className="wathba-hero-dot-mark" />
              </button>
            ))}
          </div>

          <button
            type="button"
            className="wathba-hero-ctl"
            onClick={() => go(idx + 1, true)}
            aria-label="المشروع التالي"
          >
            <Icon name="arrow_back" size={18} />
          </button>
        </div>
      )}

      {/* Screen-reader announcement of the slide that just became current. */}
      <div ref={live} aria-live="polite" aria-atomic="true" className="wathba-sr-only" />
      <span className="wathba-sr-only">{`المعروض حالياً: ${cur.titleAr}`}</span>
    </div>
  );
}
