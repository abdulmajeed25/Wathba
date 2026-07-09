'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Icon, Num } from './wathba-icons';
import type { WathbaTheme } from './wathba-tokens';
import { WathbaNotificationBell } from './wathba-notification-bell';
import { WathbaCategoryNav } from './wathba-category-nav';
import { WathbaHeaderSearch } from './wathba-header-search';
import { WathbaDiscoverMenu } from './wathba-discover-menu';
import { WathbaAccountMenu } from './wathba-account-menu';

export interface WathbaHeaderProps {
  theme: WathbaTheme;
  onToggleTheme: () => void;
}

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: '/projects/discover', label: 'استكشف' },
  { href: '/projects/how', label: 'كيف تعمل' },
  { href: '/projects/ranks', label: 'رتب الداعمين' },
  { href: '/projects/discover-all', label: 'اكتشف' },
];

export function WathbaHeader({ theme, onToggleTheme }: WathbaHeaderProps) {
  // STAKES/S-2/D6 — collapse the nav + search below 880px. Done with CSS media
  // queries (wathba-desk-only / wathba-mob-only in globals.css), NOT a JS hook,
  // so it's correct on the SSR/standalone first paint (a hook's post-hydration
  // flip left the desktop nav in the DOM and kept the horizontal scroll).
  const [sheet, setSheet] = useState(false);
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
          className="wathba-desk-only"
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
          <Link href="/projects/how" style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none' }}>
            كيف تعمل
          </Link>
          <Link href="/projects/ranks" style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none' }}>
            رتب الداعمين
          </Link>
          {/* Batch DISC — the power discover page + its three-zone mega-menu. */}
          <WathbaDiscoverMenu />
        </nav>

        {/* STAKES/L1 — real input + typeahead (was a Link styled as a box). */}
        <WathbaHeaderSearch />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginInlineStart: 'auto' }}>
          <Link href="/projects/search" aria-label="بحث" className="wathba-mob-only" style={iconBtn}>
            <Icon name="search" size={20} color="var(--muted)" />
          </Link>
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
          {NAV_LINKS.map((l) => (
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
