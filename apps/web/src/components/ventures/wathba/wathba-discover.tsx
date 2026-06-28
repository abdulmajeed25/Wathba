'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import {
  deriveProject,
  type WathbaProject,
  wathbaCategories,
  wathbaProjects,
  wathbaSortOptions,
  wathbaStatusOptions,
} from './wathba-data';
import { Icon, Num } from './wathba-icons';

export function WathbaDiscover({
  initialCat = 'all',
  initialSort = 'trending',
  initialStatus = 'all',
  projects,
}: {
  initialCat?: string;
  initialSort?: string;
  initialStatus?: string;
  projects?: WathbaProject[];
}) {
  const [cat, setCat] = useState(initialCat);
  const [sort, setSort] = useState(initialSort);
  const [status, setStatus] = useState(initialStatus);
  const source = projects ?? wathbaProjects;

  const list = useMemo(() => {
    let d = source.map(deriveProject);
    if (cat !== 'all') d = d.filter((p) => p.catId === cat);
    if (status === 'live') d = d.filter((p) => p.pct < 100);
    else if (status === 'funded') d = d.filter((p) => p.pct >= 100);
    else if (status === 'near') d = d.filter((p) => p.pct >= 70 && p.pct < 100);
    if (sort === 'newest') d.sort((a, b) => b.daysLeft - a.daysLeft);
    else if (sort === 'mostfunded') d.sort((a, b) => b.raised - a.raised);
    else if (sort === 'ending') d.sort((a, b) => a.daysLeft - b.daysLeft);
    else if (sort === 'backers') d.sort((a, b) => b.backers - a.backers);
    else d.sort((a, b) => b.pct - a.pct);
    return d;
  }, [cat, sort, status, source]);

  const chips = [{ id: 'all', ar: 'الكل', icon: 'apps' }, ...wathbaCategories];

  return (
    <div className="wathba-fade">
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '48px 26px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 26,
          }}
        >
          <div>
            <Num style={{ fontSize: 12, letterSpacing: '2px', color: 'var(--accent)', marginBottom: 8, display: 'block' }}>
              DISCOVER
            </Num>
            <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-1px' }}>استكشف المشاريع</h1>
            <p style={{ fontSize: 15, color: 'var(--muted)', marginTop: 8 }}>
              <Num style={{ color: 'var(--text)', fontWeight: 700 }}>{list.length}</Num>{' '}
              مشروعاً ينتظر دعمك الآن
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 9,
              background: 'rgba(var(--ink-rgb),.04)',
              border: '1px solid rgba(var(--ink-rgb),.08)',
              borderRadius: 13,
              padding: 6,
              flexWrap: 'wrap',
            }}
          >
            {wathbaSortOptions.map((o) => (
              <span
                key={o.id}
                onClick={() => setSort(o.id)}
                style={{
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '8px 14px',
                  borderRadius: 9,
                  color: sort === o.id ? 'var(--accent)' : 'var(--muted)',
                  background: sort === o.id ? 'rgba(var(--accent-rgb),.12)' : 'transparent',
                }}
              >
                {o.label}
              </span>
            ))}
          </div>
        </div>

        {/* category chips */}
        <div style={{ display: 'flex', gap: 11, flexWrap: 'wrap', marginBottom: 18 }}>
          {chips.map((c) => {
            const active = cat === c.id;
            return (
              <span
                key={c.id}
                onClick={() => setCat(c.id)}
                style={{
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: '9px 16px',
                  borderRadius: 30,
                  background: active ? 'var(--grad)' : 'rgba(var(--ink-rgb),.04)',
                  color: active ? 'var(--on-accent)' : 'var(--muted)',
                  border: `1px solid ${active ? 'transparent' : 'rgba(var(--ink-rgb),.1)'}`,
                }}
              >
                <Icon name={c.icon} size={17} />
                {c.ar}
              </span>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 34,
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12.5, color: 'var(--muted2)', marginInlineEnd: 4 }}>الحالة:</span>
          {wathbaStatusOptions.map((o) => {
            const active = status === o.id;
            return (
              <span
                key={o.id}
                onClick={() => setStatus(o.id)}
                style={{
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: '7px 14px',
                  borderRadius: 30,
                  background: active ? 'var(--grad)' : 'transparent',
                  color: active ? 'var(--on-accent)' : 'var(--muted)',
                  border: `1px solid ${active ? 'transparent' : 'rgba(var(--ink-rgb),.12)'}`,
                }}
              >
                {o.label}
              </span>
            );
          })}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 18,
            paddingBottom: 20,
          }}
        >
          {list.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              style={{
                cursor: 'pointer',
                background: 'var(--card)',
                border: '1px solid rgba(var(--ink-rgb),.08)',
                borderRadius: 18,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--card-shadow)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div className="wathba-ph" style={{ height: 170, position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Num style={{ fontSize: 11, color: 'var(--ph-label)' }}>[ {p.cat} ]</Num>
                </div>
                <div
                  style={{
                    position: 'absolute',
                    top: 11,
                    right: 11,
                    background: 'rgba(6,18,31,.8)',
                    backdropFilter: 'blur(5px)',
                    border: '1px solid rgba(var(--ink-rgb),.12)',
                    color: 'var(--text-soft)',
                    padding: '5px 10px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {p.cat}
                </div>
                {p.platformPartner && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 11,
                      bottom: 11,
                      background: 'rgba(var(--purple-rgb),.92)',
                      color: 'var(--on-accent)',
                      padding: '4px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Icon name="verified" size={12} color="var(--on-accent)" />
                    بشراكة وثبة
                  </div>
                )}
              </div>
              <div
                style={{
                  padding: '16px 17px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                }}
              >
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, letterSpacing: '-.3px' }}>
                  {p.titleAr}
                </h3>
                <div style={{ fontSize: 12.5, color: 'var(--muted2)', marginBottom: 8 }}>
                  بواسطة {p.creator}
                </div>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 14 }}>
                  {p.desc}
                </p>
                <div style={{ marginTop: 'auto' }}>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 30,
                      background: 'rgba(var(--ink-rgb),.08)',
                      overflow: 'hidden',
                      marginBottom: 10,
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
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Num style={{ fontSize: 15, fontWeight: 700, color: p.pctColor }}>{p.pct}%</Num>
                    <Num style={{ fontSize: 12.5, color: 'var(--muted)' }}>{p.raisedFmt}</Num>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: 8,
                      fontSize: 11.5,
                      color: 'var(--muted2)',
                    }}
                  >
                    <Num>{p.backersFmt} داعم</Num>
                    <Num>{p.daysLeft} يوم متبقٍ</Num>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
