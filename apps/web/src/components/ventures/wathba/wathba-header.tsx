'use client';

import Link from 'next/link';
import { useState } from 'react';

import { deriveProject, wathbaCategories, wathbaProjects } from './wathba-data';
import { Icon, Num } from './wathba-icons';
import type { WathbaTheme } from './wathba-tokens';
import { WathbaNotificationBell } from './wathba-notification-bell';

const MEGA_FILTERS = [
  { id: 'love', ar: 'مشاريع نحبها', icon: 'favorite', status: 'all' as const },
  { id: 'trending', ar: 'الأكثر رواجاً', icon: 'trending_up', status: 'all' as const },
  { id: 'near', ar: 'قاربت الاكتمال', icon: 'pie_chart', status: 'near' as const },
  { id: 'new', ar: 'أُطلقت حديثاً', icon: 'bolt', status: 'live' as const },
  { id: 'nearby', ar: 'مشاريع قريبة منك', icon: 'location_on', status: 'all' as const },
  { id: 'funded', ar: 'مشاريع مكتملة', icon: 'verified', status: 'funded' as const },
];

export interface WathbaHeaderProps {
  theme: WathbaTheme;
  onToggleTheme: () => void;
}

export function WathbaHeader({ theme, onToggleTheme }: WathbaHeaderProps) {
  const [megaOpen, setMegaOpen] = useState(false);
  const [megaCat, setMegaCat] = useState('tech');
  // wathbaCategories is non-empty — fallback bang is safe.
  const cur = wathbaCategories.find((c) => c.id === megaCat) ?? wathbaCategories[0]!;
  // Design lines 1575–1577: featured = first project in this cat, else first
  // badged, else first. Cycles as the user hovers categories.
  const derived = wathbaProjects.map(deriveProject);
  const megaFeatured =
    derived.find((p) => p.catId === megaCat) ??
    derived.find((p) => p.badge) ??
    derived[0]!;

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        backdropFilter: 'blur(14px)',
        background: 'var(--header-bg)',
        borderBottom: '1px solid rgba(var(--ink-rgb),.07)',
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: '14px 26px',
          display: 'flex',
          alignItems: 'center',
          gap: 26,
        }}
      >
        <Link
          href="/projects"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            cursor: 'pointer',
            flexShrink: 0,
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              background: 'var(--grad)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 8px 22px -8px rgba(var(--accent-rgb),.7)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Icon name="rocket_launch" size={26} fill color="var(--on-accent)" />
          </div>
          <div style={{ lineHeight: 1.05 }}>
            <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-.3px' }}>وثبة</div>
            <Num style={{ fontSize: 9.5, letterSpacing: '3px', color: 'var(--muted2)' }}>
              LEAP FORWARD
            </Num>
          </div>
        </Link>

        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            fontSize: 14.5,
            color: 'var(--muted)',
            fontWeight: 500,
          }}
        >
          <Link href="/projects/discover" style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none' }}>
            استكشف
          </Link>
          <div
            onMouseEnter={() => setMegaOpen(true)}
            onMouseLeave={() => setMegaOpen(false)}
            style={{ position: 'static', display: 'inline-flex' }}
          >
            <Link
              href="/projects/discover"
              style={{
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                color: 'inherit',
                textDecoration: 'none',
              }}
            >
              الفئات
              <Icon name="expand_more" size={18} color="var(--muted2)" />
            </Link>

            {megaOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 70,
                  display: 'flex',
                  justifyContent: 'center',
                  paddingTop: 1,
                }}
              >
                <div
                  style={{
                    width: '100%',
                    maxWidth: 1320,
                    margin: '0 26px',
                    background: 'var(--card)',
                    border: '1px solid rgba(var(--ink-rgb),.1)',
                    borderTop: 'none',
                    borderRadius: '0 0 22px 22px',
                    boxShadow: '0 40px 80px -30px rgba(0,0,0,.55)',
                    overflow: 'hidden',
                    display: 'grid',
                    gridTemplateColumns: '208px 1fr 224px 300px',
                    fontWeight: 400,
                  }}
                >
                  <div
                    style={{
                      borderInlineStart: '1px solid rgba(var(--ink-rgb),.07)',
                      padding: '18px 12px',
                      background: 'rgba(var(--ink-rgb),.02)',
                    }}
                  >
                    {wathbaCategories.map((c) => {
                      const active = c.id === megaCat;
                      const color = active ? 'var(--accent)' : 'var(--text)';
                      const arrow = active ? 'var(--accent)' : 'var(--muted2)';
                      return (
                        <Link
                          key={c.id}
                          href={`/projects/category/${c.id}`}
                          onMouseEnter={() => setMegaCat(c.id)}
                          onClick={() => setMegaOpen(false)}
                          style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 12px',
                            borderRadius: 11,
                            background: active ? 'rgba(var(--accent-rgb),.10)' : 'transparent',
                            transition: 'background .15s',
                            textDecoration: 'none',
                            color: 'inherit',
                          }}
                        >
                          <Icon name={c.icon} size={20} color={color} />
                          <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color }}>
                            {c.ar}
                          </span>
                          <Icon name="chevron_left" size={18} color={arrow} />
                        </Link>
                      );
                    })}
                  </div>

                  <div style={{ padding: '26px 30px' }}>
                    <Link
                      href={`/projects/category/${cur.id}`}
                      onClick={() => setMegaOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 9,
                        marginBottom: 20,
                        cursor: 'pointer',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <h3 style={{ fontSize: 21, fontWeight: 700, color: 'var(--text)' }}>
                        {cur.ar}
                      </h3>
                      <span style={{ fontSize: 12.5, color: 'var(--muted2)' }}>{cur.count}</span>
                      <Icon
                        name="chevron_left"
                        size={18}
                        color="var(--accent)"
                        style={{ marginInlineStart: 'auto' }}
                      />
                    </Link>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 28px' }}>
                      {cur.subs.map((s) => (
                        <Link
                          key={s}
                          href={`/projects/category/${cur.id}`}
                          onClick={() => setMegaOpen(false)}
                          style={{
                            cursor: 'pointer',
                            fontSize: 15,
                            color: 'var(--text-soft)',
                            padding: '8px 0',
                            display: 'inline-block',
                            textDecoration: 'none',
                          }}
                        >
                          {s}
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '26px',
                      borderInlineStart: '1px solid rgba(var(--ink-rgb),.07)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: 'var(--muted2)',
                        letterSpacing: '.5px',
                        marginBottom: 16,
                      }}
                    >
                      تصفية حسب
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {MEGA_FILTERS.map((f) => (
                        <Link
                          key={f.id}
                          href={`/projects/discover?status=${f.status}`}
                          onClick={() => setMegaOpen(false)}
                          style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 11,
                            padding: '9px 11px',
                            borderRadius: 11,
                            color: 'var(--text-soft)',
                            textDecoration: 'none',
                          }}
                        >
                          <Icon name={f.icon} size={19} color="var(--accent)" />
                          <span style={{ fontSize: 14.5, fontWeight: 500 }}>{f.ar}</span>
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '26px 26px 26px 30px',
                      borderInlineStart: '1px solid rgba(var(--ink-rgb),.07)',
                      background: 'rgba(var(--ink-rgb),.02)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: 'var(--muted2)',
                        letterSpacing: '.5px',
                        marginBottom: 14,
                      }}
                    >
                      مشروع مميّز
                    </div>
                    <Link
                      href={`/projects/${megaFeatured.id}`}
                      onClick={() => setMegaOpen(false)}
                      style={{
                        cursor: 'pointer',
                        background: 'var(--card)',
                        border: '1px solid rgba(var(--ink-rgb),.09)',
                        borderRadius: 16,
                        overflow: 'hidden',
                        textDecoration: 'none',
                        color: 'inherit',
                        display: 'block',
                        boxShadow: 'var(--card-shadow)',
                      }}
                    >
                      <div
                        className="wathba-ph"
                        style={{ height: 118, position: 'relative' }}
                      >
                        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                          <Num style={{ fontSize: 10, color: 'var(--ph-label)' }}>
                            [ {megaFeatured.cat} ]
                          </Num>
                        </div>
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: 4,
                            background: 'rgba(var(--ink-rgb),.12)',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: megaFeatured.pctW,
                              background: 'var(--grad)',
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ padding: '13px 14px 15px' }}>
                        <div
                          style={{
                            fontSize: 14.5,
                            fontWeight: 700,
                            color: 'var(--text)',
                            lineHeight: 1.35,
                            marginBottom: 4,
                          }}
                        >
                          {megaFeatured.titleAr}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 10 }}>
                          {megaFeatured.creator}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <Num style={{ fontWeight: 700, color: 'var(--accent)' }}>
                            %{megaFeatured.pct}
                          </Num>
                          <span style={{ color: 'var(--muted2)' }}>
                            مموَّل · {megaFeatured.daysLeft} يوم متبقٍ
                          </span>
                        </div>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Link href="/projects/how" style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none' }}>
            كيف تعمل
          </Link>
          <Link href="/projects/ranks" style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none' }}>
            رتب الداعمين
          </Link>
        </nav>

        <Link
          href="/projects/search"
          style={{
            flex: 1,
            maxWidth: 380,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(var(--ink-rgb),.05)',
            border: '1px solid rgba(var(--ink-rgb),.09)',
            borderRadius: 13,
            padding: '10px 15px',
            cursor: 'text',
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          <Icon name="search" size={20} color="var(--muted2)" />
          <span style={{ color: 'var(--muted2)', fontSize: 14 }}>
            ابحث عن مشاريع، مبدعين، فئات…
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginInlineStart: 'auto' }}>
          <button
            onClick={onToggleTheme}
            title="تبديل النمط"
            style={{
              cursor: 'pointer',
              width: 42,
              height: 42,
              borderRadius: 13,
              background: 'transparent',
              border: '1px solid rgba(var(--ink-rgb),.12)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} size={21} color="var(--muted)" />
          </button>
          <WathbaNotificationBell />
          <Link
            href="/projects/dashboard"
            style={{
              cursor: 'pointer',
              fontSize: 14.5,
              color: 'var(--muted)',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            تسجيل الدخول
          </Link>
          <Link
            href="/projects/start"
            style={{
              border: 'none',
              cursor: 'pointer',
              background: 'var(--grad)',
              color: 'var(--on-accent)',
              fontWeight: 700,
              fontSize: 14,
              padding: '11px 19px',
              borderRadius: 13,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            ابدأ مشروعك
          </Link>
        </div>
      </div>
    </header>
  );
}
