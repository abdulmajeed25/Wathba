'use client';

import { Icon, Num } from './wathba-icons';

/**
 * Compact AI Trust Score badge — a 0-100 chip drawn from
 * `GET /v1/ventures/:id/trust-score`. Renders top-left of every
 * project tile so the score is visible at-a-glance (parity-matrix
 * row 232, restoring the visible widget the legacy frontend showed).
 */
export interface TrustScoreBadgeProps {
  score: number;
  band: 'low' | 'moderate' | 'high' | 'exceptional';
  compact?: boolean;
}

const BAND_COLOR: Record<TrustScoreBadgeProps['band'], string> = {
  exceptional: 'linear-gradient(135deg,var(--purple),var(--accent))',
  high: 'var(--grad)',
  moderate: 'rgba(var(--accent-rgb),.18)',
  low: 'rgba(var(--ink-rgb),.16)',
};

const BAND_FG: Record<TrustScoreBadgeProps['band'], string> = {
  exceptional: 'var(--on-accent)',
  high: 'var(--on-accent)',
  moderate: 'var(--accent)',
  low: 'var(--muted)',
};

export function TrustScoreBadge({ score, band, compact = false }: TrustScoreBadgeProps) {
  return (
    <div
      title={`AI Trust Score: ${score}/100 — ${band}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 3 : 5,
        background: BAND_COLOR[band],
        color: BAND_FG[band],
        padding: compact ? '3px 7px' : '4px 9px',
        borderRadius: 20,
        fontSize: compact ? 10.5 : 11,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      <Icon name="shield" size={compact ? 12 : 13} fill />
      <Num>{score}</Num>
    </div>
  );
}
