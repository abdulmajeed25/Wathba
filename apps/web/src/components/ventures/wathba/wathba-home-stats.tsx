'use client';

import { useEffect, useState } from 'react';

import { formatSarCompact } from '@/lib/i18n/format';

import { compactNum } from './wathba-data';
import { Num } from './wathba-icons';

const fmtNum = (n: number): string => Math.round(n).toLocaleString('en-US');

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
    <div style={{ display: 'flex', gap: 36 }}>
      <div>
        <Num style={{ fontSize: 30, fontWeight: 700, color: 'var(--text)' }}>
          {formatSarCompact('ar', stats.raised)}
        </Num>
        <div style={{ fontSize: 13, color: 'var(--muted2)', marginTop: 2 }}>أموال جُمعت</div>
      </div>
      <div style={{ width: 1, background: 'rgba(var(--ink-rgb),.1)' }} />
      <div>
        <Num style={{ fontSize: 30, fontWeight: 700, color: 'var(--text)' }}>
          {compactNum(stats.backers)}
        </Num>
        <div style={{ fontSize: 13, color: 'var(--muted2)', marginTop: 2 }}>داعم نشط</div>
      </div>
      <div style={{ width: 1, background: 'rgba(var(--ink-rgb),.1)' }} />
      <div>
        <Num style={{ fontSize: 30, fontWeight: 700, color: 'var(--text)' }}>
          {fmtNum(stats.projects)}
        </Num>
        <div style={{ fontSize: 13, color: 'var(--muted2)', marginTop: 2 }}>مشروع مموَّل</div>
      </div>
    </div>
  );
}
