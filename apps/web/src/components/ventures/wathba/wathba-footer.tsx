'use client';

import Link from 'next/link';

import { wathbaFooterCols, wathbaSocialLinks } from './wathba-data';
import { Icon, Num } from './wathba-icons';

export function WathbaFooter() {
  return (
    <footer
      style={{
        marginTop: 90,
        borderTop: '1px solid rgba(var(--ink-rgb),.07)',
        background: 'var(--footer)',
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: '54px 26px 30px',
          display: 'grid',
          // STAKES/S-2/M5 — auto-fit so the columns wrap instead of forcing a
          // ~778px min-content that pushed a horizontal scroll onto every page.
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 34,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: 'var(--grad)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name="rocket_launch" size={22} fill color="var(--on-accent)" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>وثبة</div>
          </div>
          <p
            style={{
              fontSize: 14,
              color: 'var(--muted2)',
              lineHeight: 1.7,
              maxWidth: 280,
            }}
          >
            منصة الدعم الجماعي التي تجمع المبدعين بمجتمعٍ يؤمن بأفكارهم — بشفافية وثقة.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            {/* STAKES/H5 — real outbound links (were decorative divs). */}
            {wathbaSocialLinks.map((s) => (
              <a
                key={s.icon}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  border: '1px solid rgba(var(--ink-rgb),.1)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name={s.icon} size={19} color="var(--muted)" />
              </a>
            ))}
          </div>
        </div>
        {wathbaFooterCols.map((col) => (
          <div key={col.title}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--text-soft)',
                marginBottom: 16,
              }}
            >
              {col.title}
            </div>
            {col.items.map((it) => (
              <Link
                key={it.label}
                href={it.href}
                style={{
                  display: 'block',
                  fontSize: 13.5,
                  color: 'var(--muted2)',
                  // STAKES/S-2 — 5px block padding lifts the tap target to ≥24px
                  // (WCAG 2.5.8 AA); marginBottom trimmed to keep the rhythm.
                  padding: '5px 0',
                  marginBottom: 6,
                  cursor: 'pointer',
                  width: 'fit-content',
                  textDecoration: 'none',
                }}
              >
                {it.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: '20px 26px',
          borderTop: '1px solid rgba(var(--ink-rgb),.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Num style={{ fontSize: 12.5, color: 'var(--muted2)' }}>
          © 2026 وثبة — WATHBA. جميع الحقوق محفوظة.
        </Num>
        <span style={{ fontSize: 12.5, color: 'var(--muted2)' }}>صُمّم بشغف للمبدعين العرب</span>
        {/* STAKES/Q5 — version/build stamp ("which build is live?").
            S-13 (F-07): --muted at 12px, no opacity — the 11.5px muted2 @ .8
            stamp failed AA contrast on every page (the S-9 regression). */}
        <Num style={{ fontSize: 12, color: 'var(--muted)' }} className="num" >
          v{process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0'}
          {process.env.NEXT_PUBLIC_BUILD_SHA ? ` · ${process.env.NEXT_PUBLIC_BUILD_SHA.slice(0, 7)}` : ''}
        </Num>
      </div>
    </footer>
  );
}
