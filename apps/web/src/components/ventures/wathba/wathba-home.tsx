'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  compactNum,
  deriveProject,
  type WathbaProject,
  wathbaBudgetRows,
  wathbaCategories,
  wathbaHowSteps,
  wathbaProjects,
  wathbaRanks,
  wathbaTickerMessages,
} from './wathba-data';
import { Icon, Num } from './wathba-icons';

type TrendTabId = 'hot' | 'new' | 'near' | 'big';
const TREND_TABS: { id: TrendTabId; label: string }[] = [
  { id: 'hot', label: 'الأكثر رواجاً' },
  { id: 'new', label: 'وصلت حديثاً' },
  { id: 'near', label: 'قاربت الاكتمال' },
  { id: 'big', label: 'الأكثر تمويلاً' },
];

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function WathbaHome({ projects }: { projects?: WathbaProject[] } = {}) {
  const list = (projects ?? wathbaProjects).map(deriveProject);
  const [stats, setStats] = useState({ projects: 0, raised: 0, backers: 0 });
  const [trendTab, setTrendTab] = useState<TrendTabId>('hot');

  // Design lines 1496–1505: animateStats() up to 4820 / 312M / 1.94M.
  useEffect(() => {
    const targets = { projects: 4820, raised: 312_000_000, backers: 1_940_000 };
    const dur = 1500;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setStats({
        projects: Math.round(targets.projects * e),
        raised: Math.round(targets.raised * e),
        backers: Math.round(targets.backers * e),
      });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Design lines 1533–1538.
  const trending = [...list];
  if (trendTab === 'hot') trending.sort((a, b) => b.backers - a.backers);
  else if (trendTab === 'new') trending.sort((a, b) => b.daysLeft - a.daysLeft);
  else if (trendTab === 'near')
    trending.sort((a, b) => (a.goal - a.raised) / a.goal - (b.goal - b.raised) / b.goal);
  else trending.sort((a, b) => b.raised - a.raised);

  // The fallback fixture always has >=1 entry, so list[0]! is safe.
  const featured = list.find((p) => p.id === 'p1' || p.id === 'sirb') ?? list[0]!;

  return (
    <div className="wathba-fade">
      {/* ============================== HERO ============================== */}
      <section
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: '64px 26px 30px',
          display: 'grid',
          gridTemplateColumns: '1.05fr .95fr',
          gap: 54,
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              background: 'rgba(var(--accent-rgb),.1)',
              border: '1px solid rgba(var(--accent-rgb),.28)',
              color: 'var(--accent)',
              padding: '7px 14px',
              borderRadius: 30,
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 24,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--accent)',
                animation: 'wathba-pulsering 2s infinite',
              }}
            />
            منصة الدعم الجماعي الأولى عربياً
          </div>
          <h1
            style={{
              fontSize: 62,
              lineHeight: 1.05,
              fontWeight: 700,
              letterSpacing: '-1.5px',
              marginBottom: 22,
            }}
          >
            حوّل فكرتك
            <br />
            إلى{' '}
            <span
              style={{
                background: 'linear-gradient(120deg,var(--blue),var(--accent) 60%,var(--purple))',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              واقعٍ ملموس
            </span>
          </h1>
          <p
            style={{
              fontSize: 18.5,
              lineHeight: 1.7,
              color: 'var(--text-soft)',
              maxWidth: 480,
              marginBottom: 32,
            }}
          >
            وثبة تجمع المبدعين بمجتمعٍ يؤمن بهم. اعرض مشروعك، اجمع التمويل بشفافية كاملة،
            وكافئ داعميك برتبٍ ومزايا فريدة.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 42 }}>
            <Link
              href="/projects/start"
              style={{
                border: 'none',
                cursor: 'pointer',
                background: 'var(--grad)',
                color: 'var(--on-accent)',
                fontWeight: 700,
                fontSize: 16,
                padding: '15px 28px',
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                textDecoration: 'none',
              }}
            >
              <Icon name="bolt" size={21} fill />
              أطلق مشروعك
            </Link>
            <Link
              href="/projects/discover"
              style={{
                cursor: 'pointer',
                background: 'transparent',
                border: '1px solid rgba(var(--ink-rgb),.16)',
                color: 'var(--text)',
                fontWeight: 600,
                fontSize: 16,
                padding: '15px 28px',
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                textDecoration: 'none',
              }}
            >
              <Icon name="explore" size={21} />
              استكشف المشاريع
            </Link>
          </div>
          <div style={{ display: 'flex', gap: 36 }}>
            <div>
              <Num style={{ fontSize: 30, fontWeight: 700, color: 'var(--text)' }}>
                ${compactNum(stats.raised)}
              </Num>
              <div style={{ fontSize: 13, color: 'var(--muted2)', marginTop: 2 }}>أموال جُمعت</div>
            </div>
            <div style={{ width: 1, background: 'rgba(var(--ink-rgb),.1)' }} />
            <div>
              <Num style={{ fontSize: 30, fontWeight: 700, color: 'var(--text)' }}>
                {compactNum(stats.backers)}
              </Num>
              <div style={{ fontSize: 13, color: 'var(--muted2)', marginTop: 2 }}>داعم نشط</div>
            </div>
            <div style={{ width: 1, background: 'rgba(var(--ink-rgb),.1)' }} />
            <div>
              <Num style={{ fontSize: 30, fontWeight: 700, color: 'var(--text)' }}>
                {fmtNum(stats.projects)}
              </Num>
              <div style={{ fontSize: 13, color: 'var(--muted2)', marginTop: 2 }}>مشروع مموَّل</div>
            </div>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              inset: -24,
              background: 'radial-gradient(circle at 60% 30%,rgba(var(--accent-rgb),.22),transparent 65%)',
              filter: 'blur(8px)',
              zIndex: 0,
            }}
          />
          <Link
            href={`/projects/${featured.id}`}
            style={{
              position: 'relative',
              zIndex: 1,
              background: 'var(--card)',
              border: '1px solid rgba(var(--ink-rgb),.09)',
              borderRadius: 24,
              overflow: 'hidden',
              cursor: 'pointer',
              boxShadow: '0 30px 70px -30px rgba(0,0,0,.8)',
              textDecoration: 'none',
              color: 'inherit',
              display: 'block',
            }}
          >
            <div className="wathba-ph" style={{ height: 248, position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  background: 'rgba(6,18,31,.85)',
                  backdropFilter: 'blur(6px)',
                  border: '1px solid rgba(var(--accent-rgb),.4)',
                  color: 'var(--accent)',
                  padding: '7px 13px',
                  borderRadius: 30,
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                <Icon name="favorite" size={16} fill />
                مشروع نحبه
              </div>
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <Num style={{ fontSize: 12, color: 'var(--ph-label)', letterSpacing: '1px' }}>
                  [ صورة المشروع ]
                </Num>
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 90,
                  background: 'linear-gradient(0deg,var(--surface2),transparent)',
                }}
              />
            </div>
            <div style={{ padding: '22px 24px 26px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12.5,
                  color: 'var(--muted2)',
                  marginBottom: 10,
                }}
              >
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{featured.cat}</span>·
                <span>{featured.loc}</span>
              </div>
              <h3 style={{ fontSize: 23, fontWeight: 700, marginBottom: 6, letterSpacing: '-.4px' }}>
                {featured.titleAr}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--muted)',
                  lineHeight: 1.6,
                  marginBottom: 20,
                }}
              >
                {featured.desc}
              </p>
              <div
                style={{
                  height: 9,
                  borderRadius: 30,
                  background: 'rgba(var(--ink-rgb),.08)',
                  overflow: 'hidden',
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: featured.pctW,
                    background: 'var(--grad-bar)',
                    borderRadius: 30,
                    transition: 'width 1.4s cubic-bezier(.2,.7,.2,1)',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                }}
              >
                <div>
                  <Num style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                    {featured.raisedFmt}
                  </Num>
                  <span style={{ fontSize: 13, color: 'var(--muted2)', marginInlineStart: 6 }}>
                    من {featured.goalFmt}
                  </span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Num style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
                    {featured.pct}%
                  </Num>
                  <div style={{ fontSize: 11, color: 'var(--muted2)' }}>مُموَّل</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Num style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                    {featured.daysLeft}
                  </Num>
                  <div style={{ fontSize: 11, color: 'var(--muted2)' }}>يوم متبقٍ</div>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ============================ LIVE TICKER ============================ */}
      <section style={{ maxWidth: 1320, margin: '14px auto 0', padding: '0 26px' }}>
        <div
          style={{
            border: '1px solid rgba(var(--ink-rgb),.07)',
            background: 'rgba(var(--ink-rgb),.02)',
            borderRadius: 14,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              flexShrink: 0,
              padding: '12px 18px',
              background: 'rgba(52,211,153,.1)',
              borderInlineEnd: '1px solid rgba(var(--ink-rgb),.07)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--pos)',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--pos)',
                animation: 'wathba-pulsering 2s infinite',
              }}
            />
            مباشر الآن
          </div>
          <div
            style={{
              overflow: 'hidden',
              flex: 1,
              WebkitMask:
                'linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                gap: 40,
                whiteSpace: 'nowrap',
                padding: '12px 0',
                animation: 'wathba-ticker 26s linear infinite',
                fontSize: 13.5,
                color: 'var(--muted)',
              }}
            >
              {[...wathbaTickerMessages, ...wathbaTickerMessages].map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================ CATEGORIES ============================ */}
      <section style={{ maxWidth: 1320, margin: '56px auto 0', padding: '0 26px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: 24, fontWeight: 700 }}>تصفّح حسب الفئة</h2>
          <Link
            href="/projects/discover"
            style={{
              cursor: 'pointer',
              fontSize: 14,
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              textDecoration: 'none',
            }}
          >
            عرض الكل
            <Icon name="arrow_back" size={18} />
          </Link>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8,1fr)',
            gap: 14,
          }}
        >
          {wathbaCategories.map((c) => (
            <Link
              key={c.id}
              href={`/projects/category/${c.id}`}
              style={{
                cursor: 'pointer',
                background: 'var(--card)',
                border: '1px solid rgba(var(--ink-rgb),.08)',
                borderRadius: 18,
                padding: '20px 12px',
                textAlign: 'center',
                boxShadow: 'var(--card-shadow)',
                transition: 'transform .35s cubic-bezier(.2,.7,.2,1),box-shadow .35s,border-color .35s',
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  margin: '0 auto 12px',
                  borderRadius: 14,
                  background: 'rgba(var(--accent-rgb),.1)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name={c.icon} size={25} color="var(--accent)" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{c.ar}</div>
              <Num style={{ fontSize: 11.5, color: 'var(--muted2)', marginTop: 3 }}>
                {c.count}
              </Num>
            </Link>
          ))}
        </div>
      </section>

      {/* ============================ TRENDING ============================ */}
      <section style={{ maxWidth: 1320, margin: '64px auto 0', padding: '0 26px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 22,
            flexWrap: 'wrap',
            gap: 14,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: '-.5px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Icon name="trending_up" size={28} fill color="var(--accent)" />
              المشاريع الرائجة
            </h2>
            <p style={{ fontSize: 14, color: 'var(--muted2)', marginTop: 6 }}>
              أكثر المشاريع جذباً للداعمين هذا الأسبوع
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 9,
              background: 'rgba(var(--ink-rgb),.04)',
              border: '1px solid rgba(var(--ink-rgb),.08)',
              borderRadius: 13,
              padding: 5,
            }}
          >
            {TREND_TABS.map((t) => (
              <span
                key={t.id}
                onClick={() => setTrendTab(t.id)}
                style={{
                  cursor: 'pointer',
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: '8px 15px',
                  borderRadius: 9,
                  color: t.id === trendTab ? 'var(--on-accent)' : 'var(--muted)',
                  background: t.id === trendTab ? 'var(--grad)' : 'transparent',
                }}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
          {trending.slice(0, 8).map((p) => (
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
              <div className="wathba-ph" style={{ height: 158, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
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
                {/* bookmark — design line 313 (NOT a trust badge) */}
                <div
                  style={{
                    position: 'absolute',
                    top: 11,
                    left: 11,
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    background: 'rgba(6,18,31,.8)',
                    backdropFilter: 'blur(5px)',
                    border: '1px solid rgba(var(--ink-rgb),.12)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Icon name="bookmark" size={16} color="var(--muted)" />
                </div>
                {/* §7 platform-partner — mandatory badge on the card */}
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
                  padding: '15px 16px 17px',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                }}
              >
                <h3
                  style={{
                    fontSize: 16.5,
                    fontWeight: 700,
                    marginBottom: 4,
                    letterSpacing: '-.3px',
                  }}
                >
                  {p.titleAr}
                </h3>
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
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{ height: '100%', width: p.pctW, background: p.barGrad, borderRadius: 30 }}
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
                    <Num style={{ fontSize: 12.5, color: 'var(--muted2)' }}>{p.raisedFmt}</Num>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 8,
                      fontSize: 11.5,
                      color: 'var(--muted2)',
                    }}
                  >
                    <Num>{p.backersFmt} داعم</Num>
                    <Num>{p.daysLeft} يوم</Num>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ========================= TRANSPARENCY BAND ========================= */}
      <section style={{ maxWidth: 1320, margin: '74px auto 0', padding: '0 26px' }}>
        <div
          style={{
            background: 'var(--band)',
            border: '1px solid rgba(var(--ink-rgb),.08)',
            borderRadius: 26,
            padding: 44,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 46,
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -60,
              left: -60,
              width: 240,
              height: 240,
              borderRadius: '50%',
              background: 'radial-gradient(circle,rgba(var(--accent-rgb),.18),transparent 70%)',
            }}
          />
          <div style={{ position: 'relative' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(52,211,153,.1)',
                border: '1px solid rgba(52,211,153,.3)',
                color: 'var(--pos)',
                padding: '6px 13px',
                borderRadius: 30,
                fontSize: 12.5,
                fontWeight: 700,
                marginBottom: 18,
              }}
            >
              <Icon name="visibility" size={16} />
              شفافية مطلقة
            </div>
            <h2
              style={{
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: '-.6px',
                lineHeight: 1.2,
                marginBottom: 14,
              }}
            >
              تابع كل ريال
              <br />
              إلى أين يذهب
            </h2>
            <p style={{ fontSize: 15.5, color: 'var(--text-soft)', lineHeight: 1.7, marginBottom: 24 }}>
              لكل مشروع لوحة ميزانية حيّة تُظهر كيف تُنفَق أموالك، مع تحديثات مالية دورية موثّقة.
              لا مفاجآت — فقط ثقة.
            </p>
            <Link
              href={`/projects/${featured.id}`}
              style={{
                cursor: 'pointer',
                background: 'transparent',
                border: '1px solid rgba(var(--ink-rgb),.18)',
                color: 'var(--text)',
                fontWeight: 600,
                fontSize: 15,
                padding: '13px 22px',
                borderRadius: 13,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              شاهد لوحة الشفافية
            </Link>
          </div>
          <div
            style={{
              position: 'relative',
              background: 'var(--surface2)',
              border: '1px solid rgba(var(--ink-rgb),.08)',
              borderRadius: 18,
              padding: 24,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: 'var(--muted2)',
                marginBottom: 18,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>توزيع الميزانية — سِرب</span>
              <Num style={{ color: 'var(--accent)' }}>{featured.raisedFmt}</Num>
            </div>
            {wathbaBudgetRows.map((b) => (
              <div key={b.label} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    marginBottom: 7,
                  }}
                >
                  <span style={{ color: 'var(--text-soft)' }}>{b.label}</span>
                  <Num style={{ color: 'var(--muted)' }}>{b.pct}%</Num>
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 30,
                    background: 'rgba(var(--ink-rgb),.06)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ height: '100%', width: b.w, background: b.color, borderRadius: 30 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ RANKS TEASER ============================ */}
      <section style={{ maxWidth: 1320, margin: '74px auto 0', padding: '0 26px', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(251,191,36,.1)',
            border: '1px solid rgba(251,191,36,.3)',
            color: 'var(--gold)',
            padding: '6px 13px',
            borderRadius: 30,
            fontSize: 12.5,
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          <Icon name="workspace_premium" size={16} fill />
          نظام رتب الداعمين
        </div>
        <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-.6px', marginBottom: 12 }}>
          كل دعمٍ يرفع مكانتك
        </h2>
        <p
          style={{
            fontSize: 16,
            color: 'var(--text-soft)',
            maxWidth: 560,
            margin: '0 auto 38px',
          }}
        >
          ادعم أكثر، افتح رتباً أعلى ومزايا حصرية: شارات، وصول مبكر، ولقاءات مع المبدعين.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16 }}>
          {wathbaRanks.map((r) => (
            <div
              key={r.id}
              style={{
                background: 'var(--card)',
                border: `1px solid ${r.border}`,
                borderRadius: 18,
                padding: '26px 16px',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  margin: '0 auto 14px',
                  borderRadius: '50%',
                  background: r.bg,
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: r.glow,
                }}
              >
                <Icon name={r.icon} size={28} fill color={r.icoColor} />
              </div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                  marginBottom: 4,
                  color: r.titleColor,
                }}
              >
                {r.ar}
              </div>
              <Num
                style={{ fontSize: 11.5, color: 'var(--muted2)', letterSpacing: '1px', marginBottom: 8 }}
              >
                {r.en}
              </Num>
              <Num style={{ fontSize: 12.5, color: 'var(--muted)' }}>{r.req}</Num>
            </div>
          ))}
        </div>
        <Link
          href="/projects/ranks"
          style={{
            cursor: 'pointer',
            marginTop: 34,
            background: 'transparent',
            border: '1px solid rgba(var(--ink-rgb),.18)',
            color: 'var(--text)',
            fontWeight: 600,
            fontSize: 15,
            padding: '13px 26px',
            borderRadius: 13,
            display: 'inline-block',
            textDecoration: 'none',
          }}
        >
          اكتشف كل المزايا
        </Link>
      </section>

      {/* ============================ HOW IT WORKS ============================ */}
      <section style={{ maxWidth: 1320, margin: '74px auto 0', padding: '0 26px' }}>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-.5px',
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          كيف تعمل وثبة
        </h2>
        <p style={{ fontSize: 15, color: 'var(--muted2)', textAlign: 'center', marginBottom: 40 }}>
          ثلاث خطوات تفصلك عن تحقيق فكرتك
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>
          {wathbaHowSteps.map((s) => (
            <div
              key={s.n}
              style={{
                background: 'var(--card)',
                border: '1px solid rgba(var(--ink-rgb),.08)',
                borderRadius: 20,
                padding: 30,
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
                  fontSize: 88,
                  fontWeight: 700,
                  color: 'rgba(var(--accent-rgb),.06)',
                }}
              >
                {s.n}
              </Num>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 15,
                  background:
                    'linear-gradient(135deg,rgba(var(--accent2-rgb),.2),rgba(var(--accent-rgb),.2))',
                  display: 'grid',
                  placeItems: 'center',
                  marginBottom: 18,
                  position: 'relative',
                }}
              >
                <Icon name={s.icon} size={27} color="var(--accent)" />
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 9, position: 'relative' }}>
                {s.titleAr}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.65, position: 'relative' }}>
                {s.descAr}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================ CTA BAND ============================ */}
      <section style={{ maxWidth: 1320, margin: '74px auto 0', padding: '0 26px' }}>
        <div
          style={{
            borderRadius: 28,
            padding: '56px 44px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            background: 'var(--cta-grad)',
            backgroundSize: '220% 220%',
            animation: 'wathba-gshift 9s ease infinite',
          }}
        >
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2
              style={{
                fontSize: 38,
                fontWeight: 700,
                letterSpacing: '-.8px',
                color: 'var(--on-accent)',
                marginBottom: 14,
              }}
            >
              عندك فكرة؟ لنطلقها معاً.
            </h2>
            <p
              style={{
                fontSize: 17,
                color: 'rgba(6,18,31,.78)',
                maxWidth: 520,
                margin: '0 auto 30px',
              }}
            >
              انضم لآلاف المبدعين الذين حوّلوا أفكارهم إلى مشاريع ناجحة على وثبة.
            </p>
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
                  display: 'inline-block',
                }}
              >
                ابدأ مشروعك الآن
              </Link>
              <Link
                href="/projects/how"
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
                  display: 'inline-block',
                }}
              >
                تعلّم المزيد
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
