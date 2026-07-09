'use client';

import Link from 'next/link';

import { Num } from './wathba-icons';

/**
 * STAKES/J3 + J4 — a compact horizontal projects rail. Used for
 * "مشاريع مشابهة" (campaign page) and "لأنك دعمت…" (home, signed-in).
 */

export interface RailProject {
  id: string;
  titleAr: string;
  shortDescAr: string;
  slug?: string | null;
  status: string;
  fundedPct: number;
}

export function WathbaProjectsRail({
  title,
  subtitle,
  projects,
}: {
  title: string;
  subtitle?: string;
  projects: RailProject[];
}) {
  if (projects.length === 0) return null;
  return (
    <section dir="rtl" style={{ maxWidth: 1120, margin: '0 auto', padding: '38px 26px 10px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{title}</h2>
      {subtitle && (
        <p style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 14 }}>{subtitle}</p>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
          gap: 12,
          marginTop: subtitle ? 0 : 14,
        }}
      >
        {projects.map((p) => (
          <Link
            key={p.id}
            href={p.slug ? `/p/${p.slug}` : `/projects/${p.id}`}
            style={{
              display: 'block', padding: 14, borderRadius: 13,
              background: 'var(--card)', border: '1px solid rgba(var(--ink-rgb),.08)',
              textDecoration: 'none', color: 'var(--text)',
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 600, minHeight: 38, lineHeight: 1.5 }}>
              {p.titleAr}
            </div>
            <p
              style={{
                fontSize: 12, color: 'var(--muted2)', lineHeight: 1.6, margin: '6px 0 10px',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}
            >
              {p.shortDescAr}
            </p>
            <div style={{ height: 5, background: 'rgba(var(--accent-rgb),.16)', borderRadius: 999, overflow: 'hidden', marginBottom: 7 }}>
              <span style={{ display: 'block', height: '100%', width: `${Math.min(100, p.fundedPct)}%`, background: 'var(--accent)' }} />
            </div>
            <Num style={{ fontSize: 12.5, color: p.fundedPct >= 100 ? 'var(--accent-ink)' : 'var(--muted2)' }}>
              {p.fundedPct}% من الهدف
            </Num>
          </Link>
        ))}
      </div>
    </section>
  );
}
