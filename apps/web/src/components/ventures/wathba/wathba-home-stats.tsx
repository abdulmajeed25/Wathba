'use client';

import { useEffect, useState } from 'react';

import { formatSarCompact } from '@/lib/i18n/format';

import { compactNum } from './wathba-data';
import { Num } from './wathba-icons';
import { displayCount } from './discover-all-constants';

const fmtNum = (n: number): string => displayCount(Math.round(n));

/**
 * Batch RSC — the animated hero counters, as the only client code in this part
 * of the page.
 *
 * Design lines 1496-1505: the three numbers count up to 4,820 / 312M / 1.94M
 * over 1.5s. That needs requestAnimationFrame, so it needs the client — but it
 * is ~20 lines, and it used to force the ENTIRE 1090-line homepage to be a
 * client component alongside it.
 *
 * It renders its own final values on the server first, so a reader with no JS,
 * a crawler, and the first paint all see the real figures rather than zeros.
 * Only the count-up is client behaviour.
 */

const TARGETS = { projects: 4820, raised: 312_000_000, backers: 1_940_000 };

/**
 * HERO-METRICS — the row was `display:flex; gap:36` with no wrap, no
 * `min-width:0` and no basis. Three consequences, all measured:
 *
 *  - Its min-content is 375px. In a 338px column at 390px, and a 308px one at
 *    360px, «4,820 / مشروع مموَّل» sat at x = −11 and x = −41 — sliced by the
 *    viewport edge. `[data-pillar]{overflow-x:clip}` zeroes scrollWidth, so
 *    every page-level overflow check read a clean 0px while the number was
 *    being cut in half, and home-hero-fit.spec.ts measures the ROTATOR, not
 *    this column.
 *  - The numbers were a flat 30px at every width, so «312 مليون ر.س» wrapped to
 *    three lines and the row went 67px → 112px → 157px as the viewport
 *    narrowed. That 90px is most of what pushed the row past the fold.
 *  - Two 1px <div>s carried the dividers, which meant the row's geometry
 *    depended on five children instead of three.
 *
 * A 3-track grid of `minmax(0,1fr)` cannot overflow its parent by
 * construction, the dividers are borders on the cells that need them, and the
 * type scales with the viewport so the figures stay on one line down to the
 * phone breakpoint.
 */
const NUM = 'clamp(19px, 2.05vw, 30px)';
const LABEL = 'clamp(11px, 0.92vw, 13px)';

/**
 * TWO LINES RESERVED, always — and this is a CLS fix, not a spacing choice.
 *
 * These figures count up over 1.5s, and «أموال جُمعت» counts through strings of
 * different LENGTHS on the way: «5.8 مليون ر.س» is wider than «19 مليون ر.س».
 * Inside a minmax(0,1fr) track some of those intermediates wrap and some do
 * not, so the row measured 66px → 110px → 66px within about 25ms at ~400ms
 * after load. Measured on 5 runs: two clean at 0.00001 and three at 0.0029,
 * entirely from that pair of shifts — a bimodal CLS that depends on which
 * intermediate value happened to land on the wrap boundary.
 *
 * The row is bottom-anchored (margin-top:auto on its parent), so reserving the
 * second line costs nothing where the figure fits on one: the spare height sits
 * above the number, the row's bottom edge does not move, and the stat row's
 * distance from the fold is unchanged.
 *
 * An em-based reserve rather than px, so it tracks the clamp.
 */
const FIGURE = {
  fontSize: NUM,
  fontWeight: 700,
  color: 'var(--text)',
  display: 'block',
  lineHeight: 1.15,
  minHeight: '2.3em',
} as const;

/**
 * `border-inline-start` rather than a left or right border: in RTL the first
 * cell is the RIGHTMOST, so the divider that belongs between cells 1 and 2 is
 * on cell 2's inline-start edge. Physical `border-left` would draw it on the
 * wrong side of the wrong cell in one of the two directions.
 */
const CELL = {
  borderInlineStart: '1px solid rgba(var(--ink-rgb),.1)',
  paddingInlineStart: 'clamp(12px, 1.4vw, 22px)',
  minWidth: 0,
} as const;

export function WathbaHomeStats() {
  // Seeded with the final values, not zeros: this markup is server-rendered and
  // a no-JS reader must not be told the platform has raised 0.
  const [stats, setStats] = useState(TARGETS);

  useEffect(() => {
    const dur = 1500;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setStats({
        projects: Math.round(TARGETS.projects * e),
        raised: Math.round(TARGETS.raised * e),
        backers: Math.round(TARGETS.backers * e),
      });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      data-testid="wathba-hero-stats"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
        columnGap: 'clamp(12px, 1.4vw, 22px)',
        alignItems: 'end',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <Num style={FIGURE}>
          {formatSarCompact('ar', stats.raised)}
        </Num>
        <div style={{ fontSize: LABEL, color: 'var(--muted2)', marginTop: 2 }}>أموال جُمعت</div>
      </div>
      <div style={CELL}>
        <Num style={FIGURE}>
          {compactNum(stats.backers)}
        </Num>
        <div style={{ fontSize: LABEL, color: 'var(--muted2)', marginTop: 2 }}>داعم نشط</div>
      </div>
      <div style={CELL}>
        <Num style={FIGURE}>
          {fmtNum(stats.projects)}
        </Num>
        <div style={{ fontSize: LABEL, color: 'var(--muted2)', marginTop: 2 }}>مشروع مموَّل</div>
      </div>
    </div>
  );
}
