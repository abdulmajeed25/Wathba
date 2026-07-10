'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import type { WathbaProject as WathbaProjectShape } from './wathba-data';
import { CAMPAIGN_TABS, resolveCampaign } from './wathba-campaign-shared';
import { Icon, Num } from './wathba-icons';
import { useTabCounts } from '@/lib/hooks/use-tab-counts';

/**
 * TABS — the persistent campaign tab bar. Every tab is a REAL route under
 * /projects/[id]; the bar renders <Link prefetch> so swaps are instant and
 * marks the active tab from usePathname (aria-current="page").
 *
 * - Sticky below the global header (top:72) once the page scrolls past the
 *   campaign header — same feel as the reference.
 * - RTL horizontal scroll on overflow: hidden scrollbar, edge fades, arrow
 *   buttons; keyboard: ←/→ move focus between tabs, Enter/Space activates
 *   (native link behaviour), Home/End jump.
 * - Count badges come from GET /v1/projects/:id/tab-counts (useTabCounts,
 *   30s poll) with the fixture counts as the never-breaks fallback.
 */
export function WathbaCampaignTabBar({
  id,
  project,
  storyHref,
}: {
  id: string;
  project?: WathbaProjectShape;
  /** Override for the story tab href — /p/[slug] keeps its canonical URL. */
  storyHref?: string;
}) {
  const { active, rich, isReal } = resolveCampaign(id, project);
  const pathname = usePathname();
  const base = `/projects/${id}`;

  const live = useTabCounts(isReal ? id : active.id);
  const fixtureCounts: Record<string, number> = {
    rewards: rich.rewards.length,
    faq: rich.faqs.length,
    updates: rich.updates.length,
    comments: rich.comments.length,
  };

  const listRef = useRef<HTMLDivElement | null>(null);
  const [overflow, setOverflow] = useState<'none' | 'start' | 'mid' | 'end'>('none');

  const measure = (): void => {
    const el = listRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max < 8) {
      setOverflow('none');
      return;
    }
    const x = Math.abs(el.scrollLeft);
    setOverflow(x < 16 ? 'start' : x > max - 16 ? 'end' : 'mid');
  };

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const nudge = (dir: 1 | -1): void => {
    // RTL: scrollBy handles the sign; 0.7 viewport per press.
    listRef.current?.scrollBy({ left: dir * -listRef.current.clientWidth * 0.7, behavior: 'smooth' });
  };

  const hrefFor = (route: string): string =>
    route === '' ? (storyHref ?? base) : `${base}/${route}`;

  const isActive = (route: string): boolean => {
    if (route === '') {
      return pathname === base || (storyHref !== undefined && pathname === storyHref);
    }
    if (route === 'updates') {
      // The update permalink /updates/[updateId] is a child of the same tab.
      return pathname.startsWith(`${base}/updates`);
    }
    return pathname === `${base}/${route}`;
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const links = Array.from(
      listRef.current?.querySelectorAll<HTMLAnchorElement>('a[data-tab]') ?? [],
    );
    const at = links.findIndex((l) => l === document.activeElement);
    if (at === -1) return;
    e.preventDefault();
    // RTL: ArrowLeft = forward in reading order? No — visual: left arrow moves
    // visually left = NEXT tab in RTL document order.
    let next = at;
    if (e.key === 'ArrowLeft') next = Math.min(at + 1, links.length - 1);
    if (e.key === 'ArrowRight') next = Math.max(at - 1, 0);
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = links.length - 1;
    links[next]?.focus();
    links[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  return (
    <div
      dir="rtl"
      data-testid="campaign-tabbar"
      style={{
        // Sticky below the WathbaShell global header (top:72, z:60).
        position: 'sticky', top: 72, zIndex: 40,
        background: 'var(--bg)',
        borderBottom: '1px solid rgba(var(--ink-rgb),.08)',
        marginTop: 36,
      }}
    >
      <div
        style={{
          maxWidth: 1320, margin: '0 auto', padding: '0 26px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ position: 'relative', minWidth: 0, flex: 1, display: 'flex', alignItems: 'center' }}>
          {overflow !== 'none' && overflow !== 'start' && (
            <button type="button" aria-label="تمرير التبويبات للخلف" onClick={() => nudge(-1)} style={{ ...edgeBtn, insetInlineStart: -10 }}>
              <Icon name="arrow_forward" size={14} color="var(--text)" />
            </button>
          )}
          <nav
            ref={listRef}
            aria-label="أقسام الحملة"
            className="wathba-carousel-track"
            onScroll={measure}
            onKeyDown={onKeyDown}
            style={{ display: 'flex', gap: 18, overflowX: 'auto', scrollbarWidth: 'none', minWidth: 0 }}
          >
            {CAMPAIGN_TABS.map((t) => {
              const activeTab = isActive(t.route);
              const count = t.countKey ? (live?.[t.countKey] ?? fixtureCounts[t.countKey]) : null;
              return (
                <Link
                  key={t.route || 'story'}
                  href={hrefFor(t.route)}
                  data-tab={t.route || 'story'}
                  aria-current={activeTab ? 'page' : undefined}
                  style={{
                    padding: '16px 4px',
                    borderBottom: `2px solid ${activeTab ? 'var(--accent)' : 'transparent'}`,
                    color: activeTab ? 'var(--accent-ink)' : 'var(--muted)',
                    fontSize: 14.5, fontWeight: 600, textDecoration: 'none',
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Icon name={t.icon} size={17} />
                  {t.label}
                  {count !== null && count !== undefined && (
                    <span data-testid={`tab-badge-${t.route || 'story'}`}>
                      <Num
                        style={{
                          fontSize: 11,
                          background: 'rgba(var(--ink-rgb),.08)',
                          color: 'var(--muted)',
                          padding: '2px 7px', borderRadius: 20,
                        }}
                      >
                        {String(count)}
                      </Num>
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          {overflow !== 'none' && overflow !== 'end' && (
            <button type="button" aria-label="تمرير التبويبات للأمام" onClick={() => nudge(1)} style={{ ...edgeBtn, insetInlineEnd: -10 }}>
              <Icon name="arrow_back" size={14} color="var(--text)" />
            </button>
          )}
          {/* edge fades — pure visual affordance on overflow */}
          {overflow !== 'none' && overflow !== 'start' && <span aria-hidden style={{ ...edgeFade, insetInlineStart: 0, background: 'linear-gradient(to left, transparent, var(--bg))' }} />}
          {overflow !== 'none' && overflow !== 'end' && <span aria-hidden style={{ ...edgeFade, insetInlineEnd: 0, background: 'linear-gradient(to right, transparent, var(--bg))' }} />}
        </div>

        {/* Persistent CTA pair — visible on every tab (the e2e asserts it). */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Link
            href={`${base}/back`}
            data-testid="tabbar-pledge"
            style={{
              background: 'var(--grad)', color: 'var(--on-accent)',
              fontWeight: 700, fontSize: 12.5, padding: '8px 14px',
              borderRadius: 11, textDecoration: 'none',
            }}
          >
            ادعم المشروع
          </Link>
          <button
            type="button"
            style={{
              background: 'transparent',
              border: '1px solid rgba(var(--ink-rgb),.16)',
              color: 'var(--text)', fontFamily: 'inherit',
              fontWeight: 600, fontSize: 12.5, padding: '8px 12px',
              borderRadius: 11, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            <Icon name="notifications" size={14} /> ذكّرني
          </button>
        </div>
      </div>
    </div>
  );
}

const edgeBtn: React.CSSProperties = {
  position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 3,
  width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
  background: 'var(--card)', border: '1px solid rgba(var(--ink-rgb),.14)',
  boxShadow: '0 6px 18px -8px rgba(0,0,0,.35)', display: 'grid', placeItems: 'center',
};

const edgeFade: React.CSSProperties = {
  position: 'absolute', top: 0, bottom: 0, width: 34, pointerEvents: 'none', zIndex: 2,
};
