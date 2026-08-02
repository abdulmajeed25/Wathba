'use client';

import Link from 'next/link';

import { wathbaRanks, wathbaRanksSoon } from './wathba-data';
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
            color: 'var(--gold-ink)',
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
          على وثبة، دعمك ليس مجرد تبرّع — إنه رحلة. كل مشروع تدعمه يقرّبك من رتبة أعلى على المنصّة.
        </p>
      </section>

      {/* Batch FIX Unit 6 — what a rank IS, and what it is not.
          The page kept getting read as "these are the rewards I get for
          backing", which is the creator's rewards tab, a different thing
          entirely. Saying so plainly is cheaper than any amount of design. */}
      <section
        data-testid="wathba-ranks-explainer"
        style={{ maxWidth: 780, margin: '30px auto 0', padding: '0 26px' }}
      >
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid rgba(var(--ink-rgb),.09)',
            borderRadius: 16,
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {[
            { icon: 'workspace_premium', t: 'ما هي الرتب؟', b: 'رتبتك هي مكانتك على وثبة ككل — تتقدّم كلما دعمت مشاريع أكثر أو ساهمت بمبالغ أكبر عبر المنصّة.' },
            { icon: 'trending_up', t: 'كيف ترتفع؟', b: 'تلقائياً. لا تسجيل ولا طلب: بمجرد أن يتجاوز سجلّك حدّ الرتبة التالية تنتقل إليها، ويظهر ذلك على ملفك.' },
            { icon: 'info', t: 'ما الفرق عن مكافآت المشروع؟', b: 'مزايا الرتب يقدّمها وثبة على مستوى المنصّة. أما مكافآت المشروع — المنتجات والنسخ المحدودة وما شابه — فيقدّمها المبدع داخل حملته، وتجدها في تبويب «المكافآت» بصفحة المشروع.' },
          ].map((row) => (
            <div key={row.t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Icon name={row.icon} size={19} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 3 }}>{row.t}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-soft)' }}>{row.b}</div>
              </div>
            </div>
          ))}
        </div>
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

        {/* Batch FIX Unit 6 — «قريباً», kept OUTSIDE the cards on purpose.
            These used to sit in the tier lists as though they were live: virtual
            meetups, Wathba events, early access to limited rewards. None has a
            system behind it, so listing them beside a price was a promise the
            product could not keep. Muted, dashed, no check marks, and its own
            heading — nothing here can be mistaken for something you get today. */}
        <section
          data-testid="wathba-ranks-soon"
          style={{ marginTop: 34, paddingTop: 26, borderTop: '1px dashed rgba(var(--ink-rgb),.16)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
            <Icon name="schedule" size={18} color="var(--muted2)" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--muted)' }}>قريباً — قيد التطوير</h2>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--muted2)', marginBottom: 14, maxWidth: 620, lineHeight: 1.7 }}>
            هذه ليست جزءاً من مزايا الرتب الحالية، ولا نلتزم بموعد لإطلاقها. نذكرها هنا للشفافية فقط.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {wathbaRanksSoon.map((s) => (
              <span
                key={s}
                style={{
                  fontSize: 12.5,
                  color: 'var(--muted2)',
                  border: '1px dashed rgba(var(--ink-rgb),.2)',
                  borderRadius: 999,
                  padding: '6px 13px',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </section>

        {/* CTA strip — design 1170-1172 */}
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <Link
            href="/projects/discover-all"
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
