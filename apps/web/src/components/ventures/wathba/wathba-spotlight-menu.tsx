'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Icon } from './wathba-icons';

/**
 * Batch POLISH Unit 1 — «تحت الأضواء», the curated nav entry.
 *
 * Replaces the old «اكتشف» mega-menu, which had two problems this component
 * exists to fix:
 *
 *  1. THE LABEL WAS DUPLICATED. Two nav items both read «اكتشف». This one is
 *     now «تحت الأضواء» and leads to /spotlight; plain discovery keeps the
 *     compass link next to the search bar.
 *
 *  2. THE PANEL VANISHED ON APPROACH. It opened on hover and closed on a 120ms
 *     mouseleave timer, while sitting in a separate absolutely-positioned box
 *     below the trigger — so moving the pointer toward the panel crossed dead
 *     space and dismissed it. Hover-open is REMOVED, not retuned: the trigger
 *     is a button that opens on click/Enter/Space and stays open until you
 *     choose something, click away, or press Esc. That is also the only model
 *     that works on touch, where there is no hover at all.
 *
 * Every item deep-links into a /spotlight section, so the menu is a shortcut
 * into the page rather than a second, competing surface.
 */

interface Coll {
  slug: string;
  nameAr: string;
  descriptionAr: string;
  showInMenu: boolean;
}

/** The page's own sections — the menu mirrors them, it does not invent any. */
const SECTIONS: Array<{ ar: string; hash: string; icon: string }> = [
  { ar: 'الأكبر والأنجح', hash: '#biggest', icon: 'trending_up' },
  { ar: 'مختارات وثبة', hash: '#staff-picks', icon: 'diamond' },
  { ar: 'إبداعات مميزة', hash: '#inventive', icon: 'lightbulb' },
  { ar: 'أصحاب الهمم', hash: '#inclusion', icon: 'volunteer_activism' },
  { ar: 'قصص ملهمة', hash: '#stories', icon: 'auto_stories' },
];

export function WathbaSpotlightMenu({ active = false }: { active?: boolean }) {
  const [open, setOpen] = useState(false);
  const [colls, setColls] = useState<Coll[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Collections are a nice-to-have rail; the menu is fully usable without them,
  // so this never blocks or shifts the trigger.
  useEffect(() => {
    if (!open || colls.length > 0) return;
    let alive = true;
    fetch('/api/collections')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Coll[] | null) => {
        if (alive && Array.isArray(d)) setColls(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, colls.length]);

  const close = useCallback((restore = false) => {
    setOpen(false);
    if (restore) triggerRef.current?.focus();
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
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key === 'Tab' && open) {
      const f = panelRef.current?.querySelectorAll<HTMLElement>('a,button');
      if (!f || f.length === 0) return;
      const list = Array.from(f);
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const menuColls = colls.filter((c) => c.showInMenu);

  return (
    <div ref={rootRef} style={{ position: 'static', display: 'inline-flex' }} onKeyDown={onKey}>
      <button
        ref={triggerRef}
        type="button"
        // A menu trigger is a button, not a link: it opens a menu rather than
        // navigating, and aria-haspopup on an <a> that also navigates is the
        // ambiguity screen-reader users get punished by.
        aria-haspopup="menu"
        aria-expanded={open}
        aria-current={active ? 'page' : undefined}
        onClick={() => setOpen((v) => !v)}
        style={{
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          font: 'inherit',
          padding: 0,
          paddingBottom: 2,
          color: active || open ? 'var(--accent-ink)' : 'inherit',
          fontWeight: active || open ? 700 : 500,
          borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Icon name="diamond" size={17} color={active || open ? 'var(--accent)' : 'currentColor'} />
        تحت الأضواء
        <Icon
          name="expand_more"
          size={16}
          color="currentColor"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="تحت الأضواء"
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
              maxWidth: 1080,
              background: 'var(--card)',
              border: '1px solid rgba(var(--ink-rgb),.1)',
              borderTop: 'none',
              borderRadius: '0 0 22px 22px',
              boxShadow: '0 40px 80px -30px rgba(0,0,0,.55)',
              overflow: 'hidden',
              display: 'grid',
              gridTemplateColumns: menuColls.length > 0 ? '1.2fr 1fr' : '1fr',
            }}
          >
            <Zone title="أقسام الصفحة">
              {SECTIONS.map((s) => (
                <MenuLink
                  key={s.hash}
                  href={`/spotlight${s.hash}`}
                  onClose={close}
                  icon={s.icon}
                  label={s.ar}
                />
              ))}
              <MenuLink
                href="/spotlight"
                onClose={close}
                icon="diamond"
                label="اذهب إلى تحت الأضواء"
                accent
              />
            </Zone>

            {menuColls.length > 0 && (
              <Zone title="حملات وثبة" bordered muted>
                {menuColls.map((c) => (
                  <MenuLink
                    key={c.slug}
                    href={`/projects/discover-all?collection=${c.slug}`}
                    onClose={close}
                    icon="campaign"
                    label={c.nameAr}
                  />
                ))}
                <MenuLink
                  href="/projects/campaigns"
                  onClose={close}
                  icon="add_circle"
                  label="انضم إلى حملة"
                  accent
                />
              </Zone>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Zone({
  title,
  children,
  bordered,
  muted,
}: {
  title: string;
  children: React.ReactNode;
  bordered?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        padding: '22px 24px',
        ...(bordered ? { borderInlineStart: '1px solid rgba(var(--ink-rgb),.07)' } : {}),
        ...(muted ? { background: 'rgba(var(--ink-rgb),.02)' } : {}),
      }}
    >
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: 'var(--muted2)',
          letterSpacing: '.5px',
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
    </div>
  );
}

function MenuLink({
  href,
  label,
  icon,
  onClose,
  accent,
}: {
  href: string;
  label: string;
  icon: string;
  onClose: () => void;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={() => onClose()}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 10px',
        borderRadius: 10,
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: accent ? 700 : 500,
        color: accent ? 'var(--accent-ink)' : 'var(--text-soft)',
      }}
    >
      <Icon name={icon} size={18} color="var(--accent)" />
      {label}
    </Link>
  );
}
