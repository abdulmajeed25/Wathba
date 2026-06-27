'use client';

import Link from 'next/link';
import { useState } from 'react';

import {
  deriveLiveProject,
  type WathbaProject as WathbaProjectShape,
  wathbaBudgetRows,
  wathbaProjectComments,
  wathbaProjectFaqs,
  wathbaProjectTabs,
  wathbaProjectUpdates,
  wathbaProjects,
  wathbaTiers,
  wathbaTxTimeline,
} from './wathba-data';
import { Icon, Num } from './wathba-icons';

/**
 * Project detail — literal 1:1 port of WATBHوثبة.dc.html lines 507–714.
 * Top header → gallery + funding sidebar → tab bar (5) → tab content + tier rail.
 * Every hex/gradient/px/rem mirrors the design verbatim.
 */

type TabId = 'story' | 'transparency' | 'updates' | 'community' | 'faq';

export type WathbaComment = (typeof wathbaProjectComments)[number];

export function WathbaProject({
  id,
  project,
  trustScore,
  comments,
}: {
  id: string;
  project?: WathbaProjectShape;
  trustScore?: number | null;
  comments?: WathbaComment[];
}) {
  const found =
    project ?? wathbaProjects.find((p) => p.id === id) ?? wathbaProjects[0]!;
  const active = deriveLiveProject(found, trustScore);
  const commentList =
    comments && comments.length > 0 ? comments : wathbaProjectComments;
  const [tab, setTab] = useState<TabId>('story');

  return (
    <div className="wathba-fade">
      {/* ───────── breadcrumb · title · tagline ───────── */}
      <section
        style={{ maxWidth: 1320, margin: '0 auto', padding: '30px 26px 0' }}
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
          استكشف
        </Link>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
          }}
        >
          <span
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}
          >
            {active.cat}
          </span>
          <span style={{ color: 'var(--ph-label)' }}>·</span>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            {active.loc}
          </span>
        </div>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: '-1px',
            maxWidth: 820,
            marginBottom: 8,
          }}
        >
          {active.titleAr}
        </h1>
        <p style={{ fontSize: 17, color: 'var(--text-soft)', maxWidth: 760 }}>
          {active.desc}
        </p>
      </section>

      {/* ───────── gallery + funding sidebar ───────── */}
      <section
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: '24px 26px 0',
          display: 'grid',
          gridTemplateColumns: '1.55fr 1fr',
          gap: 30,
          alignItems: 'start',
        }}
      >
        {/* gallery */}
        <div>
          <div
            className="wathba-ph"
            style={{
              height: 430,
              borderRadius: 20,
              position: 'relative',
              overflow: 'hidden',
              border: '1px solid rgba(var(--ink-rgb),.08)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <Icon name="play_circle" size={46} color="var(--ph-label)" />
                <Num
                  style={{
                    fontSize: 12,
                    color: 'var(--ph-label)',
                    marginTop: 8,
                    display: 'block',
                  }}
                >
                  [ فيديو المشروع ]
                </Num>
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4,1fr)',
              gap: 12,
              marginTop: 12,
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="wathba-ph"
                style={{
                  height: 78,
                  borderRadius: 12,
                  cursor: 'pointer',
                  border: '1px solid rgba(var(--ink-rgb),.08)',
                }}
              />
            ))}
          </div>
        </div>

        {/* funding sidebar */}
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid rgba(var(--ink-rgb),.09)',
            borderRadius: 20,
            padding: 26,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              marginBottom: 6,
            }}
          >
            <Num
              style={{ fontSize: 36, fontWeight: 700, color: 'var(--text)' }}
            >
              {active.raisedFmt}
            </Num>
            <Num
              style={{ fontSize: 17, fontWeight: 700, color: active.pctColor }}
            >
              {active.pct}%
            </Num>
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--muted2)',
              marginBottom: 16,
            }}
          >
            من هدف {active.goalFmt}
          </div>
          <div
            style={{
              height: 9,
              borderRadius: 30,
              background: 'rgba(var(--ink-rgb),.08)',
              overflow: 'hidden',
              marginBottom: 20,
            }}
          >
            <div
              style={{
                height: '100%',
                width: active.pctW,
                background: active.barGrad,
                borderRadius: 30,
                transition: 'width 1.4s cubic-bezier(.2,.7,.2,1)',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 0, marginBottom: 22 }}>
            <div style={{ flex: 1 }}>
              <Num
                style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}
              >
                {active.backersFmt}
              </Num>
              <div style={{ fontSize: 12, color: 'var(--muted2)' }}>داعم</div>
            </div>
            <div
              style={{ width: 1, background: 'rgba(var(--ink-rgb),.1)' }}
            />
            <div style={{ flex: 1, paddingInlineStart: 18 }}>
              <Num
                style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}
              >
                {active.daysLeft}
              </Num>
              <div style={{ fontSize: 12, color: 'var(--muted2)' }}>
                يوم متبقٍ
              </div>
            </div>
          </div>
          <Link
            href={`/projects/${active.id}/back`}
            style={{
              width: '100%',
              border: 'none',
              cursor: 'pointer',
              background: 'var(--grad)',
              color: 'var(--on-accent)',
              fontWeight: 700,
              fontSize: 16,
              padding: 15,
              borderRadius: 14,
              marginBottom: 11,
              textDecoration: 'none',
              display: 'block',
              textAlign: 'center',
            }}
          >
            ادعم هذا المشروع
          </Link>
          <div style={{ display: 'flex', gap: 11 }}>
            <button
              type="button"
              style={{
                flex: 1,
                cursor: 'pointer',
                background: 'transparent',
                border: '1px solid rgba(var(--ink-rgb),.16)',
                color: 'var(--text)',
                fontWeight: 600,
                fontSize: 13.5,
                padding: 11,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontFamily: 'inherit',
              }}
            >
              <Icon name="notifications" size={18} />
              ذكّرني
            </button>
            <button
              type="button"
              style={{
                flex: 1,
                cursor: 'pointer',
                background: 'transparent',
                border: '1px solid rgba(var(--ink-rgb),.16)',
                color: 'var(--text)',
                fontWeight: 600,
                fontSize: 13.5,
                padding: 11,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontFamily: 'inherit',
              }}
            >
              <Icon name="share" size={18} />
              شارك
            </button>
          </div>
          {/* creator strip */}
          <div
            style={{
              marginTop: 20,
              paddingTop: 18,
              borderTop: '1px solid rgba(var(--ink-rgb),.08)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'var(--grad)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                color: 'var(--on-accent)',
                flexShrink: 0,
              }}
            >
              {active.creator.trim().charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {active.creator}
              </div>
              <Num style={{ fontSize: 11.5, color: 'var(--muted2)' }}>
                ٣ مشاريع · مبدع موثّق ✓
              </Num>
            </div>
            <button
              type="button"
              style={{
                cursor: 'pointer',
                background: 'transparent',
                border: '1px solid rgba(var(--ink-rgb),.16)',
                color: 'var(--muted)',
                fontSize: 12,
                padding: '7px 12px',
                borderRadius: 10,
                fontFamily: 'inherit',
              }}
            >
              متابعة
            </button>
          </div>
          {/* all-or-nothing notice */}
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--muted2)',
              background: 'rgba(52,211,153,.06)',
              border: '1px solid rgba(52,211,153,.18)',
              borderRadius: 11,
              padding: '10px 12px',
            }}
          >
            <Icon name="verified_user" size={17} color="var(--pos)" />
            الكل أو لا شيء — يُموَّل فقط عند بلوغ الهدف.
          </div>
          {typeof trustScore === 'number' && trustScore > 0 && (
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: 'var(--muted2)',
                background: 'rgba(var(--accent-rgb),.05)',
                border: '1px solid rgba(var(--accent-rgb),.18)',
                borderRadius: 11,
                padding: '10px 12px',
              }}
            >
              <Icon name="shield" size={17} color="var(--accent)" />
              مؤشر الثقة:&nbsp;
              <Num style={{ fontWeight: 700, color: 'var(--accent)' }}>
                {active.trustScore}/100
              </Num>
            </div>
          )}
        </div>
      </section>

      {/* ───────── tab bar ───────── */}
      <section
        style={{
          maxWidth: 1320,
          margin: '36px auto 0',
          padding: '0 26px',
          borderBottom: '1px solid rgba(var(--ink-rgb),.08)',
        }}
      >
        <div style={{ display: 'flex', gap: 30, overflowX: 'auto' }}>
          {wathbaProjectTabs.map((t) => {
            const isActive = tab === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setTab(t.id as TabId)}
                style={{
                  cursor: 'pointer',
                  padding: '14px 2px',
                  borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                  color: isActive ? 'var(--accent)' : 'var(--muted)',
                  fontSize: 15,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  transition: 'color .25s, border-color .25s',
                }}
              >
                <Icon name={t.icon} size={19} />
                {t.label}
                {t.badge && (
                  <Num
                    style={{
                      fontSize: 11,
                      background: 'rgba(var(--ink-rgb),.08)',
                      padding: '2px 7px',
                      borderRadius: 20,
                    }}
                  >
                    {t.badge}
                  </Num>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ───────── tab content + reward rail ───────── */}
      <section
        style={{
          maxWidth: 1320,
          margin: '30px auto 0',
          padding: '0 26px 10px',
          display: 'grid',
          gridTemplateColumns: '1.55fr 1fr',
          gap: 30,
          alignItems: 'start',
        }}
      >
        <div>
          {/* STORY */}
          {tab === 'story' && (
            <div className="wathba-fade">
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 14 }}>
                عن المشروع
              </h2>
              <p
                style={{
                  fontSize: 16,
                  lineHeight: 1.85,
                  color: 'var(--text-soft)',
                  marginBottom: 18,
                }}
              >
                بدأت فكرة المشروع من حاجةٍ بسيطة: أداة يصنعها مبدعون من المنطقة،
                بمعايير عالمية، وبسعرٍ عادل. أمضى الفريق ١٨ شهراً في البحث
                والتطوير قبل أن يصل إلى هذه النسخة التي بين أيديكم اليوم.
              </p>
              <p
                style={{
                  fontSize: 16,
                  lineHeight: 1.85,
                  color: 'var(--text-soft)',
                  marginBottom: 24,
                }}
              >
                كل تفصيلة صُمّمت بعناية — من الخامات المستدامة إلى تجربة
                الاستخدام السلسة. ودعمكم اليوم هو ما يحوّل هذا النموذج إلى منتجٍ
                بين يدي آلاف الأشخاص.
              </p>
              <div
                className="wathba-ph"
                style={{
                  height: 300,
                  borderRadius: 16,
                  border: '1px solid rgba(var(--ink-rgb),.08)',
                  position: 'relative',
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Num style={{ fontSize: 12, color: 'var(--ph-label)' }}>
                    [ صورة توضيحية للمنتج ]
                  </Num>
                </div>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>
                لماذا الآن؟
              </h3>
              <p
                style={{
                  fontSize: 16,
                  lineHeight: 1.85,
                  color: 'var(--text-soft)',
                }}
              >
                لأن المنطقة تزخر بالمواهب التي تستحق منصةً تؤمن بها. ولأن الوقت
                مثاليٌّ لإطلاق منتجٍ يجمع بين الهوية المحلية والطموح العالمي.
                انضم إلينا في هذه الوثبة.
              </p>
            </div>
          )}

          {/* TRANSPARENCY */}
          {tab === 'transparency' && (
            <div className="wathba-fade">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <Icon name="query_stats" size={24} color="var(--pos)" />
                <h2 style={{ fontSize: 24, fontWeight: 700 }}>
                  لوحة الشفافية الحيّة
                </h2>
              </div>
              <p
                style={{
                  fontSize: 15,
                  color: 'var(--muted)',
                  marginBottom: 26,
                }}
              >
                نوضّح بالضبط كيف يُنفَق كل ريال تدعمنا به. تُحدَّث هذه اللوحة
                تلقائياً مع كل مرحلة.
              </p>
              <div
                style={{
                  background: 'var(--card)',
                  border: '1px solid rgba(var(--ink-rgb),.08)',
                  borderRadius: 18,
                  padding: 24,
                  marginBottom: 22,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: 20,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>توزيع الميزانية</span>
                  <Num style={{ color: 'var(--accent)' }}>
                    {active.raisedFmt} مُجمّعة
                  </Num>
                </div>
                {wathbaBudgetRows.map((b) => (
                  <div key={b.label} style={{ marginBottom: 18 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13.5,
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ color: 'var(--text-soft)' }}>{b.label}</span>
                      <Num style={{ color: 'var(--muted)' }}>{b.pct}%</Num>
                    </div>
                    <div
                      style={{
                        height: 9,
                        borderRadius: 30,
                        background: 'rgba(var(--ink-rgb),.06)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: b.w,
                          background: b.color,
                          borderRadius: 30,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 18 }}>
                الجدول الزمني للإنفاق
              </h3>
              <div style={{ position: 'relative' }}>
                {wathbaTxTimeline.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 16,
                      paddingBottom: 22,
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: 'var(--surface2)',
                          border: '3px solid var(--accent)',
                          zIndex: 1,
                        }}
                      />
                      <div
                        style={{
                          width: 2,
                          flex: 1,
                          background: 'rgba(var(--ink-rgb),.1)',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        flex: 1,
                        background: 'rgba(var(--ink-rgb),.03)',
                        border: '1px solid rgba(var(--ink-rgb),.07)',
                        borderRadius: 13,
                        padding: '13px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14.5, fontWeight: 600 }}>
                          {t.label}
                        </div>
                        <Num
                          style={{
                            fontSize: 12,
                            color: 'var(--muted2)',
                            marginTop: 2,
                            display: 'block',
                          }}
                        >
                          {t.date}
                        </Num>
                      </div>
                      <Num
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: 'var(--accent)',
                        }}
                      >
                        {t.amount}
                      </Num>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UPDATES */}
          {tab === 'updates' && (
            <div className="wathba-fade">
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>
                تحديثات المبدع
              </h2>
              {wathbaProjectUpdates.map((u) => (
                <div
                  key={u.n}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid rgba(var(--ink-rgb),.08)',
                    borderRadius: 16,
                    padding: 22,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <Num
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: 'rgba(var(--accent-rgb),.12)',
                        color: 'var(--accent)',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      #{u.n}
                    </Num>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--accent)',
                        background: 'rgba(var(--accent-rgb),.1)',
                        border: '1px solid rgba(var(--accent-rgb),.25)',
                        padding: '3px 10px',
                        borderRadius: 20,
                      }}
                    >
                      {u.tag}
                    </span>
                    <Num
                      style={{
                        fontSize: 12,
                        color: 'var(--muted2)',
                        marginInlineStart: 'auto',
                      }}
                    >
                      {u.date}
                    </Num>
                  </div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      marginBottom: 8,
                    }}
                  >
                    {u.title}
                  </h3>
                  <p
                    style={{
                      fontSize: 14.5,
                      lineHeight: 1.7,
                      color: 'var(--muted)',
                    }}
                  >
                    {u.body}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* COMMUNITY */}
          {tab === 'community' && (
            <div className="wathba-fade">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 18,
                }}
              >
                <h2 style={{ fontSize: 24, fontWeight: 700 }}>المجتمع</h2>
                <Num style={{ fontSize: 13, color: 'var(--muted2)' }}>
                  ١٢٨ تعليقاً
                </Num>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  background: 'var(--card)',
                  border: '1px solid rgba(var(--ink-rgb),.08)',
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 22,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    background: 'rgba(var(--ink-rgb),.06)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="person" size={22} color="var(--muted2)" />
                </div>
                <input
                  placeholder="شارك رأيك مع المجتمع…"
                  style={{
                    flex: 1,
                    background: 'rgba(var(--ink-rgb),.04)',
                    border: '1px solid rgba(var(--ink-rgb),.1)',
                    borderRadius: 11,
                    padding: '0 14px',
                    color: 'var(--text)',
                    fontSize: 14,
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="button"
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    background: 'var(--grad)',
                    color: 'var(--on-accent)',
                    fontWeight: 700,
                    fontSize: 13.5,
                    padding: '0 18px',
                    borderRadius: 11,
                    fontFamily: 'inherit',
                  }}
                >
                  نشر
                </button>
              </div>
              {commentList.map((c, idx) => (
                <div
                  key={`${c.name}-${idx}`}
                  style={{ display: 'flex', gap: 13, marginBottom: 22 }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: 'var(--avatar)',
                      border: '1px solid rgba(var(--ink-rgb),.1)',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {c.name.trim().charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        marginBottom: 5,
                      }}
                    >
                      <span style={{ fontSize: 14.5, fontWeight: 700 }}>
                        {c.name}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 9px',
                          borderRadius: 20,
                          color: c.rankColor,
                          border: `1px solid ${c.rankColor}`,
                          background: 'rgba(var(--ink-rgb),.03)',
                        }}
                      >
                        {c.rank}
                      </span>
                      <Num
                        style={{ fontSize: 11.5, color: 'var(--muted2)' }}
                      >
                        {c.time}
                      </Num>
                    </div>
                    <p
                      style={{
                        fontSize: 14.5,
                        lineHeight: 1.65,
                        color: 'var(--text-soft)',
                        marginBottom: 9,
                      }}
                    >
                      {c.body}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 18,
                        fontSize: 12.5,
                        color: 'var(--muted2)',
                      }}
                    >
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          cursor: 'pointer',
                        }}
                      >
                        <Icon name="favorite_border" size={16} />
                        <Num>{c.likes}</Num>
                      </span>
                      <span style={{ cursor: 'pointer' }}>رد</span>
                    </div>
                    {c.reply && (
                      <div
                        style={{
                          marginTop: 12,
                          background: 'rgba(var(--accent-rgb),.05)',
                          border: '1px solid rgba(var(--accent-rgb),.15)',
                          borderRadius: 12,
                          padding: '12px 14px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            marginBottom: 5,
                          }}
                        >
                          <Icon name="verified" size={15} color="var(--accent)" />
                          <span
                            style={{
                              fontSize: 12.5,
                              fontWeight: 700,
                              color: 'var(--accent)',
                            }}
                          >
                            المبدع
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: 13.5,
                            lineHeight: 1.6,
                            color: 'var(--text-soft)',
                          }}
                        >
                          {c.reply}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* FAQ */}
          {tab === 'faq' && (
            <div className="wathba-fade">
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>
                الأسئلة الشائعة
              </h2>
              {wathbaProjectFaqs.map((f) => (
                <div
                  key={f.q}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid rgba(var(--ink-rgb),.08)',
                    borderRadius: 14,
                    padding: '20px 22px',
                    marginBottom: 13,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 9,
                    }}
                  >
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
            </div>
          )}
        </div>

        {/* ───────── reward tier rail ───────── */}
        <div>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Icon name="redeem" size={20} color="var(--gold)" />
            اختر مكافأتك
          </h3>
          {wathbaTiers.map((t) => (
            <Link
              key={t.id}
              href={`/projects/${active.id}/back?tier=${t.id}`}
              style={{
                cursor: 'pointer',
                background: 'var(--card)',
                border: '1px solid rgba(var(--ink-rgb),.09)',
                borderRadius: 16,
                padding: 18,
                marginBottom: 14,
                position: 'relative',
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              {t.popular && (
                <div
                  style={{
                    position: 'absolute',
                    top: -9,
                    right: 16,
                    background:
                      'linear-gradient(135deg,var(--gold),#f59e0b)',
                    color: 'var(--on-accent)',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 11px',
                    borderRadius: 20,
                  }}
                >
                  الأكثر شعبية
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <Num
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: 'var(--accent)',
                  }}
                >
                  ${t.price.toLocaleString('en-US')}
                </Num>
                <Num style={{ fontSize: 12, color: 'var(--muted2)' }}>
                  {t.backers} داعم
                </Num>
              </div>
              <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 7 }}>
                {t.title}
              </h4>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: 'var(--muted)',
                  marginBottom: 13,
                }}
              >
                {t.desc}
              </p>
              <div
                style={{
                  borderTop: '1px solid rgba(var(--ink-rgb),.07)',
                  paddingTop: 12,
                }}
              >
                {t.items.map((it) => (
                  <div
                    key={it}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                      color: 'var(--text-soft)',
                      marginBottom: 7,
                    }}
                  >
                    <Icon name="check_circle" size={16} color="var(--pos)" />
                    {it}
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(var(--ink-rgb),.07)',
                  fontSize: 11.5,
                  color: 'var(--muted2)',
                }}
              >
                <Num>التسليم: {t.est}</Num>
                {t.left != null && (
                  <span style={{ color: 'var(--gold)', fontWeight: 700 }}>
                    باقٍ {t.left} فقط
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
