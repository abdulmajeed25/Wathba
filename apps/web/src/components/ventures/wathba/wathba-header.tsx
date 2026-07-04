'use client';

import Link from 'next/link';

import { Icon, Num } from './wathba-icons';
import type { WathbaTheme } from './wathba-tokens';
import { WathbaNotificationBell } from './wathba-notification-bell';
import { WathbaCategoryNav } from './wathba-category-nav';
import { WathbaDiscoverMenu } from './wathba-discover-menu';

export interface WathbaHeaderProps {
  theme: WathbaTheme;
  onToggleTheme: () => void;
}

export function WathbaHeader({ theme, onToggleTheme }: WathbaHeaderProps) {
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
          <Link href="/projects/how" style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none' }}>
            كيف تعمل
          </Link>
          <Link href="/projects/ranks" style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none' }}>
            رتب الداعمين
          </Link>
          {/* Batch DISC — the power discover page + its three-zone mega-menu. */}
          <WathbaDiscoverMenu />
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

      {/* Batch CAT — live category bar + mega-menu (21 top-level categories). */}
      <WathbaCategoryNav />
    </header>
  );
}
