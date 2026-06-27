'use client';

import Link from 'next/link';

import { wathbaRanks } from './wathba-data';
import { Icon, Num } from './wathba-icons';

/**
 * Ranks page — 1:1 visual port of WATBHوثبة.dc.html lines 1147-1175.
 * Hero (eyebrow pill + headline + lede) over a 5-card rank grid with a
 * gradient CTA strip below. All sizes/spacing/colors are literal copies of
 * the inline styles in the design; tokenized values resolve through the
 * Wathba CSS variables defined in wathba-tokens.ts.
 */
export function WathbaRanks() {
  return (
    <div className="wathba-fade">
      {/* Hero — design 1149-1153 */}
      <section
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '54px 26px 0',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(251,191,36,.1)',
            border: '1px solid rgba(251,191,36,.3)',
            color: 'var(--gold)',
            padding: '7px 15px',
            borderRadius: 30,
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 18,
          }}
        >
          <Icon name="workspace_premium" size={17} fill />
          نظام رتب الداعمين
        </div>
        <h1
          style={{
            fontSize: 46,
            fontWeight: 700,
            letterSpacing: '-1.2px',
            marginBottom: 14,
          }}
        >
          كلما دعمت أكثر،
          <br />
          <span
            style={{
              background: 'linear-gradient(120deg,var(--blue),var(--accent) 60%,var(--purple))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            ارتقت مكانتك
          </span>
        </h1>
        <p
          style={{
            fontSize: 17,
            color: 'var(--text-soft)',
            maxWidth: 560,
            margin: '0 auto',
          }}
        >
          على وثبة، دعمك ليس مجرد تبرّع — إنه رحلة. كل مشروع تدعمه يقرّبك من رتبة أعلى ومزايا حصرية
          تليق بشغفك.
        </p>
      </section>

      {/* 5-card rank grid — design 1154-1169 */}
      <section style={{ maxWidth: 1100, margin: '48px auto 0', padding: '0 26px 10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
          {wathbaRanks.map((r) => (
            <div
              key={r.id}
              className="wathba-lift"
              data-testid={`wathba-rank-card-${r.id}`}
              style={{
                background: 'var(--card)',
                border: `1px solid ${r.border}`,
                borderRadius: 18,
                padding: '24px 18px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              {/* Medallion — rank-specific bg + optional glow */}
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 16,
                  background: r.bg,
                  display: 'grid',
                  placeItems: 'center',
                  marginBottom: 16,
                  boxShadow: r.glow !== 'none' ? r.glow : undefined,
                }}
              >
                <Icon name={r.icon} size={30} fill color={r.icoColor} />
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: r.titleColor,
                  marginBottom: 2,
                }}
              >
                {r.ar}
              </div>
              <Num
                style={{
                  fontSize: 10.5,
                  letterSpacing: '2px',
                  color: 'var(--muted2)',
                  marginBottom: 10,
                  display: 'block',
                }}
              >
                {r.en}
              </Num>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--text-soft)',
                  background: 'rgba(var(--ink-rgb),.04)',
                  borderRadius: 8,
                  padding: '6px 10px',
                  marginBottom: 16,
                  width: 'fit-content',
                }}
              >
                {r.req}
              </div>
              <div
                style={{
                  borderTop: '1px solid rgba(var(--ink-rgb),.07)',
                  paddingTop: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {r.perks.map((pk) => (
                  <div
                    key={pk}
                    style={{
                      display: 'flex',
                      gap: 8,
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      color: 'var(--muted)',
                    }}
                  >
                    <Icon
                      name="check_circle"
                      size={16}
                      color={r.titleColor}
                      style={{ flexShrink: 0 }}
                    />
                    {pk}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTA strip — design 1170-1172 */}
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <Link
            href="/projects/discover"
            style={{
              border: 'none',
              cursor: 'pointer',
              background: 'var(--grad)',
              color: 'var(--on-accent)',
              fontWeight: 700,
              fontSize: 16,
              padding: '15px 30px',
              borderRadius: 14,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            ابدأ رحلتك — ادعم مشروعاً
          </Link>
        </div>
      </section>
    </div>
  );
}
