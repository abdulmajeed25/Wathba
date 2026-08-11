import { Num } from './wathba-icons';

import type { HeroSlideData } from './wathba-hero-rotator';
import { arabicCount, toArabicDigits } from './discover-all-constants';

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
 * MONEY ONLY, now that the name is honest.
 *
 * This used to format the backer COUNT as well, with a note saying it matched
 * fmtNum() in wathba-data.ts and that the hero was not the place to start
 * fixing the site's numeral inconsistency. fmtNum counts in Arabic-Indic now,
 * so holding Latin here would CREATE the inconsistency that comment was
 * avoiding: «1420 داعم» in the hero above «١٬٤٢٠ داعم» on the card below it.
 *
 * Money stays Latin deliberately — formatSar pins ar-SA-u-nu-latn for the same
 * reason — so `sar()` below is the only caller left.
 */
const money = new Intl.NumberFormat('en-US');
const sar = (halalas: string): string => money.format(Math.round(Number(halalas) / 100));

export function WathbaHeroSlideBody({ slide: p }: { slide: HeroSlideData }) {
  return (
    /**
     * HERO-METRICS — a flex column inside the card's `1fr` row.
     *
     * The card's height is declared by the rotator now, and this half is
     * whatever the cover leaves. The internal split moved from 50.4% cover /
     * 49.6% content to 48/52: the covers are generated gradient art with a 90px
     * scrim over their bottom third, so the top half was reading as expensive
     * empty space next to a cramped block of real information. The content half
     * gets the extra, and `margin-top:auto` on the stat row spends it as
     * breathing room above the numbers rather than as a gap at the bottom.
     *
     * minHeight 0 — a flex item will not shrink below its content's min-content
     * without it, which would let a long title push the card past its declared
     * height and undo the whole uniformity guarantee.
     */
    <div
      style={{
        padding: '20px 22px 22px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
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
      {/* No negative tracking: it breaks Arabic cursive joins.

          h2, not h3. This is the first heading under the page's h1 — the hero
          sits above «تصفّح حسب الفئة», so an h3 here produced an h1 → h3 jump
          and a screen-reader heading list that skipped a level on the very
          first item. Only the current slide is in the a11y tree (the others are
          visibility:hidden), so this contributes exactly one h2, in the right
          place. Size is unchanged — the level is semantic, not visual. */}
      <h2 style={{ fontSize: 23, fontWeight: 700, marginBottom: 6, lineHeight: 1.35 }}>
        {p.titleAr}
      </h2>
      <p
        style={{
          fontSize: 14,
          color: 'var(--muted)',
          lineHeight: 1.7,
          marginBottom: 16,
          // Two lines reserved whatever the copy, so a short pitch
          // and a long one occupy the same height.
          //
          // It reserved 2.8em, and two lines are not 2.8em — they are
          // 2 x 1.7 = 3.4em. The reserve was 8.4px short of the thing it claimed
          // to reserve, so a slide whose pitch wrapped was 8.4px taller than one
          // whose pitch did not, and the card's bottom edge moved between them.
          // Measured as the [39, 48] split in the pitch heights at every
          // viewport from 1180px down. Stated as a multiple of the line-height
          // so the two can never drift apart again.
          minHeight: 'calc(2 * 1.7em)',
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
      {/* Four stats where the static card had three, so on a narrow card the
          money block alone is most of the width.

          It used to be a wrapping flex row, and that is the second half of why
          the card's height moved between slides: the row wrapped by CONTENT, so
          «297,000 من 180,000» wrapped where «12,400 من 90,000» did not, and the
          row measured either 47px or 105px among the ten slides at one viewport.
          Combined with the pitch reserve above it produced six distinct card
          heights spanning 98px at a 900px viewport.

          A grid wraps by BREAKPOINT instead: four tracks above 760px, two below
          (see .wathba-hero-stat-grid in wathba-shell.tsx). Every slide at a
          given width now measures the same, whatever its numbers say. The money
          block gets 1.6 tracks because it carries two figures and the others
          carry one; minmax(0,…) everywhere so no track can be sized by its
          content.

          margin-top:auto parks the row on the card's bottom padding, which is
          what makes the extra height from the 48/52 split appear as space above
          the numbers rather than below them. */}
      <div
        className="wathba-hero-stat-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1.6fr) repeat(3, minmax(0,1fr))',
          alignItems: 'end',
          gap: '10px 10px',
          marginTop: 'auto',
        }}
      >
        <div>
          <Num style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
            {sar(p.raisedHalalas)}
          </Num>
          {/* nowrap so the phrase breaks as a unit. Without it the line wrapped
              between «من» and the figure at 1280, orphaning the preposition on
              the end of the raised amount — «297,000 من» / «180,000». It now
              either sits inline or drops whole onto the next line. */}
          <span
            style={{
              fontSize: 13,
              color: 'var(--muted2)',
              marginInlineStart: 6,
              whiteSpace: 'nowrap',
            }}
          >
            من {sar(p.goalHalalas)}
          </span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Num style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-ink)' }}>
            %{toArabicDigits(p.fundedPct)}
          </Num>
          <div style={{ fontSize: 11, color: 'var(--muted2)' }}>مُموَّل</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Num style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
            {arabicCount(p.backersCount)}
          </Num>
          <div style={{ fontSize: 11, color: 'var(--muted2)' }}>داعم</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Num style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{toArabicDigits(p.daysLeft)}</Num>
          <div style={{ fontSize: 11, color: 'var(--muted2)' }}>يوم متبقٍ</div>
        </div>
      </div>
    </div>
  );
}
