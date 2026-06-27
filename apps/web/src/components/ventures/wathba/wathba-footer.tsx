'use client';

import { wathbaFooterCols, wathbaSocials } from './wathba-data';
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
          gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
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
            {wathbaSocials.map((s) => (
              <div
                key={s}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  border: '1px solid rgba(var(--ink-rgb),.1)',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <Icon name={s} size={19} color="var(--muted)" />
              </div>
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
              <div
                key={it}
                style={{
                  fontSize: 13.5,
                  color: 'var(--muted2)',
                  marginBottom: 12,
                  cursor: 'pointer',
                  width: 'fit-content',
                }}
              >
                {it}
              </div>
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
      </div>
    </footer>
  );
}
