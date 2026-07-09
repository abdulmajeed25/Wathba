'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

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
                isCreator: (d.roles ?? []).includes('CREATOR') || (d.createdProjectsCount ?? 0) > 0,
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
          {NAV_LINKS.slice(0, 3).map((l) => {
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
          {/* Batch DISC — the power discover page + its three-zone mega-menu. */}
          <WathbaDiscoverMenu />
        </nav>

        {/* STAKES/L1 — real input + typeahead (was a Link styled as a box). */}
        <WathbaHeaderSearch />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginInlineStart: 'auto' }}>
          <Link href="/projects/search" aria-label="بحث" className="wathba-mob-only" style={iconBtn}>
            <Icon name="search" size={20} color="var(--muted)" />
          </Link>
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
          {NAV_LINKS.map((l) => {
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
                { href: '/projects/me/profile', label: 'الملف الشخصي' },
                ...(me.isCreator ? [{ href: '/projects/dashboard', label: 'لوحة مشاريعي' }] : []),
                { href: '/projects/me/pledges', label: 'تعهداتي' },
                { href: '/projects/discover-all?only=saved', label: 'المشاريع المحفوظة' },
                { href: '/projects/notifications', label: 'الإشعارات' },
                { href: '/projects/settings', label: 'الإعدادات' },
              ]
            : [
                { href: '/sign-in', label: 'تسجيل الدخول' },
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
