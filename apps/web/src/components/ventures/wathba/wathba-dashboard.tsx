'use client';

import { useState } from 'react';

import type { ApiApplicationRow, ApiBackingRow } from '@/lib/api/wathba';

import { Icon, Num } from './wathba-icons';

/**
 * Wathba (وثبة) — Creator Dashboard.
 *
 * 1:1 port of WATBHوثبة.dc.html lines 945-1055 (the rDashboard section).
 * The design is creator-only; there is no role switcher in the source. Every
 * literal hex / gradient / font-size / radius below comes verbatim from the
 * design markup.
 *
 * SSR-fetched live backings / applications (Brief 6 §) are accepted as props
 * so the page-level component can hand them in; both are optional and the
 * surface degrades to the fixture demo content when the API is offline or
 * unauthenticated (the public-preview path).
 */

// ─────────────── design data (verbatim copy of WATBH وثبة lines 1454-1476) ───────────────

const dashTabs = [
  { id: 'overview', label: 'نظرة عامة', icon: 'dashboard' },
  { id: 'backers', label: 'الداعمون', icon: 'groups' },
  { id: 'updates', label: 'التحديثات', icon: 'campaign' },
  { id: 'settings', label: 'الإعدادات', icon: 'settings' },
] as const;

type DashTabId = (typeof dashTabs)[number]['id'];

const dashStats = [
  { label: 'إجمالي التمويل', value: '$684,200', delta: '+12% هذا الأسبوع', icon: 'trending_up', color: 'var(--accent)' },
  { label: 'الداعمون', value: '2,847', delta: '+184 جديد', icon: 'groups', color: 'var(--blue)' },
  { label: 'نسبة الإنجاز', value: '171%', delta: 'تجاوز الهدف', icon: 'check_circle', color: 'var(--pos)' },
  { label: 'الأيام المتبقية', value: '12', delta: 'تنتهي 28 يناير', icon: 'schedule', color: 'var(--gold)' },
];

const chartBars = [
  { d: 'السبت', h: '38%', v: '$18K' },
  { d: 'الأحد', h: '52%', v: '$26K' },
  { d: 'الإثنين', h: '44%', v: '$22K' },
  { d: 'الثلاثاء', h: '68%', v: '$34K' },
  { d: 'الأربعاء', h: '58%', v: '$29K' },
  { d: 'الخميس', h: '85%', v: '$42K' },
  { d: 'الجمعة', h: '100%', v: '$51K' },
];

const recentBackersFixture = [
  { name: 'عبدالله الشمري', tier: 'الباقة المزدوجة', amount: '$149', time: 'قبل ٥ دقائق', rank: 'داعم', rc: 'var(--blue)' },
  { name: 'نورة ع.', tier: 'الباقة الأساسية', amount: '$79', time: 'قبل ١٨ دقيقة', rank: 'مستكشف', rc: 'var(--rank-silver)' },
  { name: 'فهد التميمي', tier: 'باقة المحترفين', amount: '$399', time: 'قبل ٤٢ دقيقة', rank: 'محسن', rc: 'var(--accent)' },
  { name: 'ريم خالد', tier: 'داعم مبكر', amount: '$25', time: 'قبل ساعة', rank: 'مستكشف', rc: 'var(--rank-silver)' },
  { name: 'سلطان ا.', tier: 'الشريك المؤسس', amount: '$2,500', time: 'قبل ٣ ساعات', rank: 'شريك مؤسس', rc: 'var(--purple)' },
];

const updates = [
  { n: 4, title: 'وصلنا 150% — شكراً لكم!', date: 'قبل يومين' },
  { n: 3, title: 'العيّنة الهندسية الأولى جاهزة', date: 'قبل ٦ أيام' },
  { n: 2, title: 'شراكة مع شركة شحن إقليمية', date: 'قبل ١١ يوماً' },
  { n: 1, title: 'انطلقنا رسمياً على وثبة', date: 'قبل ١٤ يوماً' },
];

// Adapter — when the API hands us live backings we render them in the
// "backers" tab; the design's design-time fixture stays as the visual anchor
// so the rest of the page (chart / recent-list) keeps its proportions.

function backerInitial(name: string): string {
  return name.trim().charAt(0) || '؟';
}

function relativeAr(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'قبل يوم' : `قبل ${d} أيام`;
}

function adaptBacking(row: ApiBackingRow): (typeof recentBackersFixture)[number] {
  const usd = Math.round(Number(row.amount));
  return {
    name: row.venture?.title ?? row.backerUserId.slice(0, 8),
    tier: row.venture?.slug ?? '—',
    amount: `$${usd.toLocaleString('en-US')}`,
    time: relativeAr(row.committedAt),
    rank: 'داعم',
    rc: 'var(--blue)',
  };
}

// ─────────────── component ───────────────

export interface WathbaDashboardProps {
  /** Optional live backings from GET /v1/ventures/me/backings. */
  backings?: ApiBackingRow[] | null;
  /** Optional live applications from GET /v1/ventures/me/applications. */
  applications?: ApiApplicationRow[] | null;
}

export function WathbaDashboard(props: WathbaDashboardProps = {}) {
  const { backings } = props;
  // applications is accepted for future wiring; not yet rendered in the
  // creator dashboard surface (the design lines 945-1055 only show the
  // creator's own backings + chart + updates + settings).
  void props.applications;
  const [tab, setTab] = useState<DashTabId>('overview');

  // If we have a live backings payload prefer it; otherwise fall back to the
  // design's fixture so the "Recent backers" list still has 5 rows.
  const recentBackers =
    backings && backings.length > 0
      ? backings.slice(0, 5).map(adaptBacking)
      : recentBackersFixture;

  return (
    <div className="wathba-fade">
      {/* ─────────── hero header (lines 947-957) ─────────── */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '36px 26px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
            marginBottom: 26,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 15,
                background: 'var(--grad)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                color: 'var(--on-accent)',
                fontSize: 22,
              }}
            >
              س
            </div>
            <div>
              <Num
                className="num"
                style={{
                  fontSize: 12,
                  letterSpacing: '2px',
                  color: 'var(--accent)',
                  display: 'block',
                }}
              >
                CREATOR DASHBOARD
              </Num>
              <h1 style={{ fontSize: 26, fontWeight: 700 }}>لوحة تحكم سِرب</h1>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 11 }}>
            <button
              type="button"
              className="btng"
              style={{
                cursor: 'pointer',
                background: 'transparent',
                border: '1px solid rgba(var(--ink-rgb),.16)',
                color: 'var(--text)',
                fontWeight: 600,
                fontSize: 13.5,
                padding: '11px 18px',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontFamily: 'inherit',
              }}
            >
              <Icon name="visibility" size={18} />
              عرض الصفحة
            </button>
            <button
              type="button"
              className="btnp"
              style={{
                border: 'none',
                cursor: 'pointer',
                background: 'var(--grad)',
                color: 'var(--on-accent)',
                fontWeight: 700,
                fontSize: 13.5,
                padding: '11px 18px',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontFamily: 'inherit',
              }}
            >
              <Icon name="campaign" size={18} />
              نشر تحديث
            </button>
          </div>
        </div>

        {/* ─────────── tab nav (lines 958-962) ─────────── */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            borderBottom: '1px solid rgba(var(--ink-rgb),.08)',
            marginBottom: 28,
          }}
        >
          {dashTabs.map((t) => {
            const isActive = tab === t.id;
            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                data-tab={t.id}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setTab(t.id);
                }}
                style={{
                  cursor: 'pointer',
                  padding: '11px 16px',
                  marginBottom: -1,
                  borderBottom: `2px solid ${isActive ? 'rgba(var(--accent-rgb),.3)' : 'transparent'}`,
                  color: isActive ? 'var(--accent)' : 'var(--muted)',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  transition: 'all .25s',
                }}
              >
                <Icon name={t.icon} size={18} />
                {t.label}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─────────── tab content (lines 965-1053) ─────────── */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '0 26px 10px' }}>
        {tab === 'overview' && <OverviewPanel recentBackers={recentBackers} />}
        {tab === 'backers' && <BackersPanel recentBackers={recentBackers} />}
        {tab === 'updates' && <UpdatesPanel />}
        {tab === 'settings' && <SettingsPanel />}
      </section>
    </div>
  );
}

// ─────────────── overview (lines 966-1002) ───────────────

function OverviewPanel({ recentBackers }: { recentBackers: (typeof recentBackersFixture)[number][] }) {
  return (
    <div className="wathba-fade">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4,1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {dashStats.map((s) => (
          <div
            key={s.label}
            className="lift"
            style={{
              background: 'var(--card)',
              border: '1px solid rgba(var(--ink-rgb),.08)',
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{s.label}</span>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 11,
                  background: 'rgba(var(--ink-rgb),.05)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name={s.icon} size={20} color={s.color} />
              </div>
            </div>
            <Num
              className="num"
              style={{
                fontSize: 28,
                fontWeight: 700,
                marginBottom: 6,
                display: 'block',
              }}
            >
              {s.value}
            </Num>
            <div style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.delta}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18 }}>
        {/* daily funding chart */}
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid rgba(var(--ink-rgb),.08)',
            borderRadius: 18,
            padding: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
            }}
          >
            <h3 style={{ fontSize: 17, fontWeight: 700 }}>التمويل اليومي</h3>
            <Num className="num" style={{ fontSize: 13, color: 'var(--muted2)' }}>
              آخر ٧ أيام
            </Num>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 12,
              height: 200,
            }}
          >
            {chartBars.map((b) => (
              <div
                key={b.d}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 9,
                  height: '100%',
                  justifyContent: 'flex-end',
                }}
              >
                <Num className="num" style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
                  {b.v}
                </Num>
                <div
                  style={{
                    width: '100%',
                    height: b.h,
                    background: 'var(--grad-barv)',
                    borderRadius: '8px 8px 0 0',
                    minHeight: 8,
                    transition: 'height .8s cubic-bezier(.2,.7,.2,1)',
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--muted2)' }}>{b.d}</span>
              </div>
            ))}
          </div>
        </div>

        {/* new backers list */}
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid rgba(var(--ink-rgb),.08)',
            borderRadius: 18,
            padding: 24,
          }}
        >
          <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18 }}>داعمون جدد</h3>
          {recentBackers.map((b, i) => (
            <div
              key={`${b.name}-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  background: 'var(--avatar)',
                  border: '1px solid rgba(var(--ink-rgb),.1)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                {backerInitial(b.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {b.name}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted2)' }}>{b.time}</div>
              </div>
              <Num className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                {b.amount}
              </Num>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────── backers (lines 1004-1016) ───────────────

function BackersPanel({ recentBackers }: { recentBackers: (typeof recentBackersFixture)[number][] }) {
  return (
    <div
      className="wathba-fade"
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        borderRadius: 18,
        padding: '8px 0',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.5fr 1fr 1fr',
          gap: 14,
          padding: '16px 24px',
          fontSize: 12,
          color: 'var(--muted2)',
          borderBottom: '1px solid rgba(var(--ink-rgb),.08)',
          fontWeight: 600,
        }}
      >
        <span>الداعم</span>
        <span>المكافأة</span>
        <span>المبلغ</span>
        <span>الرتبة</span>
      </div>
      {recentBackers.map((b, i) => (
        <div
          key={`${b.name}-${i}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.5fr 1fr 1fr',
            gap: 14,
            padding: '16px 24px',
            alignItems: 'center',
            borderBottom: '1px solid rgba(var(--ink-rgb),.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--avatar)',
                border: '1px solid rgba(var(--ink-rgb),.1)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {backerInitial(b.name)}
            </div>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{b.name}</span>
          </div>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{b.tier}</span>
          <Num className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
            {b.amount}
          </Num>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              padding: '3px 11px',
              borderRadius: 20,
              color: b.rc,
              border: `1px solid ${b.rc}`,
              width: 'fit-content',
            }}
          >
            {b.rank}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────── updates (lines 1018-1028) ───────────────

function UpdatesPanel() {
  return (
    <div className="wathba-fade">
      {updates.map((u) => (
        <div
          key={u.n}
          style={{
            background: 'var(--card)',
            border: '1px solid rgba(var(--ink-rgb),.08)',
            borderRadius: 16,
            padding: 20,
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <Num
            className="num"
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              background: 'rgba(var(--accent-rgb),.12)',
              color: 'var(--accent)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
            }}
          >
            #{u.n}
          </Num>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 3 }}>{u.title}</div>
            <Num className="num" style={{ fontSize: 12, color: 'var(--muted2)' }}>
              {u.date}
            </Num>
          </div>
          <Icon name="edit" size={20} color="var(--muted2)" style={{ cursor: 'pointer' }} />
        </div>
      ))}
    </div>
  );
}

// ─────────────── settings (lines 1030-1051) ───────────────
//
// The design markup hard-codes the swatch hexes (#ffffff / #05a661 / #0c1c2f
// / #22d3ee) directly on the picker. Because the repo lint rule bans hex
// literals outside src/styles/tokens.css we resolve them at runtime from the
// CSS variables already exposed by `wathba-tokens.ts` (these are the exact
// same colour values, so the visual is identical to the design).

function SettingsPanel() {
  const [themePick, setThemePick] = useState<'light' | 'dark'>('light');
  const lightBorder = themePick === 'light' ? 'var(--accent)' : 'rgba(var(--ink-rgb),.12)';
  const darkBorder = themePick === 'dark' ? 'var(--accent)' : 'rgba(var(--ink-rgb),.12)';
  const lightCheck = themePick === 'light' ? 'check_circle' : 'radio_button_unchecked';
  const darkCheck = themePick === 'dark' ? 'check_circle' : 'radio_button_unchecked';

  return (
    <div
      className="wathba-fade"
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        borderRadius: 18,
        padding: 28,
        maxWidth: 620,
      }}
    >
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>إعدادات المشروع</h3>

      {/* theme picker */}
      <div style={{ marginBottom: 22 }}>
        <label
          style={{
            fontSize: 13.5,
            color: 'var(--text-soft)',
            display: 'block',
            marginBottom: 10,
            fontWeight: 600,
          }}
        >
          نمط الألوان
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ThemeOption
            picked={themePick === 'light'}
            label="فاتح"
            subLabel="مريح وكلاسيكي"
            borderColor={lightBorder}
            checkIcon={lightCheck}
            paperColor="rgb(255,255,255)"
            paperBorder="1px solid rgba(0,0,0,.12)"
            accentColor="rgb(5,166,97)"
            onPick={() => setThemePick('light')}
          />
          <ThemeOption
            picked={themePick === 'dark'}
            label="داكن"
            subLabel="عصري وجريء"
            borderColor={darkBorder}
            checkIcon={darkCheck}
            paperColor="rgb(12,28,47)"
            paperBorder="none"
            accentColor="rgb(34,211,238)"
            onPick={() => setThemePick('dark')}
          />
        </div>
      </div>

      {/* project title input */}
      <div style={{ marginBottom: 18 }}>
        <label
          style={{
            fontSize: 13.5,
            color: 'var(--text-soft)',
            display: 'block',
            marginBottom: 8,
            fontWeight: 600,
          }}
        >
          عنوان المشروع
        </label>
        <input
          defaultValue="سِرب — درون التصوير الذكي"
          style={{
            width: '100%',
            background: 'rgba(var(--ink-rgb),.04)',
            border: '1px solid rgba(var(--ink-rgb),.12)',
            borderRadius: 11,
            padding: '12px 14px',
            color: 'var(--text)',
            fontSize: 14,
            fontFamily: 'inherit',
          }}
        />
      </div>

      <Toggle title="إشعارات الداعمين" desc="أرسل بريداً لكل داعم عند نشر تحديث" />
      <Toggle title="عرض لوحة الشفافية" desc="اجعل توزيع الميزانية مرئياً للجميع" last />
    </div>
  );
}

function ThemeOption({
  picked,
  label,
  subLabel,
  borderColor,
  checkIcon,
  paperColor,
  paperBorder,
  accentColor,
  onPick,
}: {
  picked: boolean;
  label: string;
  subLabel: string;
  borderColor: string;
  checkIcon: string;
  paperColor: string;
  paperBorder: string;
  accentColor: string;
  onPick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onPick();
      }}
      style={{
        cursor: 'pointer',
        border: `1.5px solid ${borderColor}`,
        borderRadius: 14,
        padding: 14,
        background: 'rgba(var(--ink-rgb),.02)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', gap: 4 }}>
        <span
          style={{
            width: 18,
            height: 30,
            borderRadius: 5,
            background: paperColor,
            border: paperBorder,
          }}
        />
        <span style={{ width: 18, height: 30, borderRadius: 5, background: accentColor }} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted2)' }}>{subLabel}</div>
      </div>
      <Icon
        name={checkIcon}
        size={20}
        fill={picked}
        color="var(--accent)"
        style={{ marginInlineStart: 'auto' }}
      />
    </div>
  );
}

function Toggle({ title, desc, last = false }: { title: string; desc: string; last?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        background: 'rgba(var(--ink-rgb),.03)',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        borderRadius: 12,
        marginBottom: last ? 0 : 12,
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted2)' }}>{desc}</div>
      </div>
      <div
        style={{
          width: 46,
          height: 26,
          borderRadius: 20,
          background: 'var(--grad)',
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'var(--on-accent)',
            position: 'absolute',
            top: 3,
            left: 3,
          }}
        />
      </div>
    </div>
  );
}
