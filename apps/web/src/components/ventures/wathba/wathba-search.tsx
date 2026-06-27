'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { deriveProject, type WathbaProject, wathbaProjects } from './wathba-data';
import { Icon, Num } from './wathba-icons';

const suggestions = ['تقنية', 'درون', 'لعبة', 'فيلم وثائقي', 'موسيقى', 'حديقة ذكية', 'رواية مصوّرة'];

export function WathbaSearch({
  initialQ = '',
  projects,
}: {
  initialQ?: string;
  projects?: WathbaProject[];
}) {
  const [q, setQ] = useState(initialQ);
  const source = projects ?? wathbaProjects;
  const list = useMemo(() => {
    const all = source.map(deriveProject);
    const trimmed = q.trim();
    if (!trimmed) return all;
    return all.filter((p) =>
      `${p.titleAr} ${p.titleEn} ${p.creator} ${p.cat} ${p.desc}`.includes(trimmed),
    );
  }, [q, source]);

  return (
    <div className="wathba-fade">
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '48px 26px 0' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-.7px', marginBottom: 20 }}>
          ابحث في وثبة
        </h1>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(var(--ink-rgb),.05)',
            border: '1.5px solid rgba(var(--accent-rgb),.3)',
            borderRadius: 16,
            padding: '16px 20px',
            marginBottom: 18,
          }}
        >
          <Icon name="search" size={26} color="var(--accent)" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن مشاريع، مبدعين، فئات…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text)',
              fontSize: 17,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--muted2)' }}>اقتراحات:</span>
          {suggestions.map((s) => (
            <span
              key={s}
              onClick={() => setQ(s)}
              style={{
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                padding: '7px 14px',
                borderRadius: 30,
                background: 'rgba(var(--ink-rgb),.04)',
                color: 'var(--muted)',
                border: '1px solid rgba(var(--ink-rgb),.1)',
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </section>
      <section style={{ maxWidth: 1320, margin: '30px auto 0', padding: '0 26px 10px' }}>
        <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
          <Num style={{ color: 'var(--text)', fontWeight: 700 }}>{list.length}</Num> نتيجة
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 18,
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
              <div className="wathba-ph" style={{ height: 160, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                  <Num style={{ fontSize: 11, color: 'var(--ph-label)' }}>[ {p.cat} ]</Num>
                </div>
                <div
                  style={{
                    position: 'absolute',
                    top: 11,
                    right: 11,
                    background: 'rgba(6,18,31,.8)',
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
              </div>
              <div
                style={{
                  padding: '15px 16px 17px',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                }}
              >
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{p.titleAr}</h3>
                <div style={{ fontSize: 12.5, color: 'var(--muted2)', marginBottom: 13 }}>
                  بواسطة {p.creator}
                </div>
                <div style={{ marginTop: 'auto' }}>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 30,
                      background: 'rgba(var(--ink-rgb),.08)',
                      overflow: 'hidden',
                      marginBottom: 9,
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
                    }}
                  >
                    <Num style={{ fontSize: 14, fontWeight: 700, color: p.pctColor }}>{p.pct}%</Num>
                    <Num style={{ fontSize: 12, color: 'var(--muted2)' }}>{p.raisedFmt}</Num>
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
