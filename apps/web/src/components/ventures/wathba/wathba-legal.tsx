import type { ReactNode } from 'react';

import { Icon } from './wathba-icons';

/**
 * Shared legal-page chrome — Terms / Privacy / Help all share the same
 * narrow-column layout, hero, and section style.
 */
export function WathbaLegalPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="wathba-fade">
      <section style={{ maxWidth: 820, margin: '0 auto', padding: '48px 26px 80px' }}>
        {eyebrow && (
          <div
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 12,
              letterSpacing: 2,
              color: 'var(--accent)',
              marginBottom: 8,
            }}
          >
            {eyebrow}
          </div>
        )}
        <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-.8px', marginBottom: 10 }}>
          {title}
        </h1>
        {intro && (
          <p style={{ fontSize: 16, color: 'var(--text-soft)', lineHeight: 1.65, marginBottom: 30 }}>
            {intro}
          </p>
        )}
        {children}
      </section>
    </div>
  );
}

export function LegalSection({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: ReactNode;
}) {
  return (
    <article style={{ marginBottom: 22 }}>
      <h2
        style={{
          fontSize: 19,
          fontWeight: 700,
          marginBottom: 8,
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 10,
        }}
      >
        <span style={{ color: 'var(--accent)', fontSize: 14 }}>{n}.</span>
        {title}
      </h2>
      <div style={{ fontSize: 15, color: 'var(--text-soft)', lineHeight: 1.85 }}>{body}</div>
    </article>
  );
}

export function HelpTopicCard({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <article
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: 40, height: 40, borderRadius: 11,
          background: 'rgba(var(--accent-rgb),.10)',
          color: 'var(--accent)',
          display: 'grid', placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={22} color="var(--accent)" />
      </div>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{title}</h3>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>{body}</p>
      </div>
    </article>
  );
}
