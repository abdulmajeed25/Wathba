import type { CSSProperties, ReactNode } from 'react';

import { Icon } from './wathba-icons';

/**
 * Reusable loading + empty + error state primitives that share the wathba
 * design tokens (var(--card), var(--muted2), border ink-08). Used by
 * data-bound tabs while the live API is loading or the DB has no rows yet.
 *
 * The shimmer keyframe is `wathba-shimmer` declared in wathba-tokens.ts.
 */

export function Skeleton({
  width = '100%',
  height = 16,
  radius = 6,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width,
        height,
        borderRadius: radius,
        background:
          'linear-gradient(90deg, rgba(var(--ink-rgb),.05) 25%, rgba(var(--ink-rgb),.10) 50%, rgba(var(--ink-rgb),.05) 75%)',
        backgroundSize: '200% 100%',
        animation: 'wathba-shimmer 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

/** Generic card placeholder — used while milestones/transparency load. */
export function SkeletonCard({ lines = 3 }: { lines?: number } = {}) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        borderRadius: 16,
        padding: 22,
        marginBottom: 14,
      }}
    >
      <Skeleton width="60%" height={18} radius={6} style={{ marginBottom: 10 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '40%' : '100%'}
          height={12}
          radius={4}
          style={{ marginTop: 8, display: 'block' }}
        />
      ))}
    </div>
  );
}

/** Empty-state block with icon + title + body + optional CTA. */
export function EmptyState({
  icon = 'inbox',
  title,
  body,
  cta,
}: {
  icon?: string;
  title: string;
  body?: string;
  cta?: ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px dashed rgba(var(--ink-rgb),.18)',
        borderRadius: 18,
        padding: '40px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'rgba(var(--ink-rgb),.05)',
          color: 'var(--muted2)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Icon name={icon} size={28} color="var(--muted2)" />
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 700 }}>{title}</h3>
      {body && (
        <p style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 380, lineHeight: 1.6 }}>{body}</p>
      )}
      {cta}
    </div>
  );
}

/** Error-state block — same shape as EmptyState but with accent-red tone. */
export function ErrorState({
  title = 'حدث خطأ ما',
  body,
  retry,
}: {
  title?: string;
  body?: string;
  retry?: ReactNode;
}) {
  return (
    <div
      style={{
        background: 'rgba(var(--error-rgb,239,68,68),.06)',
        border: '1px solid rgba(var(--error-rgb,239,68,68),.30)',
        borderRadius: 16,
        padding: '24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Icon name="info" size={24} color="#dc2626" />
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#dc2626' }}>{title}</h3>
      {body && <p style={{ fontSize: 13, color: 'var(--muted)' }}>{body}</p>}
      {retry}
    </div>
  );
}
