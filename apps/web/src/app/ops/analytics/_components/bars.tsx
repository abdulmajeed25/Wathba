import type { ReactNode } from 'react';

import { intentFill, intentText, type Intent } from '../_lib/labels';

/**
 * OPS-360 Unit 5 — small, self-contained bar/meter primitives for the analytics
 * surface. Pure server components (no 'use client', no chart library): bars are
 * inline styled divs whose width is proportional to value/max. Every bar keeps
 * its NUMBER visible — color is a redundant cue, never the only one (WCAG).
 */

/** One horizontal bar row: label · track(fill) · value. */
export function Bar({
  label,
  value,
  max,
  valueLabel,
  intent = 'default',
  sub,
}: {
  label: ReactNode;
  value: number;
  max: number;
  /** Text shown at the end of the row; defaults to the ar-SA integer. */
  valueLabel?: ReactNode;
  intent?: Intent;
  /** Optional secondary line under the label. */
  sub?: ReactNode;
}) {
  const pctWidth = max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="grid grid-cols-[minmax(7rem,10rem)_1fr_auto] items-center gap-3">
      <div className="min-w-0">
        <div className="truncate text-xs text-[#c9d1d9]">{label}</div>
        {sub ? <div className="truncate text-[10px] text-[#8b949e]">{sub}</div> : null}
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-[#161b22]"
        role="presentation"
        aria-hidden
      >
        <div className={`h-full rounded-full ${intentFill(intent)}`} style={{ width: `${pctWidth}%` }} />
      </div>
      <div className={`w-16 text-left text-xs font-bold tabular-nums ${intentText(intent)}`}>
        {valueLabel ?? value.toLocaleString('ar-SA')}
      </div>
    </div>
  );
}

/** A titled stack of bars sharing one max (a small distribution chart). */
export function DistributionBars({
  title,
  rows,
  emptyAr = 'لا بيانات',
}: {
  title?: ReactNode;
  rows: Array<{ label: ReactNode; value: number; valueLabel?: ReactNode; intent?: Intent; sub?: ReactNode }>;
  emptyAr?: string;
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  return (
    <div className="rounded-lg border border-[#21262d] bg-[#161b22] p-4">
      {title ? <p className="mb-3 text-xs font-bold text-[#8b949e]">{title}</p> : null}
      {rows.length === 0 ? (
        <p className="text-xs text-[#484f58]">{emptyAr}</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r, i) => (
            <Bar
              key={i}
              label={r.label}
              value={r.value}
              max={max}
              valueLabel={r.valueLabel}
              intent={r.intent}
              sub={r.sub}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The single honest "we don't have this" state — a metric the API returned null
 * for. NEVER render 0 in its place. `reason` becomes both visible text and the
 * hover title so the operator learns WHY it's missing.
 */
export function Unavailable({
  label,
  reason,
  variant = 'tile',
  textAr = 'غير متاح',
}: {
  label: ReactNode;
  reason: string;
  variant?: 'tile' | 'inline';
  textAr?: string;
}) {
  if (variant === 'inline') {
    return (
      <span title={reason} className="text-xs text-[#484f58]">
        {textAr}
      </span>
    );
  }
  return (
    <div
      title={reason}
      className="rounded-lg border border-dashed border-[#30363d] bg-[#0d1117] p-4"
    >
      <p className="text-xs text-[#8b949e]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[#484f58]">{textAr}</p>
      <p className="mt-1 text-[10px] text-[#484f58]">{reason}</p>
    </div>
  );
}

/** A compact metric cell for the operations grid: label + value (+ optional intent color). */
export function MetricCell({
  label,
  value,
  intent = 'default',
  hint,
}: {
  label: ReactNode;
  value: ReactNode;
  intent?: Intent;
  hint?: string;
}) {
  return (
    <div title={hint} className="rounded-lg border border-[#21262d] bg-[#161b22] p-3">
      <p className="text-[11px] text-[#8b949e]">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${intentText(intent)}`}>{value}</p>
    </div>
  );
}
