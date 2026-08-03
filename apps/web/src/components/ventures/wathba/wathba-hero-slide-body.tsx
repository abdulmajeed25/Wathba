import { Num } from './wathba-icons';

import type { HeroSlideData } from './wathba-hero-rotator';

/**
 * Batch HERO — one slide's card body, as a SERVER component.
 *
 * Deliberately not `use client`. This is the bulk of a slide's markup — meta
 * line, title, pitch, progress bar, four stats — and none of it reacts to
 * anything. Rendering it on the server keeps its JSX, the region table and the
 * money formatter out of the browser bundle; the rotator only receives the
 * finished output as children.
 *
 * The COVER is not here on purpose. Its <Image> is rendered only for a window of
 * slides chosen from the live index, because `loading="lazy"` does nothing when
 * every slide shares one grid cell — all ten covers would load before first
 * paint, which is the exact regression that windowing fixed. That decision needs
 * client state, so the cover layer stays in the rotator and only the inert half
 * moves here.
 */

const REGION_AR: Record<string, string> = {
  RIYADH: 'الرياض', MAKKAH: 'مكة المكرمة', MADINAH: 'المدينة المنورة', QASSIM: 'القصيم',
  EASTERN: 'المنطقة الشرقية', ASIR: 'عسير', TABUK: 'تبوك', HAIL: 'حائل',
  NORTHERN_BORDERS: 'الحدود الشمالية', JAZAN: 'جازان', NAJRAN: 'نجران', BAHAH: 'الباحة', JAWF: 'الجوف',
};

/**
 * Latin digits, matching fmtNum() in wathba-data.ts, which is what this card
 * showed before it rotated. The site is not internally consistent about numerals
 * — the discover cards use Arabic-Indic — but the hero is not the place to start
 * changing that, so it holds the convention it already had.
 */
const money = new Intl.NumberFormat('en-US');
const sar = (halalas: string): string => money.format(Math.round(Number(halalas) / 100));

export function WathbaHeroSlideBody({ slide: p }: { slide: HeroSlideData }) {
  return (
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
        <span style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>{p.categoryAr ?? 'وثبة'}</span>
        {p.region && <span>· {REGION_AR[p.region] ?? p.region}</span>}
        <span style={{ marginInlineStart: 'auto' }}>{p.creatorName}</span>
      </div>
      {/* No negative tracking: it breaks Arabic cursive joins. */}
      <h3 style={{ fontSize: 23, fontWeight: 700, marginBottom: 6, lineHeight: 1.35 }}>
        {p.titleAr}
      </h3>
      <p
        style={{
          fontSize: 14,
          color: 'var(--muted)',
          lineHeight: 1.7,
          marginBottom: 20,
          // Two lines reserved whatever the copy, so a short pitch
          // and a long one occupy the same height.
          minHeight: '2.8em',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {p.shortDescAr}
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
          className="wathba-hero-bar"
          style={{
            height: '100%',
            width: '100%',
            background: 'var(--grad-bar)',
            borderRadius: 30,
            // scaleX, not width: a transform does not touch layout.
            // The origin is the reading start, so it grows the way
            // the language runs.
            transform: `scaleX(${Math.min(p.fundedPct, 100) / 100})`,
          }}
        />
      </div>
      {/* Four stats where the static card had three, so this row
          has to be able to wrap: on a narrow phone the money
          block alone is most of the width. */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '12px 14px',
        }}
      >
        <div>
          <Num style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
            {sar(p.raisedHalalas)}
          </Num>
          <span style={{ fontSize: 13, color: 'var(--muted2)', marginInlineStart: 6 }}>
            من {sar(p.goalHalalas)}
          </span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Num style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-ink)' }}>
            {p.fundedPct}%
          </Num>
          <div style={{ fontSize: 11, color: 'var(--muted2)' }}>مُموَّل</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Num style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
            {money.format(p.backersCount)}
          </Num>
          <div style={{ fontSize: 11, color: 'var(--muted2)' }}>داعم</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Num style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{p.daysLeft}</Num>
          <div style={{ fontSize: 11, color: 'var(--muted2)' }}>يوم متبقٍ</div>
        </div>
      </div>
    </div>
  );
}
