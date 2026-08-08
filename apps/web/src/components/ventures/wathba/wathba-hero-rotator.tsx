'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { WathbaCardVideo, WathbaCardVideoGlyph } from './wathba-card-video';
import { Icon } from './wathba-icons';

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
  videoUrl: string | null;
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

const wantsMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

export function WathbaHeroRotator({
  slides,
  children,
}: {
  slides: HeroSlideData[];
  /** One server-rendered body per slide, in order. See wathba-hero-slide-body. */
  children?: ReactNode;
}) {
  // Children.toArray keeps the order and gives stable access by index without
  // asking the caller for a keyed map.
  const bodies = Children.toArray(children);
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
                  // HERO-METRICS — a DECLARED height, and the whole point of it.
                  //
                  // The card used to be as tall as whatever the slide happened
                  // to contain. Measured across the ten slides at one viewport:
                  // six different heights spanning 98px at 900px wide, 9px at
                  // 1024. All ten share `grid-area: 1/1`, so the cell took the
                  // tallest and the shorter cards simply stopped early — their
                  // bottom border and their 70px shadow landing up to 98px
                  // higher than the card that preceded them. The page never
                  // shifted (the cell is the tallest slide from first paint),
                  // which is exactly why CLS stayed clean and nothing caught it,
                  // and why it read as "the transition is janky" rather than as
                  // a measurable layout defect.
                  //
                  // With the height fixed, uniformity stops depending on the
                  // copy: a one-day slide and a two-day slide are the same box
                  // because the box was never asked. The two content fixes
                  // below it (the pitch reserve and the stat grid) now only
                  // have to keep content from overflowing that box, not from
                  // resizing it.
                  height: 'var(--hero-col-h)',
                  // The cover is a declared row, not a hardcoded 248px. Both
                  // are equally deterministic before the image loads — which is
                  // what keeps the CLS guarantee — but a row that changes per
                  // breakpoint lets the cover stop being 2.32:1 on a desktop and
                  // 1.23:1 on a phone by accident.
                  display: 'grid',
                  gridTemplateRows: 'var(--hero-cover-h) minmax(0,1fr)',
                }}
              >
                <div className="wathba-ph" style={{ position: 'relative', overflow: 'hidden' }}>
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
                      it is loaded and decoded by the time it appears.

                      PREVIOUS is in the window too, and was not. The window used
                      to be {idx, idx+1, prev}, which never contains idx−1 — so
                      «المشروع السابق», a first-class control sitting right
                      beside «التالي», always navigated to a slide whose cover
                      had never mounted. On a warm localhost the fresh <Image>
                      reported complete within 30ms and nothing was visible; on a
                      real connection it is the hatched placeholder, mid
                      cross-fade. One more image in flight, none of it before
                      LCP — `priority` is still only on i === 0. */}
                  {p.imageUrl &&
                    (i === idx ||
                      i === (idx + 1) % slides.length ||
                      i === (idx - 1 + slides.length) % slides.length ||
                      i === prev) && (
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
                  {/* HERO-VIDEO — the hover layer, mounted ONLY for the slide
                      that is currently showing, and sitting directly on the
                      cover so the badge, the scrim and the controls all stay
                      above it. The scrim in particular has to: it is what blends
                      the cover into the card body, and a video painted over it
                      would cut the card in half while playing.

                      `i === idx` IS the answer to "what happens to the video
                      when the slide changes". React unmounts the layer the
                      instant the index moves, and WathbaCardVideo's cleanup
                      pauses the element, rewinds it and drops the module-level
                      playback handle. No teardown path to get wrong, and no way
                      for a hidden slide to keep a video running behind the one
                      on screen — a real risk here, where all ten slides stay in
                      the DOM in one grid cell and only `visibility` separates
                      them.

                      It gives the lazy rule for free too: nine of the ten slides
                      have no <video> in the tree at all, so "never load ten
                      videos" is structural rather than a policy something has to
                      remember to honour.

                      Everything else comes from the component the trending cards
                      already use — 150ms hover intent, preload="none", the
                      `(hover:hover) and (pointer:fine)` gate that stops a tap
                      counting as hover, prefers-reduced-motion, the 2s LCP
                      window, and the single module-level handle that lets only
                      one video play anywhere on the page. Hero and trending
                      share that handle, so they cannot both play.

                      AUTO-ROTATION needs no new code: the rotator already sets
                      `paused` on mouseenter/focus of its root, so the ten-second
                      advance is stopped for exactly as long as someone is
                      hovering the card, and resumes on leave. The video and the
                      pause are triggered by the same gesture. */}
                  {i === idx && p.videoUrl ? (
                    <WathbaCardVideo videoUrl={p.videoUrl} poster={p.imageUrl}>
                      {null}
                    </WathbaCardVideo>
                  ) : null}

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

                  {/* The affordance. Bottom-inline-END: the bucket badge owns
                      the top-inline-end corner and the arrows own the
                      bottom-inline-start one, so this is the only corner left,
                      in either direction. */}
                  {p.videoUrl ? <WathbaCardVideoGlyph /> : null}
                </div>

                {bodies[i] ?? null}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Controls sit OUTSIDE the card so they are not inside its link — still
          true, and still the reason this is a sibling of the grid rather than a
          child of it. A <button> inside an <a> is invalid and screen readers
          announce it unpredictably.

          HERO-METRICS — they are now positioned OVER the cover instead of
          stacked under the card. That row was the entire 42px height mismatch
          between the two hero columns: 16px of margin plus a 36px button,
          measured on the card column and on nothing else, then split unevenly
          above and below the text by `align-items:center`. Over the cover, the
          card IS the column, the two sides align by construction, and 52px of
          first-viewport budget comes back — which is what puts the stat row
          inside the fold at 1280x680.

          Sat on the scrim band at the bottom of the cover, at the inline START.
          The bucket badge owns `inset-inline-end`, so the two can never meet at
          any width, in either direction.

          pointerEvents none on the row and auto on the buttons: the row spans
          the card, and a transparent flex container over a link would swallow
          clicks on everything it covered. */}
      {slides.length > 1 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(var(--hero-cover-h) - 50px)',
            insetInlineStart: 14,
            insetInlineEnd: 14,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            pointerEvents: 'none',
            // The row cannot wrap and cannot set a minimum width on anything:
            // it is out of flow. What it CAN do is overflow the card, which is
            // what the dots did between 430px and 900px — see the hide rule in
            // wathba-shell.tsx.
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

          {/* No inline `display`. It was `display:flex` here, and the
              `display:none` hide rule in the stylesheet lost to it on every
              viewport it was written for — an inline declaration outranks a
              plain stylesheet rule, so the dots rendered at 360px and wrapped
              to two rows across the whole 430-900px band, orphaning the second
              row under the arrows. That is the exact failure the rule exists to
              prevent, and it never once ran. Display now lives entirely in CSS,
              where the media query can reach it. */}
          <div
            className="wathba-hero-dots"
            style={{ gap: 8, flexWrap: 'nowrap', justifyContent: 'center', minWidth: 0 }}
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
