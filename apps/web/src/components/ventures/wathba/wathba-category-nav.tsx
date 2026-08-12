'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Icon, Num } from './wathba-icons';

/**
 * Batch CAT / Part 3 — the live category bar + mega-menu (Kickstarter pattern,
 * Arabic RTL). Driven by GET /v1/categories (via /api/categories BFF), NOT the
 * old fixture list.
 *
 * - 21 top-level items in a horizontally-scrollable RTL strip.
 * - Per-category three-zone panel: subcategory columns · "تصفية حسب" filter
 *   links · lazy "مشروع مميّز" featured card.
 * - Full keyboard support (menubar semantics): Arrow keys roam the strip,
 *   Enter/Space/Down opens, Esc closes + restores focus, Tab is trapped inside
 *   the open panel. Opens on hover (desktop) and click/focus (touch). WCAG 2.2 AA.
 */

interface CatNode {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  liveCount: number;
  children: CatNode[];
}

interface FeaturedProject {
  id: string;
  titleAr: string;
  pct: number;
  daysLeft: number;
  isStaffPick: boolean;
}

const FILTERS: Array<{ key: string; ar: string; icon: string }> = [
  { key: 'trending', ar: 'الرائجة', icon: 'trending_up' },
  { key: 'nearly_funded', ar: 'قاربت على التمويل', icon: 'pie_chart' },
  { key: 'just_launched', ar: 'أُطلقت حديثاً', icon: 'bolt' },
  { key: 'near_you', ar: 'مشاريع قريبة منك', icon: 'location_on' },
  { key: 'staff_pick', ar: 'مختارات وثبة', icon: 'verified' },
];

function toDisplayDigits(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => '0123456789'[Number(d)]!);
}

/**
 * POLISH Unit 3 — ONE source for the strip's height, used by both the loading
 * placeholder and the loaded strip. They used to be 46px and "whatever the
 * content came out as", which is a layout shift on every first paint.
 */
const STRIP_H = 48;

/** Scroll affordance. Overlaid, never in flow, so showing it shifts nothing. */
function StripArrow({ dir, onClick }: { dir: 'start' | 'end'; onClick: () => void }) {
  return (
    <button
      type="button"
      className="wathba-cat-arrow"
      onClick={onClick}
      // Decorative duplicate of what arrow keys and swipe already do, so it is
      // hidden from assistive tech rather than announced as a third way to move.
      aria-hidden
      tabIndex={-1}
      style={{
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        ...(dir === 'start' ? { insetInlineStart: 18 } : { insetInlineEnd: 18 }),
        zIndex: 3,
        width: 28,
        height: 28,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 999,
        background: 'var(--surface-2)',
        border: '1px solid rgba(var(--ink-rgb),.12)',
        color: 'var(--text-soft)',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {/* RTL: the inline-START edge is the RIGHT one, so the glyph that points
          "back toward the start" is the right-pointing arrow. Naming a direction
          after the writing order rather than the screen is how these end up
          backwards. */}
      <Icon name={dir === 'start' ? 'arrow_forward' : 'arrow_back'} size={16} color="currentColor" />
    </button>
  );
}

export function WathbaCategoryNav() {
  const pathname = usePathname();
  const [tree, setTree] = useState<CatNode[] | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  // "pinned" = opened by click/keyboard → stays open on mouse-leave (closes on
  // outside-click, Esc, or selecting an item). Prevents the hover-leave timer
  // from racing a click on a panel item.
  const [pinned, setPinned] = useState(false);
  const [featured, setFeatured] = useState<Record<string, FeaturedProject | null>>({});
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [overflow, setOverflow] = useState<{ start: boolean; end: boolean }>({ start: false, end: false });
  /**
   * One screenful, minus a sliver so the next pill peeks in.
   *
   * `toward` is +1 for the strip's END and -1 for its START — reading order,
   * not screen order. Converting that to a scrollBy delta is where this was
   * wrong: in RTL, Blink starts scrollLeft at 0 and runs NEGATIVE toward the
   * end, so the end arrow asked for a POSITIVE delta, the browser clamped it at
   * 0, and the strip never moved. At rest only the end arrow is rendered — so
   * the one arrow a reader could see was the one that did nothing, and 13 of
   * the 21 categories were unreachable by mouse.
   *
   * The keyboard path (onStripKey) already had this right, which is why this
   * survived: arrow keys moved the strip and the arrows did not.
   */
  const nudge = (toward: 1 | -1) => {
    const el = stripRef.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollBy({ left: el.clientWidth * 0.8 * toward * (rtl ? -1 : 1), behavior: 'smooth' });
  };
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/categories')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CatNode[] | null) => {
        if (alive && Array.isArray(d)) setTree(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Lazily load the featured card for whichever category is open.
  const loadFeatured = useCallback(
    async (slug: string) => {
      if (featured[slug] !== undefined) return;
      setFeatured((f) => ({ ...f, [slug]: null })); // mark in-flight (renders "no card")
      const pick = async (q: string): Promise<FeaturedProject | null> => {
        try {
          const r = await fetch(`/api/discover?${q}`);
          if (!r.ok) return null;
          const d = (await r.json()) as {
            items?: Array<{
              id: string;
              titleAr: string;
              fundingGoalHalalas: number;
              raisedHalalas: number;
              deadline: string;
              isStaffPick: boolean;
            }>;
          };
          const p = d.items?.[0];
          if (!p) return null;
          const pct = p.fundingGoalHalalas > 0
            ? Math.round((p.raisedHalalas / p.fundingGoalHalalas) * 100)
            : 0;
          const daysLeft = Math.max(
            0,
            Math.ceil((new Date(p.deadline).getTime() - Date.now()) / 86_400_000),
          );
          return { id: p.id, titleAr: p.titleAr, pct, daysLeft, isStaffPick: p.isStaffPick };
        } catch {
          return null;
        }
      };
      // staff pick (nearest deadline) → highest-funded LIVE → none.
      const found =
        (await pick(`categorySlug=${slug}&filter=staff_pick&sort=ending_soon&take=1`)) ??
        (await pick(`categorySlug=${slug}&sort=most_funded&take=1`));
      setFeatured((f) => ({ ...f, [slug]: found }));
    },
    [featured],
  );

  const open = useCallback(
    (slug: string) => {
      setOpenSlug(slug);
      void loadFeatured(slug);
    },
    [loadFeatured],
  );

  const close = useCallback((restoreIndex?: number) => {
    setOpenSlug(null);
    setPinned(false);
    if (restoreIndex !== undefined) btnRefs.current[restoreIndex]?.focus();
  }, []);

  const onHoverEnter = (slug: string) => {
    if (pinned) return; // click/keyboard controls the menu once pinned
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    open(slug);
  };
  const onHoverLeave = () => {
    if (pinned) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpenSlug(null), 120);
  };

  // Close a pinned menu on outside-click.
  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pinned, close]);

  const onStripKey = (e: React.KeyboardEvent, index: number, slug: string) => {
    const count = tree?.length ?? 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      // RTL: ArrowLeft advances, ArrowRight goes back.
      const dir = e.key === 'ArrowLeft' ? 1 : -1;
      const next = (index + dir + count) % count;
      btnRefs.current[next]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      open(slug);
      setPinned(true);
      // Move focus into the panel's first link on next paint.
      requestAnimationFrame(() => {
        const first = panelRef.current?.querySelector<HTMLElement>('a,button');
        first?.focus();
      });
    } else if (e.key === 'Escape') {
      close();
    }
  };

  const onPanelKey = (e: React.KeyboardEvent, triggerIndex: number) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(triggerIndex);
      return;
    }
    if (e.key === 'Tab') {
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>('a,button');
      if (!focusables || focusables.length === 0) return;
      const list = Array.from(focusables);
      const firstEl = list[0]!;
      const lastEl = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  };

  // POLISH Unit 3 — the placeholder and the loaded strip are the SAME height,
  // from one constant, so the bar cannot contribute layout shift when the
  // categories arrive.
  // POLISH Unit 3 — which edges have content off-screen. Drives the fades and
  // the arrows; recomputed on scroll and on resize so it never goes stale.
  // Math.abs on scrollLeft because RTL reports it negative in Blink.
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const measure = () => {
      const x = Math.abs(el.scrollLeft);
      const max = el.scrollWidth - el.clientWidth;
      setOverflow({ start: x > 4, end: max - x > 4 });
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, [tree]);

  if (!tree) return <div style={{ height: STRIP_H }} aria-hidden />;

  const openIndex = openSlug ? tree.findIndex((t) => t.slug === openSlug) : -1;
  const cur = openIndex >= 0 ? tree[openIndex]! : null;
  const feat = cur ? featured[cur.slug] : undefined;

  return (
    <div
      ref={rootRef}
      style={{
        borderTop: '1px solid rgba(var(--ink-rgb),.05)',
        background: 'var(--header-bg)',
        position: 'relative',
      }}
      onMouseLeave={onHoverLeave}
    >
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 26px', position: 'relative' }}>
        {/* Edge fades tell you there IS more, before you try to scroll. Only
            rendered on the side that actually has content off-screen, and RTL
            aware: `start` is the right edge here. */}
        {overflow.start && (
          <div
            className="wathba-cat-fade"
            aria-hidden
            style={{ insetInlineStart: 26, background: 'linear-gradient(to left, var(--surface-0), transparent)' }}
          />
        )}
        {overflow.end && (
          <div
            className="wathba-cat-fade"
            aria-hidden
            style={{ insetInlineEnd: 26, background: 'linear-gradient(to right, var(--surface-0), transparent)' }}
          />
        )}
        {overflow.start && <StripArrow dir="start" onClick={() => nudge(-1)} />}
        {overflow.end && <StripArrow dir="end" onClick={() => nudge(1)} />}

        <div
          ref={stripRef}
          className="wathba-catstrip"
          role="menubar"
          aria-label="فئات المشاريع"
          // The strip is a horizontally scrollable region, so it must be
          // reachable and pannable by keyboard for anyone who cannot swipe.
          // Arrow keys already move focus between pills (onStripKey); this makes
          // the container itself a scroll target too.
          data-cat-nav-ready="1"
          style={{
            display: 'flex',
            alignItems: 'center',
            // Rhythm: enough air that the labels read as separate destinations
            // rather than one run-on line of text.
            gap: 6,
            overflowX: 'auto',
            padding: '7px 0',
            height: STRIP_H,
            boxSizing: 'border-box',
            WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'smooth',
          }}
        >
          {tree.map((c, i) => {
            const active = c.slug === openSlug;
            // STAKES/S-11 F-14 (D5) — mark the category the user is ON, not
            // just the one whose menu is open.
            const onPage = pathname.startsWith(`/projects/discover/${c.slug}`);
            return (
              <div
                key={c.id}
                onMouseEnter={() => onHoverEnter(c.slug)}
                style={{ position: 'static', flexShrink: 0 }}
              >
                <button
                  ref={(el) => {
                    btnRefs.current[i] = el;
                  }}
                  type="button"
                  role="menuitem"
                  aria-haspopup="true"
                  aria-expanded={active}
                  aria-controls={active ? 'wathba-megamenu' : undefined}
                  tabIndex={i === 0 ? 0 : -1}
                  onKeyDown={(e) => onStripKey(e, i, c.slug)}
                  onClick={() => {
                    if (active && pinned) close();
                    else {
                      open(c.slug);
                      setPinned(true);
                    }
                  }}
                  data-cat-slug={c.slug}
                  aria-current={onPage ? 'page' : undefined}
                  className="wathba-cat-pill"
                  style={{
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    // A pill, so the hit area reads as a control rather than as
                    // a word in a sentence.
                    background:
                      onPage || active ? 'rgba(var(--accent-rgb),.14)' : 'transparent',
                    border: '1px solid',
                    borderColor: onPage ? 'rgba(var(--accent-rgb),.45)' : 'transparent',
                    borderRadius: 999,
                    padding: '7px 15px',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    // WCAG 1.4.1 — the CURRENT category is never signalled by
                    // colour alone. It carries three non-colour cues at once:
                    // heavier weight, a ring, and the leading dot below.
                    fontWeight: onPage ? 800 : active ? 700 : 600,
                    color: active || onPage ? 'var(--accent-ink)' : 'var(--text-soft)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    lineHeight: 1.3,
                  }}
                >
                  {onPage && (
                    <span
                      aria-hidden
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: 'var(--accent)',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {c.nameAr}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {cur && (
        <div
          id="wathba-megamenu"
          ref={panelRef}
          role="menu"
          aria-label={cur.nameAr}
          onKeyDown={(e) => onPanelKey(e, openIndex)}
          onMouseEnter={() => {
            if (hoverTimer.current) clearTimeout(hoverTimer.current);
          }}
          style={{
            position: 'absolute',
            top: '100%',
            insetInline: 0,
            zIndex: 70,
            display: 'flex',
            justifyContent: 'center',
            padding: '0 26px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 1320,
              background: 'var(--card)',
              border: '1px solid rgba(var(--ink-rgb),.1)',
              borderTop: 'none',
              borderRadius: '0 0 22px 22px',
              boxShadow: '0 40px 80px -30px rgba(0,0,0,.55)',
              overflow: 'hidden',
              display: 'grid',
              gridTemplateColumns: '1fr 236px 300px',
            }}
          >
            {/* Zone A — subcategory columns */}
            <div style={{ padding: '24px 30px' }}>
              <Link
                href={`/projects/discover/${cur.slug}`}
                onClick={() => close()}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 9,
                  marginBottom: 18,
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{cur.nameAr}</h3>
                <span style={{ fontSize: 12.5, color: 'var(--muted2)' }}>
                  {toDisplayDigits(cur.liveCount)} مشروع نشط
                </span>
                <Icon name="chevron_left" size={17} color="var(--accent)" style={{ marginInlineStart: 'auto' }} />
              </Link>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2px 22px' }}>
                {cur.children.map((s) => (
                  <Link
                    key={s.id}
                    href={`/projects/discover/${cur.slug}/${s.slug}`}
                    onClick={() => close()}
                    role="menuitem"
                    style={{
                      fontSize: 14,
                      color: 'var(--text-soft)',
                      padding: '7px 0',
                      textDecoration: 'none',
                    }}
                  >
                    {s.nameAr}
                  </Link>
                ))}
              </div>
            </div>

            {/* Zone B — filter links */}
            <div style={{ padding: '24px', borderInlineStart: '1px solid rgba(var(--ink-rgb),.07)' }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: 'var(--muted2)',
                  letterSpacing: '.5px',
                  marginBottom: 14,
                }}
              >
                تصفية حسب
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {FILTERS.map((f) => (
                  <Link
                    key={f.key}
                    href={
                        // Same reason as the category page: `near_you` needs a
                        // region nothing can supply, so the chip asks instead of
                        // silently returning nothing. See wathba-discover-category.
                        f.key === 'near_you'
                          ? `/projects/discover-all?cat=${encodeURIComponent(cur.slug)}&sort=near_me`
                          : `/projects/discover/${cur.slug}?filter=${f.key}`
                      }
                    onClick={() => close()}
                    role="menuitem"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      padding: '9px 11px',
                      borderRadius: 11,
                      color: 'var(--text-soft)',
                      textDecoration: 'none',
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    <Icon name={f.icon} size={18} color="var(--accent)" />
                    {f.ar}
                  </Link>
                ))}
              </div>
            </div>

            {/* Zone C — featured card (lazy; hidden if none) */}
            <div
              style={{
                padding: '24px 26px',
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
              {feat ? (
                <Link
                  href={`/projects/${feat.id}`}
                  onClick={() => close()}
                  role="menuitem"
                  style={{
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
                  <div className="wathba-ph" style={{ height: 112, position: 'relative' }}>
                    {feat.isStaffPick && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 8,
                          insetInlineStart: 8,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: 'var(--accent)',
                          color: 'var(--on-accent)',
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 8,
                        }}
                      >
                        <Icon name="verified" size={12} color="var(--on-accent)" />
                        مختارات وثبة
                      </div>
                    )}
                    <div
                      style={{
                        position: 'absolute',
                        insetInline: 0,
                        bottom: 0,
                        height: 4,
                        background: 'rgba(var(--ink-rgb),.12)',
                      }}
                    >
                      <div style={{ height: '100%', width: `${Math.min(100, feat.pct)}%`, background: 'var(--grad)' }} />
                    </div>
                  </div>
                  <div style={{ padding: '12px 14px 14px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, marginBottom: 8 }}>
                      {feat.titleAr}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <Num style={{ fontWeight: 700, color: 'var(--accent-ink)' }}>%{toDisplayDigits(feat.pct)}</Num>
                      <span style={{ color: 'var(--muted2)' }}>
                        مموَّل · {toDisplayDigits(feat.daysLeft)} يوم متبقٍ
                      </span>
                    </div>
                  </div>
                </Link>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--muted2)', padding: '8px 2px' }}>
                  لا يوجد مشروع مميّز في هذه الفئة بعد.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
