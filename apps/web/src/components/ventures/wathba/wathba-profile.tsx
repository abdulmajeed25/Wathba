'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { ApiBackingRow } from '@/lib/api/wathba';

import { adaptApiVenture, deriveProject, wathbaProjects, type DerivedProject } from './wathba-data';
import { Icon, Num } from './wathba-icons';

/**
 * Wathba (وثبة) — Profile surface.
 *
 * 1:1 port of WATBHوثبة.dc.html lines 1058-1144 (the rProfile section).
 * Every literal hex / gradient / radius below comes verbatim from the design
 * markup; the only thing the React port adds is real navigation (the design
 * is a single-page Demo file so cards no-op).
 *
 * Live backings can be threaded in from the page-level SSR fetch
 * (`/v1/ventures/me/backings`) — when present they drive the "backed" tab,
 * otherwise we fall back to the design's fixture slice
 * (`[list[0], list[5], list[6], list[1]]`).
 */

// ─────────────── design data (lines 1477-1480 + 1721-1723) ───────────────

const profileTabs = [
  { id: 'backed', label: 'مشاريع دعمتها', icon: 'favorite' },
  { id: 'created', label: 'مشاريعي', icon: 'rocket_launch' },
  { id: 'saved', label: 'المحفوظة', icon: 'bookmark' },
] as const;

type ProfileTabId = (typeof profileTabs)[number]['id'];

const heroStats = [
  { v: '12', l: 'مشروعاً دعمته' },
  { v: '$3,840', l: 'إجمالي الدعم' },
  { v: '1', l: 'مشروع أطلقته' },
];

// ─────────────── adapter helpers ───────────────

/**
 * Map a live backing row → DerivedProject card by stitching the venture slug
 * back onto the matching fixture (same mechanism as `adaptApiVenture`). Rows
 * whose slug doesn't match a fixture are skipped so the grid never shows a
 * broken card.
 */
function backingToProject(row: ApiBackingRow): DerivedProject | null {
  if (!row.venture) return null;
  const adapted = adaptApiVenture({
    id: row.venture.id,
    slug: row.venture.slug,
    title: row.venture.title,
    tagline: null,
    state: row.venture.state,
    fundingGoal: '1',
    fundingRaised: '0',
    fundingDeadline: null,
    trustScore: null,
  });
  if (!adapted) return null;
  return deriveProject(adapted);
}

// ─────────────── component ───────────────

export interface WathbaProfileProps {
  /** Optional live backings from GET /v1/ventures/me/backings. */
  backings?: ApiBackingRow[] | null;
}

export function WathbaProfile({ backings }: WathbaProfileProps = {}) {
  const [tab, setTab] = useState<ProfileTabId>('backed');

  const list = wathbaProjects.map(deriveProject);
  // Fixture slices that mirror the design's design-time state (lines 1721-1723).
  const fixtureBacked = [list[0], list[5], list[6], list[1]].filter(
    (p): p is DerivedProject => Boolean(p),
  );
  const created = [list[2]].filter((p): p is DerivedProject => Boolean(p));
  const saved = [list[3], list[7]].filter((p): p is DerivedProject => Boolean(p));

  // Prefer live backings when present; otherwise the design fixture so the
  // grid keeps its 4-column rhythm.
  const liveBacked =
    backings && backings.length > 0
      ? backings.map(backingToProject).filter((p): p is DerivedProject => p !== null)
      : [];
  const backed = liveBacked.length > 0 ? liveBacked : fixtureBacked;

  return (
    <div className="wathba-fade">
      {/* ─────────── hero (lines 1060-1085) ─────────── */}
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderBottom: '1px solid rgba(var(--ink-rgb),.07)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(800px 300px at 80% 0%,rgba(251,191,36,.10),transparent 60%),radial-gradient(700px 300px at 10% 0%,rgba(var(--accent-rgb),.10),transparent 55%)',
          }}
        />
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: '48px 26px 30px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 26,
            flexWrap: 'wrap',
          }}
        >
          {/* avatar with gold rank badge */}
          <div
            style={{
              width: 108,
              height: 108,
              borderRadius: 28,
              background: 'var(--grad)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              color: 'var(--on-accent)',
              fontSize: 46,
              boxShadow: '0 16px 40px -12px rgba(var(--accent-rgb),.6)',
              position: 'relative',
            }}
          >
            س
            <div
              style={{
                position: 'absolute',
                bottom: -8,
                right: -8,
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'var(--gold)',
                border: '3px solid var(--bg)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name="workspace_premium" size={20} fill color="var(--on-accent)" />
            </div>
          </div>

          {/* name + rank + bio + stats */}
          <div style={{ flex: 1, minWidth: 260 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 6,
                flexWrap: 'wrap',
              }}
            >
              <h1 style={{ fontSize: 32, fontWeight: 700 }}>سارة العامري</h1>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  padding: '5px 14px',
                  borderRadius: 20,
                  color: 'var(--gold)',
                  border: '1px solid rgba(251,191,36,.4)',
                  background: 'rgba(251,191,36,.1)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon name="workspace_premium" size={16} fill />
                سفير
              </span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 18 }}>
              داعمة للإبداع العربي · انضمّت يناير ٢٠٢٥ · دبي، الإمارات
            </p>
            <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap' }}>
              {heroStats.map((s) => (
                <div key={s.l}>
                  <Num
                    className="num"
                    style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}
                  >
                    {s.v}
                  </Num>
                  <span style={{ fontSize: 13, color: 'var(--muted2)', marginInlineStart: 6 }}>
                    {s.l}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* rank progress card */}
          <div
            style={{
              width: 280,
              background: 'rgba(var(--ink-rgb),.04)',
              border: '1px solid rgba(var(--ink-rgb),.1)',
              borderRadius: 16,
              padding: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>سفير</span>
              <span style={{ fontSize: 13, color: 'var(--purple)', fontWeight: 600 }}>
                شريك مؤسس
              </span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 30,
                background: 'rgba(var(--ink-rgb),.08)',
                overflow: 'hidden',
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: '64%',
                  background: 'linear-gradient(90deg,var(--gold),var(--purple))',
                  borderRadius: 30,
                }}
              />
            </div>
            <Num className="num" style={{ fontSize: 12, color: 'var(--muted)' }}>
              $6,160 تفصلك عن رتبة «شريك مؤسس»
            </Num>
          </div>
        </div>
      </section>

      {/* ─────────── tabs + content (lines 1087-1143) ─────────── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '26px 26px 0' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 26, flexWrap: 'wrap' }}>
          {profileTabs.map((t) => {
            const isActive = tab === t.id;
            return (
              <span
                key={t.id}
                role="button"
                tabIndex={0}
                data-tab={t.id}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setTab(t.id);
                }}
                style={{
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '10px 18px',
                  borderRadius: 12,
                  color: isActive ? 'var(--accent)' : 'var(--muted)',
                  background: isActive ? 'rgba(var(--accent-rgb),.1)' : 'transparent',
                  border: `1px solid ${
                    isActive ? 'rgba(var(--accent-rgb),.3)' : 'rgba(var(--ink-rgb),.1)'
                  }`,
                }}
              >
                <Icon name={t.icon} size={18} />
                {t.label}
              </span>
            );
          })}
        </div>

        {tab === 'backed' && <BackedGrid projects={backed} />}
        {tab === 'created' && <CreatedList projects={created} />}
        {tab === 'saved' && <SavedGrid projects={saved} />}
      </section>
    </div>
  );
}

// ─────────────── backed grid (lines 1094-1108) ───────────────

function BackedGrid({ projects }: { projects: DerivedProject[] }) {
  return (
    <div
      className="wathba-fade"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}
    >
      {projects.map((p) => (
        <Link
          key={p.id}
          href={`/projects/${p.id}`}
          className="lift"
          style={{
            cursor: 'pointer',
            background: 'var(--card)',
            border: '1px solid rgba(var(--ink-rgb),.08)',
            borderRadius: 18,
            overflow: 'hidden',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div className="wathba-ph" style={{ height: 140, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Num className="num" style={{ fontSize: 11, color: 'var(--ph-label)' }}>
                [ {p.cat} ]
              </Num>
            </div>
          </div>
          <div style={{ padding: '15px 16px 17px' }}>
            <h3 style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 4 }}>{p.titleAr}</h3>
            <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 12 }}>
              بواسطة {p.creator}
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 30,
                background: 'rgba(var(--ink-rgb),.08)',
                overflow: 'hidden',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: p.pctW,
                  background: p.barGrad,
                  borderRadius: 30,
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Num className="num" style={{ fontSize: 13, fontWeight: 700, color: p.pctColor }}>
                {p.pct}%
              </Num>
              <Num className="num" style={{ fontSize: 12, color: 'var(--muted2)' }}>
                {p.daysLeft} يوم
              </Num>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─────────────── created list (lines 1110-1125) ───────────────

function CreatedList({ projects }: { projects: DerivedProject[] }) {
  return (
    <div className="wathba-fade">
      {projects.map((p) => (
        <div
          key={p.id}
          style={{
            background: 'var(--card)',
            border: '1px solid rgba(var(--ink-rgb),.08)',
            borderRadius: 18,
            padding: 20,
            display: 'flex',
            gap: 20,
            alignItems: 'center',
            marginBottom: 14,
            flexWrap: 'wrap',
          }}
        >
          <div
            className="wathba-ph"
            style={{ width: 180, height: 110, borderRadius: 13, flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{p.titleAr}</h3>
            <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
              <Num className="num" style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 700 }}>
                {p.raisedFmt}
              </Num>
              <Num className="num" style={{ fontSize: 14, color: 'var(--muted)' }}>
                {p.backersFmt} داعم
              </Num>
              <Num className="num" style={{ fontSize: 14, color: 'var(--muted)' }}>
                {p.daysLeft} يوم متبقٍ
              </Num>
            </div>
            <div
              style={{
                height: 7,
                borderRadius: 30,
                background: 'rgba(var(--ink-rgb),.08)',
                overflow: 'hidden',
                maxWidth: 400,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: p.pctW,
                  background: p.barGrad,
                  borderRadius: 30,
                }}
              />
            </div>
          </div>
          <Link
            href="/projects/dashboard"
            className="btnp"
            style={{
              border: 'none',
              cursor: 'pointer',
              background: 'var(--grad)',
              color: 'var(--on-accent)',
              fontWeight: 700,
              fontSize: 13.5,
              padding: '11px 18px',
              borderRadius: 12,
              textDecoration: 'none',
            }}
          >
            إدارة المشروع
          </Link>
        </div>
      ))}
      <Link
        href="/projects/start"
        className="btng"
        style={{
          border: '1.5px dashed rgba(var(--accent-rgb),.3)',
          borderRadius: 16,
          padding: 24,
          textAlign: 'center',
          cursor: 'pointer',
          color: 'var(--accent)',
          fontWeight: 600,
          fontSize: 15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
          textDecoration: 'none',
        }}
      >
        <Icon name="add_circle" size={22} />
        أطلق مشروعاً جديداً
      </Link>
    </div>
  );
}

// ─────────────── saved grid (lines 1127-1141) ───────────────

function SavedGrid({ projects }: { projects: DerivedProject[] }) {
  return (
    <div
      className="wathba-fade"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}
    >
      {projects.map((p) => (
        <Link
          key={p.id}
          href={`/projects/${p.id}`}
          className="lift"
          style={{
            cursor: 'pointer',
            background: 'var(--card)',
            border: '1px solid rgba(var(--ink-rgb),.08)',
            borderRadius: 18,
            overflow: 'hidden',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div className="wathba-ph" style={{ height: 140, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: 11,
                left: 11,
                width: 30,
                height: 30,
                borderRadius: 9,
                background: 'rgba(6,18,31,.8)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name="bookmark" size={17} fill color="var(--gold)" />
            </div>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Num className="num" style={{ fontSize: 11, color: 'var(--ph-label)' }}>
                [ {p.cat} ]
              </Num>
            </div>
          </div>
          <div style={{ padding: '15px 16px 17px' }}>
            <h3 style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 4 }}>{p.titleAr}</h3>
            <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 12 }}>
              بواسطة {p.creator}
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 30,
                background: 'rgba(var(--ink-rgb),.08)',
                overflow: 'hidden',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: p.pctW,
                  background: p.barGrad,
                  borderRadius: 30,
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Num className="num" style={{ fontSize: 13, fontWeight: 700, color: p.pctColor }}>
                {p.pct}%
              </Num>
              <Num className="num" style={{ fontSize: 12, color: 'var(--muted2)' }}>
                {p.daysLeft} يوم
              </Num>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
