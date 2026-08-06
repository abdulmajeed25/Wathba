'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Batch HOME (S1) — rotating admin-managed hero banners: auto-rotate 6s,
 * pause on hover/focus, swipeable (native scroll), dot navigation. Fixed
 * height (zero CLS). Gradient art when the card has no image.
 */

export interface HeroBanner {
  id: string;
  titleAr: string;
  bodyAr: string;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabelAr: string | null;
}

const GRADIENTS = [
  'linear-gradient(120deg, rgba(5,166,97,.16), rgba(3,169,142,.05))',
  'linear-gradient(120deg, rgba(251,191,36,.16), rgba(5,166,97,.06))',
  'linear-gradient(120deg, rgba(96,165,250,.14), rgba(5,166,97,.06))',
];

export function WathbaHeroBanners({ banners }: { banners: HeroBanner[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || banners.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 6000);
    return () => clearInterval(t);
  }, [paused, banners.length]);

  if (banners.length === 0) return null;

  return (
    <section
      data-section="hero_banners"
      aria-roledescription="carousel"
      aria-label="إعلانات وثبة"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      style={{ maxWidth: 1320, margin: '0 auto', padding: '0 26px' }}
    >
      <div
        style={{
          position: 'relative', borderRadius: 20, overflow: 'hidden',
          border: '1px solid rgba(var(--ink-rgb),.08)',
          background: `${GRADIENTS[idx % GRADIENTS.length]}, var(--card)`,
          // Overlay grid: every slide occupies the same cell, so the box is
          // as tall as the TALLEST slide and rotation never shifts layout
          // (a minHeight box + swapped content caused real CLS when a longer
          // slide rotated in mid-audit).
          display: 'grid', transition: 'background var(--dur-drift) var(--ease-out)',
        }}
      >
        {banners.map((b, i) => (
          <div
            key={b.id}
            aria-hidden={i !== idx}
            style={{
              gridArea: '1 / 1', padding: '28px 34px 40px',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              opacity: i === idx ? 1 : 0, transition: 'opacity var(--dur-drift) var(--ease-out)',
              pointerEvents: i === idx ? 'auto' : 'none',
              visibility: i === idx ? 'visible' : 'hidden',
            }}
          >
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, maxWidth: 640 }}>{b.titleAr}</h2>
            <p style={{ fontSize: 14.5, color: 'var(--text-soft)', lineHeight: 1.7, maxWidth: 560, marginBottom: 14 }}>
              {b.bodyAr}
            </p>
            {b.linkUrl && (
              <Link
                href={b.linkUrl}
                tabIndex={i === idx ? 0 : -1}
                style={{
                  alignSelf: 'flex-start', background: 'var(--grad)', color: 'var(--on-accent)',
                  fontWeight: 700, fontSize: 13.5, padding: '11px 22px', borderRadius: 12,
                  textDecoration: 'none',
                }}
              >
                {b.linkLabelAr ?? 'اكتشف المزيد'}
              </Link>
            )}
          </div>
        ))}
        {banners.length > 1 && (
          <div role="tablist" aria-label="شرائح الإعلانات" style={{ position: 'absolute', bottom: 14, insetInlineStart: 34, display: 'flex', gap: 6 }}>
            {banners.map((x, i) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={i === idx}
                aria-label={`الشريحة ${i + 1}`}
                onClick={() => setIdx(i)}
                style={{
                  // 24px hit target (WCAG 2.2 target-size); the visible dot
                  // is the inner span.
                  width: i === idx ? 36 : 24, height: 24, border: 'none',
                  cursor: 'pointer', padding: 0, background: 'transparent',
                  display: 'grid', placeItems: 'center', transition: 'width .25s',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: i === idx ? 22 : 8, height: 8, borderRadius: 999,
                    background: i === idx ? 'var(--accent)' : 'rgba(var(--ink-rgb),.18)',
                    transition: 'width .25s', display: 'block',
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
