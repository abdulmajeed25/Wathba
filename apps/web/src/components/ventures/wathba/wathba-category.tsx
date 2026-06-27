'use client';

import Link from 'next/link';

import {
  deriveProject,
  type WathbaProject,
  wathbaCategories,
  wathbaProjects,
} from './wathba-data';
import { Icon, Num } from './wathba-icons';

export function WathbaCategory({
  catId,
  projects,
}: {
  catId: string;
  projects?: WathbaProject[];
}) {
  // wathbaCategories is non-empty — fallback bang is safe.
  const cur = wathbaCategories.find((c) => c.id === catId) ?? wathbaCategories[0]!;
  const source = projects ?? wathbaProjects;
  const list = source.map(deriveProject).filter((p) => p.catId === cur.id);

  return (
    <div className="wathba-fade">
      <section
        style={{
          position: 'relative',
          borderBottom: '1px solid rgba(var(--ink-rgb),.07)',
          overflow: 'hidden',
        }}
      >
        <div className="wathba-ph" style={{ position: 'absolute', inset: 0, opacity: 0.5 }} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg,rgba(10,20,34,.6),var(--bg))',
          }}
        />
        <div
          style={{
            maxWidth: 1320,
            margin: '0 auto',
            padding: '60px 26px 40px',
            position: 'relative',
          }}
        >
          <Link
            href="/projects/discover"
            style={{
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 18,
              textDecoration: 'none',
            }}
          >
            <Icon name="arrow_forward" size={17} />
            كل الفئات
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                background:
                  'linear-gradient(135deg,rgba(var(--accent2-rgb),.25),rgba(var(--accent-rgb),.25))',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name={cur.icon} size={38} color="var(--accent)" />
            </div>
            <div>
              <h1 style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-1px' }}>{cur.ar}</h1>
              <Num style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                {cur.count} · <span style={{ color: 'var(--accent)' }}>{cur.en}</span>
              </Num>
            </div>
          </div>
        </div>
      </section>
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '34px 26px 0' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>مشاريع في {cur.ar}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
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
                textDecoration: 'none',
                color: 'inherit',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div className="wathba-ph" style={{ height: 170, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                  <Num style={{ fontSize: 11, color: 'var(--ph-label)' }}>[ {p.cat} ]</Num>
                </div>
              </div>
              <div
                style={{
                  padding: '16px 17px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                }}
              >
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{p.titleAr}</h3>
                <div style={{ fontSize: 12.5, color: 'var(--muted2)', marginBottom: 12 }}>
                  بواسطة {p.creator}
                </div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Num style={{ fontSize: 15, fontWeight: 700, color: p.pctColor }}>{p.pct}%</Num>
                    <Num style={{ fontSize: 12.5, color: 'var(--muted)' }}>{p.raisedFmt}</Num>
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
