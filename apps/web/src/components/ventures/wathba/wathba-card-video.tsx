'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Stage 1 item 12 — "cards come alive" on desktop hover.
 *
 * The cover cross-fades to the project's campaign video: muted, looping,
 * inline. Leaving the card fades back to the image.
 *
 * WHAT THIS IS NOT: before this shipped there was no per-project video in the
 * schema, the API or the data. The campaign page appeared to have one, but it
 * rendered a YouTube iframe whose id was a hardcoded constant in a web fixture
 * — the same clip for every project. `videoUrl` (migration 0059) is the real
 * field; it is null for every project until a creator uploads one, so the
 * common path through this component is "render nothing extra and leave the
 * image alone".
 *
 * The performance rules are the reason this is a component rather than a few
 * props, and every one of them is load-bearing:
 *
 *  - NOTHING is fetched until hover intent. The <video> element does not exist
 *    in the DOM until then, so there is no preload, no metadata request, and no
 *    poster fetch. Mounting it hidden with preload="none" would still cost a
 *    connection on some browsers; not mounting it costs nothing, provably.
 *  - HOVER INTENT is a 150ms delay. Dragging the pointer across a row of eight
 *    cards must not queue eight video fetches.
 *  - HOVER-CAPABLE POINTERS ONLY. `(hover: hover) and (pointer: fine)` — touch
 *    devices fire synthetic mouseenter on tap, which would make a tap both
 *    navigate and start a download. Checked at hover time rather than at mount
 *    so it stays correct if the input device changes.
 *  - prefers-reduced-motion: no video at all. An autoplaying loop is motion.
 *  - ONE AT A TIME, enforced through a module-level handle rather than context,
 *    because the cards live in three separate section trees with no common
 *    client ancestor.
 *  - NOT IN THE FIRST 2s. The homepage LCP is the hero cover; a video fetch
 *    racing it on a slow connection would cost the metric. The gate is wall
 *    time since this module first ran on the client.
 *
 * The <video> is aria-hidden and the cover <img> stays mounted underneath: the
 * video is decoration over content that is already there, so a screen reader
 * and a crawler both see exactly what they saw before.
 */

/** Hover dwell before anything is requested. */
const HOVER_INTENT_MS = 150;

/** No card video may start before this many ms after first client render. */
const LCP_PROTECTION_MS = 2000;

/** Cross-fade duration. Matches the card's own hover lift. */
const FADE_MS = 260;

/**
 * The one playing video. Module-level on purpose — see the header note about
 * the three section trees. Assigning through a function keeps the pause
 * ordering in one place instead of at every call site.
 */
let playing: HTMLVideoElement | null = null;

function claimPlayback(el: HTMLVideoElement) {
  if (playing && playing !== el) {
    playing.pause();
    // Rewind the one we displaced, so re-hovering it starts from the top
    // rather than resuming mid-shot — a resumed clip reads as a glitch.
    playing.currentTime = 0;
  }
  playing = el;
}

function releasePlayback(el: HTMLVideoElement) {
  el.pause();
  el.currentTime = 0;
  if (playing === el) playing = null;
}

/**
 * Wall time this module first evaluated in the browser.
 *
 * Date.now() rather than performance.now(), for testability and at no real
 * cost: this is a 2000ms gate, so neither monotonicity nor sub-millisecond
 * resolution matters. It was performance.now() first, and that made the guard
 * impossible to verify — a real pointer cannot reach a card within 2s of load
 * (measured: Playwright's hover() alone took 9.2s on this page), and the clock
 * API that could have controlled the timing does not fake performance.now().
 * A guard nothing can exercise is a guard nobody knows is working.
 */
const clientStart = Date.now();

function mayPlayYet(): boolean {
  return Date.now() - clientStart >= LCP_PROTECTION_MS;
}

/**
 * The window's state, published to the DOM.
 *
 * `data-card-video-window` is "open" once the LCP window has passed. It exists
 * because the guard was otherwise unverifiable: a pointer cannot reach a card
 * within 2s of load (hover() alone measured 9.2s), Playwright's clock.install()
 * does NOT freeze time — measured, it ticked 3288ms across 3s of real time —
 * and a genuinely paused clock stalls the page's entrance reveal so the cards
 * never become visible.
 *
 * With the state published, a test samples it from INSIDE the page on the
 * page's own timers, which is deterministic regardless of how slow the harness
 * is. An invisible timer is a timer nobody can prove is working.
 */
if (typeof document !== 'undefined') {
  // BOTH states are published, not just the open one. The window is relative to
  // when this module evaluates — which on a slow client is several seconds
  // after navigation — so an observer that only sees "open" cannot tell a
  // working guard from one that opened immediately. Seeing "shut" first, and
  // how long it lasted, is the whole assertion.
  document.documentElement.dataset.cardVideoWindow = 'shut';
  setTimeout(() => {
    document.documentElement.dataset.cardVideoWindow = 'open';
  }, LCP_PROTECTION_MS);
}

function hoverCapable(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
  );
}

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Wraps a card's cover area. `children` is the existing cover markup — image,
 * placeholder, badges — and is left entirely alone.
 */
export function WathbaCardVideo({
  videoUrl,
  poster,
  children,
}: {
  videoUrl: string | null | undefined;
  poster: string | null | undefined;
  children: React.ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (video.current) releasePlayback(video.current);
    },
    [],
  );

  if (!videoUrl) return <>{children}</>;

  const enter = () => {
    if (!hoverCapable() || reducedMotion()) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!mayPlayYet()) return;
      setArmed(true);
    }, HOVER_INTENT_MS);
  };

  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(false);
    if (video.current) releasePlayback(video.current);
  };

  return (
    <div
      onMouseEnter={enter}
      onMouseLeave={leave}
      style={{ position: 'absolute', inset: 0 }}
      data-card-video={armed ? 'armed' : 'idle'}
    >
      {children}
      {armed && (
        <video
          ref={video}
          src={videoUrl}
          // poster is the cover, so the first painted video frame matches the
          // image underneath and the cross-fade has nothing to jump between.
          poster={poster ?? undefined}
          muted
          loop
          playsInline
          autoPlay
          preload="none"
          aria-hidden
          tabIndex={-1}
          onPlaying={(e) => {
            claimPlayback(e.currentTarget);
            setVisible(true);
          }}
          // A network or codec failure must leave the card exactly as it was.
          onError={() => {
            setVisible(false);
            setArmed(false);
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: visible ? 1 : 0,
            transition: `opacity ${FADE_MS}ms cubic-bezier(0.23, 1, 0.32, 1)`,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

/**
 * The affordance. A card that behaves differently on hover has to say so, or
 * the behaviour is only discoverable by accident.
 *
 * Rendered for every card that HAS a video, including on touch, where hover
 * never fires — there it reads as "this campaign has a video", which is true
 * and is what the campaign page will show.
 */
export function WathbaCardVideoGlyph() {
  return (
    <span
      aria-label="هذا المشروع يحتوي على فيديو"
      style={{
        position: 'absolute',
        insetInlineEnd: 11,
        bottom: 11,
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'rgba(6,18,31,.78)',
        backdropFilter: 'blur(5px)',
        border: '1px solid rgba(255,255,255,.22)',
        color: '#fff',
        fontSize: 11,
        display: 'grid',
        placeItems: 'center',
        // The glyph is a right-pointing triangle in a LTR sense; in RTL the
        // card mirrors but a play control does not (see the RTL rules: media
        // transport controls never flip).
        transform: 'scaleX(1)',
        pointerEvents: 'none',
      }}
    >
      ▶
    </span>
  );
}
