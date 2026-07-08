'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { signOutAction } from '@/lib/auth/actions';
import { Icon } from './wathba-icons';

/**
 * STAKES/D2 + A13 — the identity control in the global header. Fetches
 * /api/me on mount and renders EITHER the signed-in avatar menu (with logout,
 * reachable from every page) OR the signed-out CTAs. Replaces the old static
 * header that showed "تسجيل الدخول → /projects/dashboard" to everyone.
 *
 * Keyboard: Esc closes + restores focus, Tab is trapped in the open panel,
 * outside-click closes. WCAG 2.2 AA.
 */

interface Me {
  id: string;
  name: string;
  roles: string[];
  createdProjectsCount?: number;
  /** STAKES/S-4 — public-profile identity. */
  handle?: string | null;
  avatarUrl?: string | null;
}

export function WathbaAccountMenu() {
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined = loading
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Me | null) => {
        if (alive) setMe(d ?? null);
      })
      .catch(() => alive && setMe(null));
    return () => {
      alive = false;
    };
  }, []);

  const close = useCallback((restore = false) => {
    setOpen(false);
    if (restore) btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    if (e.key === 'Tab' && open) {
      const f = panelRef.current?.querySelectorAll<HTMLElement>('a,button');
      if (!f || f.length === 0) return;
      const list = Array.from(f);
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  // Loading: reserve space, no flash.
  if (me === undefined) return <div style={{ width: 42, height: 42 }} aria-hidden />;

  // Signed out — the real CTAs (login now points at /sign-in, not the dashboard).
  if (me === null) {
    return (
      <>
        {/* STAKES/S-2 — the text login link hides on mobile (the hamburger sheet
            + the compact start button cover it) so the header fits 360px. */}
        <Link href="/sign-in" className="wathba-desk-only" style={loginLink}>تسجيل الدخول</Link>
        <Link href="/projects/start" style={startBtn}>
          <span className="wathba-desk-only">ابدأ مشروعك</span>
          <span className="wathba-mob-only" style={{ display: 'none' }}>ابدأ</span>
        </Link>
      </>
    );
  }

  const isCreator = me.roles.includes('CREATOR') || (me.createdProjectsCount ?? 0) > 0;
  const initial = (me.name || '؟').trim().charAt(0);
  // STAKES/C10 — the identity control links to the PUBLIC profile.
  const publicProfileHref = `/u/${encodeURIComponent(me.handle ?? me.id)}`;

  const items: Array<{ href: string; label: string; icon: string }> = [
    { href: publicProfileHref, label: 'ملفي العام', icon: 'person' },
    { href: '/projects/me/profile', label: 'الملف الشخصي', icon: 'history' },
    ...(isCreator ? [{ href: '/projects/dashboard', label: 'لوحة مشاريعي', icon: 'query_stats' }] : []),
    { href: '/projects/me/pledges', label: 'تعهداتي', icon: 'volunteer_activism' },
    { href: '/projects/discover-all?only=saved', label: 'المشاريع المحفوظة', icon: 'bookmark' },
    { href: '/projects/settings', label: 'الإعدادات', icon: 'tune' },
  ];

  return (
    <div ref={rootRef} style={{ position: 'relative' }} onKeyDown={onKey}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`حساب ${me.name}`}
        style={{ ...avatarBtn, overflow: 'hidden', padding: 0 }}
      >
        {me.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.avatarUrl} alt="" width={42} height={42} style={{ objectFit: 'cover' }} />
        ) : (
          initial
        )}
      </button>
      {open && (
        <div ref={panelRef} role="menu" aria-label="حسابي" style={panel}>
          <div style={panelHead}>
            <Link
              href={publicProfileHref}
              onClick={() => close()}
              style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', textDecoration: 'none', display: 'block' }}
            >
              {me.name}
            </Link>
            <div style={{ fontSize: 12, color: 'var(--muted2)' }}>
              {me.handle ? `@${me.handle} · ` : ''}
              {me.roles.includes('ADMIN') ? 'مدير' : isCreator ? 'مبدع' : 'داعم'}
            </div>
          </div>
          {me.roles.includes('ADMIN') && (
            <Link href="/projects/admin" role="menuitem" onClick={() => close()} style={row}>
              <Icon name="shield" size={17} color="var(--accent)" /> الإدارة
            </Link>
          )}
          {items.map((it) => (
            <Link key={it.href} href={it.href} role="menuitem" onClick={() => close()} style={row}>
              <Icon name={it.icon} size={17} color="var(--accent)" /> {it.label}
            </Link>
          ))}
          <div style={{ height: 1, background: 'rgba(var(--ink-rgb),.08)', margin: '6px 0' }} />
          <form action={signOutAction}>
            <button type="submit" role="menuitem" style={{ ...row, width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--err,#dc2626)', fontFamily: 'inherit' }}>
              <Icon name="logout" size={17} color="var(--err,#dc2626)" /> تسجيل الخروج
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const loginLink: React.CSSProperties = {
  cursor: 'pointer', fontSize: 14.5, color: 'var(--muted)', fontWeight: 500, textDecoration: 'none',
};
const startBtn: React.CSSProperties = {
  border: 'none', cursor: 'pointer', background: 'var(--grad)', color: 'var(--on-accent)',
  fontWeight: 700, fontSize: 14, padding: '11px 19px', borderRadius: 13, textDecoration: 'none', display: 'inline-block',
};
const avatarBtn: React.CSSProperties = {
  width: 42, height: 42, borderRadius: 13, border: '1px solid rgba(var(--ink-rgb),.12)',
  background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent)', fontWeight: 800, fontSize: 17,
  cursor: 'pointer', display: 'grid', placeItems: 'center', fontFamily: 'inherit',
};
const panel: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 8px)', insetInlineEnd: 0, minWidth: 220, zIndex: 80,
  background: 'var(--card)', border: '1px solid rgba(var(--ink-rgb),.1)', borderRadius: 14,
  boxShadow: '0 30px 60px -24px rgba(0,0,0,.5)', padding: 8,
};
const panelHead: React.CSSProperties = {
  padding: '8px 10px 10px', borderBottom: '1px solid rgba(var(--ink-rgb),.08)', marginBottom: 6,
};
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10,
  textDecoration: 'none', color: 'var(--text-soft)', fontSize: 14, fontWeight: 500, textAlign: 'start',
};
