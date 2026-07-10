'use client';

import { useRef, useState } from 'react';

import { Icon } from './wathba-icons';

/**
 * Batch HOME — RTL horizontal carousel: scroll-snap + native touch swipe,
 * keyboard-accessible arrow buttons, no external lib (JS budget), no
 * scrollbar jank (hidden but scrollable). Children are server-rendered.
 */
export function WathbaCarousel({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<'start' | 'mid' | 'end'>('start');

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    // RTL: scrollLeft runs negative in blink; scrollBy handles direction.
    el.scrollBy({ left: dir * -el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const x = Math.abs(el.scrollLeft);
    setPos(x < 24 ? 'start' : x > max - 24 ? 'end' : 'mid');
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={ref}
        role="region"
        aria-label={label}
        onScroll={onScroll}
        className="wathba-carousel-track"
        style={{
          display: 'flex', gap: 16, overflowX: 'auto',
          scrollSnapType: 'x mandatory', scrollbarWidth: 'none',
          paddingBottom: 4,
        }}
      >
        {children}
      </div>
      <button
        type="button"
        aria-label="التالي"
        onClick={() => scroll(1)}
        disabled={pos === 'end'}
        style={{ ...arrowBtn, insetInlineEnd: -8, opacity: pos === 'end' ? 0.3 : 1 }}
      >
        <Icon name="arrow_back" size={18} color="var(--text)" />
      </button>
      <button
        type="button"
        aria-label="السابق"
        onClick={() => scroll(-1)}
        disabled={pos === 'start'}
        style={{ ...arrowBtn, insetInlineStart: -8, opacity: pos === 'start' ? 0.3 : 1 }}
      >
        <Icon name="arrow_forward" size={18} color="var(--text)" />
      </button>
    </div>
  );
}

const arrowBtn: React.CSSProperties = {
  position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 5,
  width: 38, height: 38, borderRadius: '50%', cursor: 'pointer',
  background: 'var(--card)', border: '1px solid rgba(var(--ink-rgb),.14)',
  boxShadow: '0 8px 24px -10px rgba(0,0,0,.35)', display: 'grid', placeItems: 'center',
};
