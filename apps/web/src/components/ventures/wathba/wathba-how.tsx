'use client';

import Link from 'next/link';

import { wathbaHowSteps, wathbaProjectFaqs } from './wathba-data';
import { Icon, Num } from './wathba-icons';

/**
 * How-it-works page — 1:1 visual port of WATBHوثبة.dc.html lines 1178-1233.
 * Hero, two 3-card step bands (للمبدعين + للداعمين with giant ghost numbers
 * behind the creator cards), a 3-up fees band, an FAQ list and a gradient
 * CTA strip. Every dimension/color is a literal copy of the inline styles
 * in the source design.
 */
export function WathbaHow() {
  // Backer steps — design 1201-1203, inlined verbatim (the design hard-codes
  // these three cards rather than driving them from a data array).
  const backerSteps: readonly { icon: string; title: string; body: string }[] = [
    {
      icon: 'search',
      title: 'اكتشف',
      body: 'تصفّح آلاف المشاريع عبر الفئات، واعثر على ما يلامس شغفك.',
    },
    {
      icon: 'redeem',
      title: 'ادعم',
      body: 'اختر مستوى الدعم المناسب، واحصل على مكافآت حصرية ورتبة ترتقي بدعمك.',
    },
    {
      icon: 'visibility',
      title: 'تابع بشفافية',
      body: 'راقب تقدّم المشروع ولوحة الميزانية الحيّة حتى وصول مكافأتك إليك.',
    },
  ];

  return (
    <div className="wathba-fade">
      {/* Hero — design 1180-1184 */}
      <section
        style={{
          maxWidth: 1000,
          margin: '0 auto',
          padding: '58px 26px 0',
          textAlign: 'center',
        }}
      >
        <Num
          style={{
            fontSize: 12,
            letterSpacing: '2px',
            color: 'var(--accent)',
            marginBottom: 12,
            display: 'block',
          }}
        >
          HOW IT WORKS
        </Num>
        <h1
          style={{
            fontSize: 48,
            fontWeight: 700,
            letterSpacing: '-1.3px',
            marginBottom: 16,
          }}
        >
          كيف تعمل{' '}
          <span
            style={{
              background: 'linear-gradient(120deg,var(--blue),var(--accent) 60%,var(--purple))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            وثبة
          </span>
        </h1>
        <p
          style={{
            fontSize: 18,
            color: 'var(--text-soft)',
            maxWidth: 580,
            margin: '0 auto',
          }}
        >
          منصة بسيطة وشفافة تربط المبدعين بالداعمين. سواء كنت تطلق فكرة أو تدعم واحدة — العملية
          واضحة من البداية للنهاية.
        </p>
      </section>

      {/* Creator + backer step bands — design 1186-1205 */}
      <section style={{ maxWidth: 1160, margin: '50px auto 0', padding: '0 26px' }}>
        {/* Creators heading — design 1187 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'var(--grad)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Icon name="rocket_launch" size={22} color="var(--on-accent)" />
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 700 }}>للمبدعين</h2>
        </div>

        {/* Creator 3-col steps with giant ghost number — design 1188-1197 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 18,
            marginBottom: 50,
          }}
        >
          {wathbaHowSteps.map((s) => (
            <div
              key={s.n}
              className="wathba-lift"
              data-testid={`wathba-how-step-${s.n}`}
              style={{
                background: 'var(--card)',
                border: '1px solid rgba(var(--ink-rgb),.08)',
                borderRadius: 20,
                padding: 28,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <Num
                style={{
                  position: 'absolute',
                  top: -14,
                  left: 18,
                  fontSize: 84,
                  fontWeight: 700,
                  color: 'rgba(var(--accent-rgb),.06)',
                }}
              >
                {s.n}
              </Num>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 15,
                  background: 'rgba(var(--accent-rgb),.1)',
                  display: 'grid',
                  placeItems: 'center',
                  marginBottom: 18,
                  position: 'relative',
                }}
              >
                <Icon name={s.icon} size={26} color="var(--accent)" />
              </div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 9,
                  position: 'relative',
                }}
              >
                {s.titleAr}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--muted)',
                  lineHeight: 1.65,
                  position: 'relative',
                }}
              >
                {s.descAr}
              </p>
            </div>
          ))}
        </div>

        {/* Backers heading — design 1199 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'rgba(251,191,36,.15)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Icon name="favorite" size={22} color="var(--gold)" />
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 700 }}>للداعمين</h2>
        </div>

        {/* Backer 3-col cards — design 1200-1204 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
          {backerSteps.map((s) => (
            <div
              key={s.title}
              className="wathba-lift"
              style={{
                background: 'var(--card)',
                border: '1px solid rgba(var(--ink-rgb),.08)',
                borderRadius: 20,
                padding: 28,
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 15,
                  background: 'rgba(251,191,36,.1)',
                  display: 'grid',
                  placeItems: 'center',
                  marginBottom: 18,
                }}
              >
                <Icon name={s.icon} size={26} color="var(--gold)" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 9 }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.65 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Fees band — design 1208-1214 */}
      <section style={{ maxWidth: 1160, margin: '60px auto 0', padding: '0 26px' }}>
        <div
          style={{
            background: 'var(--band)',
            border: '1px solid rgba(var(--ink-rgb),.08)',
            borderRadius: 24,
            padding: 40,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 30,
            textAlign: 'center',
          }}
        >
          <div>
            <Num
              style={{
                fontSize: 46,
                fontWeight: 700,
                color: 'var(--accent)',
                display: 'block',
              }}
            >
              5%
            </Num>
            <div style={{ fontSize: 15, fontWeight: 600, margin: '6px 0 6px' }}>رسوم المنصة</div>
            <p style={{ fontSize: 13, color: 'var(--muted2)' }}>
              تُحتسب فقط عند نجاح الحملة. لا رسوم على الفشل.
            </p>
          </div>
          <div style={{ borderInline: '1px solid rgba(var(--ink-rgb),.08)' }}>
            <Num
              style={{
                fontSize: 46,
                fontWeight: 700,
                color: 'var(--blue)',
                display: 'block',
              }}
            >
              0
            </Num>
            <div style={{ fontSize: 15, fontWeight: 600, margin: '6px 0 6px' }}>رسوم الإطلاق</div>
            <p style={{ fontSize: 13, color: 'var(--muted2)' }}>
              إنشاء وإطلاق مشروعك مجاني تماماً.
            </p>
          </div>
          <div>
            <Num
              style={{
                fontSize: 46,
                fontWeight: 700,
                color: 'var(--pos)',
                display: 'block',
              }}
            >
              100%
            </Num>
            <div style={{ fontSize: 15, fontWeight: 600, margin: '6px 0 6px' }}>استرداد مضمون</div>
            <p style={{ fontSize: 13, color: 'var(--muted2)' }}>
              يُعاد دعمك كاملاً إن لم يصل المشروع لهدفه.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ list — design 1216-1224 */}
      <section style={{ maxWidth: 820, margin: '60px auto 0', padding: '0 26px' }}>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: 24,
          }}
        >
          أسئلة شائعة
        </h2>
        {wathbaProjectFaqs.map((f) => (
          <div
            key={f.q}
            style={{
              background: 'var(--card)',
              border: '1px solid rgba(var(--ink-rgb),.08)',
              borderRadius: 14,
              padding: '20px 22px',
              marginBottom: 12,
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
              <Icon name="help" size={20} color="var(--accent)" />
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{f.q}</h3>
            </div>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.7,
                color: 'var(--muted)',
                paddingInlineStart: 30,
              }}
            >
              {f.a}
            </p>
          </div>
        ))}
      </section>

      {/* CTA strip — design 1226-1231 */}
      <section style={{ maxWidth: 1160, margin: '56px auto 0', padding: '0 26px' }}>
        <div
          style={{
            borderRadius: 26,
            padding: 50,
            textAlign: 'center',
            background: 'var(--cta-grad)',
            backgroundSize: '220% 220%',
            animation: 'wathba-gshift 9s ease infinite',
          }}
        >
          <h2
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: 'var(--on-accent)',
              marginBottom: 22,
            }}
          >
            جاهز للوثبة التالية؟
          </h2>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/projects/start"
              style={{
                border: 'none',
                cursor: 'pointer',
                background: 'var(--on-accent)',
                color: 'var(--text)',
                fontWeight: 700,
                fontSize: 16,
                padding: '15px 30px',
                borderRadius: 14,
                textDecoration: 'none',
              }}
            >
              أطلق مشروعك
            </Link>
            <Link
              href="/projects/discover"
              style={{
                border: '1px solid rgba(6,18,31,.4)',
                cursor: 'pointer',
                background: 'transparent',
                color: 'var(--on-accent)',
                fontWeight: 700,
                fontSize: 16,
                padding: '15px 30px',
                borderRadius: 14,
                textDecoration: 'none',
              }}
            >
              استكشف المشاريع
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
