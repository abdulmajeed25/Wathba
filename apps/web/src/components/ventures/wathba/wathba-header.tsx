'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Icon, Num } from './wathba-icons';
import type { WathbaTheme } from './wathba-tokens';
import { WathbaNotificationBell } from './wathba-notification-bell';
import { WathbaCategoryNav } from './wathba-category-nav';
import { WathbaHeaderSearch, WathbaMobileSearchButton } from './wathba-header-search';
import { WathbaSpotlightMenu } from './wathba-spotlight-menu';
import { WathbaAccountMenu } from './wathba-account-menu';
import { ACCOUNT_ITEMS_FLAT, isCreatorAccount } from './wathba-account-nav';

export interface WathbaHeaderProps {
  theme: WathbaTheme;
  onToggleTheme: () => void;
}

// Batch POLISH Unit 1 — the nav carried «اكتشف» TWICE: once here as a plain
// link, once as the mega-menu next to the search bar. Now there is exactly one
// of each idea: «تحت الأضواء» (curated, /spotlight — rendered by
// WathbaSpotlightMenu below) and «اكتشف» (browse everything, a plain compass
// link in the mega-menu's old slot).
const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: '/projects/how', label: 'كيف تعمل' },
  { href: '/projects/ranks', label: 'رتب الداعمين' },
];

// The mobile sheet IS the menu, so both discovery entries are plain rows in it —
// no nested dropdown on a surface that is already a list.
//
// Batch CONTENT Part 2 — «المساعدة» is a sheet row and NOT a desktop nav link.
// The desktop nav is not a matter of taste here: the wide tier is capped at
// maxWidth:1320 and already measures 1314, so a sixth item comes straight out
// of the search field beside it. The sheet is a vertical list with room, and
// mobile is where a stuck reader is least able to hunt for the footer.
const SHEET_LINKS: Array<{ href: string; label: string }> = [
  ...NAV_LINKS,
  { href: '/spotlight', label: 'تحت الأضواء' },
  { href: '/projects/discover-all', label: 'اكتشف' },
  { href: '/projects/help', label: 'المساعدة' },
];

export function WathbaHeader({ theme, onToggleTheme }: WathbaHeaderProps) {
  // STAKES/S-2/D6 — the header collapses in two stages: the search field
  // becomes an icon below 1200px, and the nav follows it into this sheet below
  // 1000px. Both are CSS media queries (wathba-wide-only / wathba-desk-only /
  // wathba-mob-only, declared in wathba-shell.tsx with the measurements that
  // set the thresholds), NOT a JS hook, so they are correct on the SSR/
  // standalone first paint — a hook's post-hydration flip left the desktop nav
  // in the DOM and kept the horizontal scroll.
  const [sheet, setSheet] = useState(false);
  // STAKES/S-11 F-14 (D5) — active-page indication in the top nav.
  const pathname = usePathname();
  const isActive = (href: string): boolean =>
    pathname === href || pathname.startsWith(`${href}/`);
  // STAKES/S-11 F-14 (D6) — the mobile sheet carries the account items too,
  // so a phone user isn't forced onto the 42px avatar for everything.
  const [me, setMe] = useState<{ signedIn: boolean; isCreator: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { roles?: string[]; createdProjectsCount?: number } | null) => {
        if (!alive) return;
        setMe(
          d
            ? {
                signedIn: true,
                isCreator: isCreatorAccount(d),
              }
            : { signedIn: false, isCreator: false },
        );
      })
      .catch(() => alive && setMe({ signedIn: false, isCreator: false }));
    return () => {
      alive = false;
    };
  }, []);
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
        className="wathba-header-row"
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
            data-testid="wathba-logo-mark"
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
            <Icon name="rocket_launch" size={26} fill color="var(--logo-mark)" />
          </div>
          {/* 1.3 is the floor for Arabic — 1.05 is a Latin value, sized for caps
              that have nothing above the cap height to protect. It survived the
              first sweep on the argument that the ث dots were not visibly
              clipped here, which was true but is not the standard: the wrapper
              sets the line box for «وثبة», and Arabic gets 1.3 whether or not a
              given string happens to fit. */}
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontWeight: 700, fontSize: 19 }}>وثبة</div>
            <Num
              className="wathba-wordmark-tag"
              style={{ fontSize: 9.5, letterSpacing: '3px', color: 'var(--muted2)' }}
            >
              LEAP FORWARD
            </Num>
          </div>
        </Link>

        <nav
          className="wathba-desk-only"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            fontSize: 14.5,
            color: 'var(--muted)',
            fontWeight: 500,
            // Nav LABELS must never wrap. Without this they break mid-phrase at
            // narrow widths («كيف / تعمل»), which both looks broken and doubles
            // the nav's height — and a height that depends on available width is
            // a layout shift waiting for anything beside it to change size.
            // The search field beside it is the flexible element; the nav is not.
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {NAV_LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  cursor: 'pointer',
                  textDecoration: 'none',
                  color: active ? 'var(--accent-ink)' : 'inherit',
                  fontWeight: active ? 700 : 'inherit',
                  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                  paddingBottom: 2,
                }}
              >
                {l.label}
              </Link>
            );
          })}
          {/* Batch POLISH Unit 1 — curated: opens the /spotlight menu. */}
          <WathbaSpotlightMenu active={isActive('/spotlight')} />

          {/* Batch POLISH Unit 1 — browse everything. A DIRECT link, no menu and
              no hover panel: this is a destination, and the compass says so.
              The chevron is gone because there is nothing left to expand. */}
          <Link
            href="/projects/discover-all"
            aria-current={isActive('/projects/discover-all') ? 'page' : undefined}
            style={{
              cursor: 'pointer',
              color: 'var(--accent-ink)',
              fontWeight: 700,
              textDecoration: 'none',
              paddingInlineStart: 16,
              borderInlineStart: '1px solid rgba(var(--ink-rgb),.12)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              borderBottom: isActive('/projects/discover-all')
                ? '2px solid var(--accent)'
                : '2px solid transparent',
              paddingBottom: 2,
            }}
          >
            <Icon name="explore" size={18} color="var(--accent)" />
            اكتشف
          </Link>
        </nav>

        {/* STAKES/L1 — real input + typeahead (was a Link styled as a box). */}
        <WathbaHeaderSearch />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginInlineStart: 'auto' }}>
          {/* Batch SEARCH Part 2 — mobile: full-screen search sheet (was a
              bare link to the results page). */}
          <WathbaMobileSearchButton style={iconBtn} />
          {/* STAKES/S-11 F-14 (D6) — desk-only: with bell + avatar + hamburger,
              a 6th 42px control overflowed the signed-in header at 360px (the
              anonymous-header overflow audit never saw it). Mobile gets the
              toggle inside the sheet instead. */}
          <button
            onClick={onToggleTheme}
            title="تبديل النمط"
            className="wathba-desk-only"
            style={{
              cursor: 'pointer',
              width: 42,
              height: 42,
              borderRadius: 13,
              background: 'transparent',
              border: '1px solid rgba(var(--ink-rgb),.12)',
              // The mobile hide comes from .wathba-desk-only (!important wins).
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} size={21} color="var(--muted)" />
          </button>
          <WathbaNotificationBell />
          {/* STAKES/D2 — signed-in avatar menu (with logout) or signed-out CTAs. */}
          <WathbaAccountMenu />
          <button
            type="button"
            onClick={() => setSheet((v) => !v)}
            aria-label="القائمة"
            aria-expanded={sheet}
            className="wathba-mob-only"
            style={iconBtn}
          >
            <Icon name={sheet ? 'check' : 'category'} size={22} color="var(--text)" />
          </button>
        </div>
      </div>

      {/* STAKES/D6 — mobile nav sheet (keyboard-dismissable). The hamburger that
          opens it is mobile-only (CSS), so this never shows on desktop. */}
      {sheet && (
        <div
          role="menu"
          aria-label="التنقل"
          className="wathba-mob-sheet"
          onKeyDown={(e) => e.key === 'Escape' && setSheet(false)}
          style={{
            borderTop: '1px solid rgba(var(--ink-rgb),.07)',
            background: 'var(--card)',
            padding: '10px 20px 16px',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {SHEET_LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                role="menuitem"
                aria-current={active ? 'page' : undefined}
                onClick={() => setSheet(false)}
                style={{
                  padding: '12px 8px', borderRadius: 10, textDecoration: 'none', fontSize: 15.5, fontWeight: active ? 700 : 600,
                  color: active ? 'var(--accent-ink)' : 'var(--text-soft)',
                  background: active ? 'rgba(var(--accent-rgb),.08)' : 'transparent',
                }}
              >
                {l.label}
              </Link>
            );
          })}
          {/* Theme toggle lives here on mobile (freed a 42px header slot). */}
          <button
            type="button"
            role="menuitem"
            onClick={() => { onToggleTheme(); setSheet(false); }}
            style={{
              padding: '12px 8px', borderRadius: 10, border: 'none', background: 'transparent',
              color: 'var(--text-soft)', fontSize: 15.5, fontWeight: 600, fontFamily: 'inherit',
              cursor: 'pointer', textAlign: 'start',
            }}
          >
            {theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
          </button>
          {/* STAKES/S-11 F-14 (D6) — account items, signed-in vs signed-out. */}
          <div aria-hidden style={{ height: 1, background: 'rgba(var(--ink-rgb),.08)', margin: '6px 0' }} />
          {(me?.signedIn
            ? [
                /* Batch ACCOUNT / U4 — ONE source. This was a second
                   hand-maintained array and it had ALREADY drifted from the
                   panel: it was missing the admin row and pointed «المشاريع
                   المحفوظة» at a discover FILTER rather than a page, while the
                   panel pointed somewhere else. Both now render from
                   wathba-account-nav, so a destination cannot be changed in one
                   copy and forgotten in the other. */
                ...ACCOUNT_ITEMS_FLAT.map((i) => ({ href: i.href, label: i.label })),
                ...(me.isCreator ? [{ href: '/projects/dashboard', label: 'مشاريعي' }] : []),
                { href: '/projects/notifications', label: 'الإشعارات' },
              ]
            : [
                { href: '/sign-in', label: 'تسجيل الدخول' },
                // Registration is otherwise two clicks deep (sign-in → «أنشئ
                // حساباً جديداً»). It goes HERE and not in the header: the
                // desktop header has no room for a third CTA. The wide tier is
                // capped at maxWidth:1320 and measures 1314 full — 6px spare —
                // so anything added beside «ابدأ مشروعك» comes straight out of
                // the search field.
                { href: '/sign-up', label: 'إنشاء حساب' },
                { href: '/projects/start', label: 'ابدأ مشروعك' },
              ]
          ).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              role="menuitem"
              onClick={() => setSheet(false)}
              style={{ padding: '12px 8px', borderRadius: 10, textDecoration: 'none', color: 'var(--text-soft)', fontSize: 15.5, fontWeight: 600 }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}

      {/* Batch CAT — live category bar + mega-menu (21 top-level categories). */}
      <WathbaCategoryNav />
    </header>
  );
}

const iconBtn: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 13,
  background: 'transparent',
  border: '1px solid rgba(var(--ink-rgb),.12)',
  // display is controlled by .wathba-mob-only (inline-flex on mobile, none on
  // desktop); center the glyph in whichever mode.
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  textDecoration: 'none',
  flexShrink: 0,
};
