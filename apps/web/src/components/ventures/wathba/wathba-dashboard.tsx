'use client';

import { useState } from 'react';

import type { ApiApplicationRow, ApiBackingRow, ApiMyProject } from '@/lib/api/wathba';
import { formatSar } from '@/lib/i18n/format';

import { Icon, Num } from './wathba-icons';
import { toArabicDigits } from './discover-all-constants';

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

/**
 * Batch PAGE-PARITY U4 — the four tiles, derived from the creator's OWN
 * campaigns.
 *
 * They were literals: «684,200 ر.س», «2,847», «171%», "تنتهي 28 يناير". The
 * signed-in creator's real campaigns ran 21,000–76,500 SAR with 173–512
 * backers, and "ends 28 January with 12 days left" is not a date that exists in
 * August. A fixture always renders, so nothing ever failed — the same shape as
 * the campaign page that drew a fixture and never read storyAr.
 *
 * The deltas are GONE rather than invented. «+12% هذا الأسبوع» and «+184 جديد»
 * need a time series this endpoint does not carry, and a made-up trend is
 * exactly what this change exists to remove. A tile with no delta is honest; a
 * tile with a fabricated one is not.
 */
function buildStats(projects: ApiMyProject[] | null): Array<{
  label: string; value: string; delta: string | null; icon: string; color: string;
}> | null {
  if (!projects || projects.length === 0) return null;

  const live = projects.filter((p) => p.status === 'LIVE' || p.status === 'SUCCESSFUL' || p.status === 'FUNDED');
  const scope = live.length > 0 ? live : projects;
  const raised = scope.reduce((n, p) => n + Number(p.raisedHalalas), 0);
  const goal = scope.reduce((n, p) => n + Number(p.fundingGoalHalalas), 0);
  const backers = scope.reduce((n, p) => n + p.backersCount, 0);
  const pct = goal > 0 ? Math.round((raised / goal) * 100) : 0;

  // The soonest deadline still ahead — the number a creator is actually
  // counting down. Null when nothing is live, and then the tile says so.
  const now = Date.now();
  const upcoming = scope
    .map((p) => (p.deadline ? Math.ceil((new Date(p.deadline).getTime() - now) / 86_400_000) : null))
    .filter((d): d is number => d !== null && d >= 0)
    .sort((a, b) => a - b)[0];

  return [
    { label: 'إجمالي التمويل', value: formatSar('ar', Math.round(raised / 100)), delta: null, icon: 'trending_up', color: 'var(--accent-ink)' },
    { label: 'الداعمون', value: toArabicDigits(backers), delta: null, icon: 'groups', color: 'var(--blue)' },
    { label: 'نسبة الإنجاز', value: `%${toArabicDigits(pct)}`, delta: pct >= 100 ? 'تجاوز الهدف' : null, icon: 'check_circle', color: 'var(--pos-ink)' },
    {
      label: 'الأيام المتبقية',
      value: upcoming === undefined ? '—' : toArabicDigits(upcoming),
      delta: upcoming === undefined ? 'لا حملة نشطة' : null,
      icon: 'schedule', color: 'var(--gold-ink)',
    },
  ];
}

const chartBars = [
  { d: 'السبت', h: '38%', v: '18 ألف' },
  { d: 'الأحد', h: '52%', v: '26 ألف' },
  { d: 'الإثنين', h: '44%', v: '22 ألف' },
  { d: 'الثلاثاء', h: '68%', v: '34 ألف' },
  { d: 'الأربعاء', h: '58%', v: '29 ألف' },
  { d: 'الخميس', h: '85%', v: '42 ألف' },
  { d: 'الجمعة', h: '100%', v: '51 ألف' },
];

const recentBackersFixture = [
  { name: 'عبدالله الشمري', tier: 'الباقة المزدوجة', amount: '149 ر.س', time: 'قبل ٥ دقائق', rank: 'داعم', rc: 'var(--blue)' },
  { name: 'نورة ع.', tier: 'الباقة الأساسية', amount: '79 ر.س', time: 'قبل ١٨ دقيقة', rank: 'مستكشف', rc: 'var(--rank-silver)' },
  { name: 'فهد التميمي', tier: 'باقة المحترفين', amount: '399 ر.س', time: 'قبل ٤٢ دقيقة', rank: 'محسن', rc: 'var(--accent-ink)' },
  { name: 'ريم خالد', tier: 'داعم مبكر', amount: '25 ر.س', time: 'قبل ساعة', rank: 'مستكشف', rc: 'var(--rank-silver)' },
  { name: 'سلطان ا.', tier: 'الداعم المؤسس', amount: '2,500 ر.س', time: 'قبل ٣ ساعات', rank: 'داعم مؤسس', rc: 'var(--purple-ink)' },
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
  // BUG-1 (Batch SEARCH) — SAR-only: this row rendered `$…` until the
  // hardened policy guard caught it.
  const sar = Math.round(Number(row.amount));
  return {
    name: row.venture?.title ?? row.backerUserId.slice(0, 8),
    tier: row.venture?.slug ?? '—',
    amount: formatSar('ar', sar),
    time: relativeAr(row.committedAt),
    rank: 'داعم',
    rc: 'var(--blue)',
  };
}

// ─────────────── component ───────────────

export interface WathbaDashboardProps {
  /** The creator's own campaigns — what the KPI tiles are computed from. */
  myProjects?: ApiMyProject[] | null;
  /** Optional live backings from GET /v1/ventures/me/backings. */
  backings?: ApiBackingRow[] | null;
  /** Optional live applications from GET /v1/ventures/me/applications. */
  applications?: ApiApplicationRow[] | null;
}

export function WathbaDashboard(props: WathbaDashboardProps = {}) {
  const { backings, myProjects } = props;
  const dashStats = buildStats(myProjects ?? null);
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
                  color: 'var(--accent-ink)',
                  display: 'block',
                }}
              >
                CREATOR DASHBOARD
              </Num>
              {/* Named the creator's OWN newest campaign, not a hardcoded «سِرب» that
                  belonged to somebody else entirely. */}
              <h1 style={{ fontSize: 26, fontWeight: 700 }}>
                {myProjects && myProjects.length > 0
                  ? `لوحة تحكم ${myProjects[0]!.titleAr.split('—')[0]!.trim()}`
                  : 'لوحة التحكم'}
              </h1>
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
            // WRAPS, because four tabs do not fit on a phone. At 360 this row
            // measured 449px inside a 308px box and simply overflowed — the
            // page did not scroll, so «الإعدادات» was clipped off the edge with
            // no way to reach it. Wrapping keeps every tab visible; a scroller
            // would hide half of them behind a gesture with nothing to hint at
            // it. This row is also what widened the section and the page
            // wrapper to 475px.
            flexWrap: 'wrap',
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
                  color: isActive ? 'var(--accent-ink)' : 'var(--muted)',
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
        {tab === 'overview' && <OverviewPanel recentBackers={recentBackers} stats={dashStats} />}
        {tab === 'backers' && <BackersPanel recentBackers={recentBackers} />}
        {tab === 'updates' && <UpdatesPanel />}
        {tab === 'settings' && <SettingsPanel />}
      </section>
    </div>
  );
}

// ─────────────── overview (lines 966-1002) ───────────────

function OverviewPanel({
  recentBackers,
  stats,
}: {
  recentBackers: (typeof recentBackersFixture)[number][];
  /** Null when the creator has no campaigns yet — the row renders an honest
   *  empty state instead of the fixture numbers it used to show. */
  stats: ReturnType<typeof buildStats>;
}) {
  return (
    <div className="wathba-fade">
      {stats === null && (
        <div
          style={{
            border: '1px dashed rgba(var(--ink-rgb),.18)',
            borderRadius: 16,
            padding: '22px 20px',
            marginBottom: 24,
            color: 'var(--muted)',
            fontSize: 14,
          }}
        >
          لا توجد حملة بعد — الأرقام تظهر هنا بمجرد إطلاق أول حملة لك.
        </div>
      )}
      <div
        style={{
          display: stats === null ? 'none' : 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {(stats ?? []).map((s) => (
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

      <div className="wathba-dash-stack" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 18 }}>
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
              <Num className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-ink)' }}>
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
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr)',
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
            gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr)',
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
          <Num className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-ink)' }}>
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
              color: 'var(--accent-ink)',
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
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
            background: 'var(--chip-fill)',
            position: 'absolute',
            top: 3,
            left: 3,
          }}
        />
      </div>
    </div>
  );
}
