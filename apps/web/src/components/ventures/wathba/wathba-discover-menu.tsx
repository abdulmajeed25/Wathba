'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Icon } from './wathba-icons';

/**
 * Batch DISC / Part 4 — the "اكتشف" nav mega-menu (three-zone, Arabic RTL,
 * culturally adapted). Opens on hover + click (pinned-on-click so a click on a
 * link never races the hover-close), Esc closes + restores focus, Tab is
 * trapped inside the open panel. WCAG 2.2 AA.
 *
 *   Zone 1 "تحت الأضواء"  — collections flagged showInMenu → pre-filtered links.
 *   Zone 2 "حملات وثبة"   — active collections + "انضم إلى حملة" explainer link.
 *   Zone 3 "تسليط الضوء"  — ALLOWED spotlights only (Women / Youth / People with
 *                            Disabilities). No ethnic/identity/orientation ones.
 */

interface Coll {
  slug: string;
  nameAr: string;
  descriptionAr: string;
  showInMenu: boolean;
}

// Allowed spotlights → pre-filtered discover-all links. women-creators is a
// collection; youth / disabilities map to social-impact subcategories.
const SPOTLIGHTS: Array<{ ar: string; href: string; icon: string }> = [
  { ar: 'مبدعات سعوديات', href: '/projects/discover-all?collection=women-creators', icon: 'workspace_premium' },
  { ar: 'مشاريع الشباب', href: '/projects/discover-all?cat=youth-development', icon: 'group' },
  { ar: 'أصحاب الهمم', href: '/projects/discover-all?cat=people-with-disabilities', icon: 'volunteer_activism' },
];

export function WathbaDiscoverMenu() {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [colls, setColls] = useState<Coll[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLAnchorElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
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
  }, []);

  const close = useCallback((restore = false) => {
    setOpen(false);
    setPinned(false);
    if (restore) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pinned, close]);

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

  const menuColls = colls.filter((c) => c.showInMenu);

  return (
    <div
      ref={rootRef}
      style={{ position: 'static', display: 'inline-flex' }}
      onMouseEnter={() => { if (timer.current) clearTimeout(timer.current); if (!pinned) setOpen(true); }}
      onMouseLeave={() => { if (pinned) return; timer.current = setTimeout(() => setOpen(false), 120); }}
      onKeyDown={onKey}
    >
      <Link
        ref={triggerRef}
        href="/projects/discover-all"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => {
          // First click opens the menu; second navigates.
          if (!open) { e.preventDefault(); setOpen(true); setPinned(true); }
        }}
        style={{
          cursor: 'pointer',
          color: 'var(--accent)',
          fontWeight: 700,
          textDecoration: 'none',
          paddingInlineStart: 16,
          borderInlineStart: '1px solid rgba(var(--ink-rgb),.12)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
        }}
      >
        اكتشف
        <Icon name="expand_more" size={17} color="var(--accent)" />
      </Link>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="اكتشف"
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
              gridTemplateColumns: '1fr 1fr 1fr',
            }}
          >
            {/* Zone 1 — تحت الأضواء */}
            <Zone title="تحت الأضواء">
              {menuColls.length > 0 ? (
                menuColls.map((c) => (
                  <MenuLink key={c.slug} href={`/projects/discover-all?collection=${c.slug}`} onClose={close} icon="diamond" label={c.nameAr} />
                ))
              ) : (
                <MenuLink href="/projects/discover-all" onClose={close} icon="explore" label="تصفّح كل المشاريع" />
              )}
            </Zone>

            {/* Zone 2 — حملات وثبة */}
            <Zone title="حملات وثبة" bordered>
              {colls.slice(0, 5).map((c) => (
                <MenuLink key={c.slug} href={`/projects/discover-all?collection=${c.slug}`} onClose={close} icon="campaign" label={c.nameAr} />
              ))}
              <MenuLink href="/projects/campaigns" onClose={close} icon="add_circle" label="انضم إلى حملة" accent />
            </Zone>

            {/* Zone 3 — تسليط الضوء (allowed spotlights only) */}
            <Zone title="تسليط الضوء" bordered muted>
              {SPOTLIGHTS.map((s) => (
                <MenuLink key={s.href} href={s.href} onClose={close} icon={s.icon} label={s.ar} />
              ))}
            </Zone>
          </div>
        </div>
      )}
    </div>
  );
}

function Zone({ title, children, bordered, muted }: { title: string; children: React.ReactNode; bordered?: boolean; muted?: boolean }) {
  return (
    <div
      style={{
        padding: '22px 24px',
        ...(bordered ? { borderInlineStart: '1px solid rgba(var(--ink-rgb),.07)' } : {}),
        ...(muted ? { background: 'rgba(var(--ink-rgb),.02)' } : {}),
      }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted2)', letterSpacing: '.5px', marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
    </div>
  );
}

function MenuLink({ href, label, icon, onClose, accent }: { href: string; label: string; icon: string; onClose: () => void; accent?: boolean }) {
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
        color: accent ? 'var(--accent)' : 'var(--text-soft)',
      }}
    >
      <Icon name={icon} size={18} color="var(--accent)" />
      {label}
    </Link>
  );
}
