'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Batch POLISH Unit 2 — the motion layer for /spotlight.
 *
 * THE ORDER OF OPERATIONS MATTERS, so it is spelled out here:
 *
 *   1. The server renders content with NO hiding attribute at all. A crawler,
 *      a reader with JS disabled, and the first paint all get the finished page.
 *   2. Only after mount does the client mark a section as "not yet revealed",
 *      and only when the reader has not asked for reduced motion.
 *   3. An IntersectionObserver then reveals it.
 *
 * Doing it the usual way round — hidden in the markup, revealed by JS — means a
 * JS failure leaves a blank page and a crawler sees opacity:0 content. This
 * cannot: the worst case is content that simply never animates.
 *
 * prefers-reduced-motion is honoured in BOTH places, belt and braces: the CSS
 * only defines the hidden state inside `no-preference`, and this component
 * refuses to set the attribute at all when the query matches.
 */

const wantsMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

export function Reveal({
  children,
  delay = 0,
  className,
  id,
  style,
  as: Tag = 'div',
  'aria-labelledby': labelledBy,
}: {
  children: ReactNode;
  /** Stagger, in ms. Kept small — this is punctuation, not choreography. */
  delay?: number;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
  as?: 'div' | 'section';
  /** Kept as a real prop: a <section> without an accessible name is a landmark
   *  a screen-reader user cannot navigate to by name. */
  'aria-labelledby'?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!wantsMotion()) return; // never hide anything for a reduced-motion reader
    const el = ref.current;
    if (!el) return;

    // Already on screen at mount (above the fold): don't arm it, or the reader
    // watches the hero fade in after it has already read it.
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.92) return;

    setArmed(true);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.setAttribute('data-revealed', '1');
            io.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const props = {
    ref: ref as React.Ref<HTMLDivElement & HTMLElement>,
    id,
    ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
    className: ['wathba-reveal', className].filter(Boolean).join(' '),
    // Absent until armed → the server output and every reduced-motion reader
    // get plain, visible content.
    ...(armed ? { 'data-revealed': '0' } : {}),
    style: { ...style, ...(armed && delay ? { transitionDelay: `${delay}ms` } : {}) },
  };

  return Tag === 'section' ? <section {...props}>{children}</section> : <div {...props}>{children}</div>;
}

/**
 * A slow vertical drift on the hero's decorative wash. Deliberately tiny: the
 * wash moves, never the text, so nothing readable is in motion while you read
 * it, and the layer is aria-hidden decoration whose movement changes no layout.
 */
export function HeroParallax({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!wantsMotion()) return;
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      raf = requestAnimationFrame(() => {
        // 6% of scroll offset, capped — enough to feel like depth, not enough
        // to detach the wash from the section it belongs to.
        const y = Math.min(window.scrollY * 0.06, 46);
        el.style.transform = `translate3d(0, ${y}px, 0)`;
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      style={{ position: 'absolute', inset: '-10% 0 0 0', willChange: 'transform', zIndex: 0 }}
    >
      {children}
    </div>
  );
}
