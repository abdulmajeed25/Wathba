'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { signOutAction } from '@/lib/auth/actions';
import { Icon } from './wathba-icons';

/**
 * STAKES/D2 + A13, rebuilt by Batch ACCOUNT — the identity control in the
 * global header.
 *
 * WHAT CHANGED AND WHY. The previous menu was a flat list of six links in
 * which «ملفي العام» and «الملف الشخصي» sat adjacent, pointed at two different
 * pages, and both read as "profile" — while the creator's own projects were
 * reachable only through one ambiguous row («لوحة مشاريعي») that said nothing
 * about how many projects existed or what state they were in.
 *
 * It is now two columns in one panel: what you do as a BACKER on the reading
 * side, what you own as a CREATOR on the other. The projects column lists the
 * projects themselves, so the dashboard is reached by naming a project rather
 * than by guessing which one a generic row will open.
 *
 * ACCESSIBILITY — the audit found this component declaring role="menu" while
 * implementing only a Tab trap. A menu role promises arrow-key navigation; the
 * widget did not provide it, so assistive tech announced an interaction model
 * that did not exist. ArrowUp/ArrowDown/Home/End are implemented below over a
 * live query of the panel's focusables, Esc restores focus to the trigger, and
 * outside-click closes.
 *
 * DEFERRED, deliberately: «الرسائل». There is no messaging system in this
 * repo — no model, no endpoint, no route (docs/audits/ACCOUNT-AUDIT.md §1.5) —
 * and the batch's own instruction is to defer rather than stub. A menu row
 * that opens nothing is worse than an absent one.
 */

interface Me {
  id: string;
  name: string;
  roles: string[];
  createdProjectsCount?: number;
  handle?: string | null;
  avatarUrl?: string | null;
}

interface MyProject {
  id: string;
  slug?: string | null;
  titleAr: string;
  status: string;
  mediaUrls?: string[];
}

interface ProjectsPayload {
  items: MyProject[] | null;
  canCreate: boolean;
  blockedReasonAr: string | null;
}

/** Status → the chip a creator actually recognises. The enum is the real one. */
const STATUS_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  UNDER_REVIEW: 'قيد المراجعة',
  SCHEDULED: 'مجدول',
  LIVE: 'نشط',
  PAUSED: 'متوقف مؤقتاً',
  FUNDED: 'مموّل',
  IN_PRODUCTION: 'قيد التنفيذ',
  SUCCESSFUL: 'مكتمل',
  DELIVERED: 'سُلِّم',
  FAILED: 'مغلق',
  REFUNDED: 'مسترَد',
};

/**
 * Where a project row leads. A dashboard is only meaningful once the project
 * has been reviewed — before that there is nothing to manage, so a draft goes
 * back to the editor and a submission goes to its review status, never to an
 * empty dashboard shell. Mirrors the server-side gate in the dashboard layout.
 */
function projectHref(p: MyProject): string {
  if (p.status === 'DRAFT') return `/projects/submit?draft=${encodeURIComponent(p.id)}`;
  if (p.status === 'UNDER_REVIEW') return `/projects/dashboard/requests/${encodeURIComponent(p.id)}`;
  return `/projects/dashboard/${encodeURIComponent(p.id)}`;
}

export function WathbaAccountMenu() {
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined = loading
  const [projects, setProjects] = useState<ProjectsPayload | undefined>(undefined);
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

  // The projects column is fetched only once the panel is first opened: it is
  // a second request that a signed-in reader who never opens the menu should
  // not pay for. The skeleton below reserves its height so the panel does not
  // jump when the answer lands.
  useEffect(() => {
    if (!open || projects !== undefined) return;
    let alive = true;
    fetch('/api/me/projects')
      .then((r) => (r.ok ? r.json() : { items: null, canCreate: false, blockedReasonAr: null }))
      .then((d: ProjectsPayload) => alive && setProjects(d))
      .catch(() => alive && setProjects({ items: null, canCreate: false, blockedReasonAr: null }));
    return () => {
      alive = false;
    };
  }, [open, projects]);

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

  const focusables = (): HTMLElement[] =>
    Array.from(panelRef.current?.querySelectorAll<HTMLElement>('a,button:not([disabled])') ?? []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    if (!open) return;
    const list = focusables();
    if (list.length === 0) return;
    const at = list.indexOf(document.activeElement as HTMLElement);

    // Arrow keys are what role="menu" promises. Queried live rather than kept
    // in state because the projects column arrives after the panel opens.
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(at + 1) % list.length]!.focus(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); list[at <= 0 ? list.length - 1 : at - 1]!.focus(); return; }
    if (e.key === 'Home') { e.preventDefault(); list[0]!.focus(); return; }
    if (e.key === 'End') { e.preventDefault(); list[list.length - 1]!.focus(); return; }
    if (e.key === 'Tab') {
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  // Loading: reserve the footprint the RESOLVED state will occupy — WIDTH as
  // well as height. This was a 42px square, but the signed-out state resolves to
  // two CTAs, so the slot grew 94px → 258px wide when /api/me answered. That
  // squeezed the nav until the nav itself wrapped (26px → 48px), the header grew
  // and every page shifted ~0.11 CLS. It only reproduced at ≤1280px, which is
  // why measuring at 1366 called the page clean.
  //
  // .wathba-account-slot reserves the same box in all three states, so the swap
  // cannot move anything in either direction.
  if (me === undefined) return <div className="wathba-account-slot" aria-hidden />;

  // Signed out — the real CTAs (login now points at /sign-in, not the dashboard).
  if (me === null) {
    return (
      <div className="wathba-account-slot">
        {/* STAKES/S-2 — the text login link hides on mobile (the hamburger sheet
            + the compact start button cover it) so the header fits 360px. */}
        <Link href="/sign-in" className="wathba-desk-only" style={loginLink}>تسجيل الدخول</Link>
        <Link href="/projects/start" style={startBtn}>
          <span className="wathba-desk-only">ابدأ مشروعك</span>
          <span className="wathba-mob-only" style={{ display: 'none' }}>ابدأ</span>
        </Link>
      </div>
    );
  }

  const isCreator = me.roles.includes('CREATOR') || (me.createdProjectsCount ?? 0) > 0;
  const initial = (me.name || '؟').trim().charAt(0);
  const publicProfileHref = `/u/${encodeURIComponent(me.handle ?? me.id)}`;

  // Column A. Grouped by what the reader is actually doing, not by what the
  // routes happen to be: backer activity, then discovery, then the account
  // itself. `المشاريع المحفوظة` now has a page of its own instead of pointing
  // at a filter on the discover surface.
  const groups: Array<Array<{ href: string; label: string; icon: string }>> = [
    [
      { href: '/projects/me/pledges', label: 'تعهداتي', icon: 'volunteer_activism' },
      { href: '/saved', label: 'المشاريع المحفوظة', icon: 'bookmark' },
      { href: '/following', label: 'متابَعاتي', icon: 'person' },
      { href: '/activity', label: 'النشاط', icon: 'history' },
    ],
    [{ href: '/recommendations', label: 'مقترَح لك', icon: 'query_stats' }],
    [
      { href: '/projects/settings', label: 'الإعدادات', icon: 'tune' },
      { href: '/projects/help', label: 'المساعدة والقواعد', icon: 'shield' },
    ],
  ];

  const list = projects?.items ?? null;
  const count = list?.length ?? 0;

  return (
    <div ref={rootRef} className="wathba-account-slot" style={{ position: 'relative' }} onKeyDown={onKey}>
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
          /* STAKES/M2 — next/image: lazy + fixed dimensions (no CLS). */
          <Image src={me.avatarUrl} alt="" width={42} height={42} style={{ objectFit: 'cover' }} />
        ) : (
          initial
        )}
      </button>
      {open && (
        <div ref={panelRef} role="menu" aria-label="حسابي" className="wathba-account-panel" style={panel}>
          {/* Identity. The whole row is the link to the public profile, which
              is what «ملفي العام» used to spend a menu row on. */}
          <Link href={publicProfileHref} role="menuitem" onClick={() => close()} style={identityRow}>
            <span style={identityAvatar} aria-hidden>
              {me.avatarUrl
                ? <Image src={me.avatarUrl} alt="" width={40} height={40} style={{ objectFit: 'cover', borderRadius: 11 }} />
                : initial}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{me.name}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted2)' }}>
                {me.handle ? `@${me.handle} · ` : ''}
                {me.roles.includes('ADMIN') ? 'مدير' : isCreator ? 'مبدع' : 'داعم'}
              </span>
            </span>
          </Link>

          <div className="wathba-account-cols" style={cols}>
            {/* ── Column A — account (leads in RTL) ── */}
            <div style={{ minWidth: 0 }}>
              {me.roles.includes('ADMIN') && (
                <>
                  <Link href="/projects/admin" role="menuitem" onClick={() => close()} style={row}>
                    <Icon name="shield" size={20} color="var(--accent)" /> الإدارة
                  </Link>
                  <div style={divider} />
                </>
              )}
              {groups.map((g, gi) => (
                <div key={gi}>
                  {g.map((it) => (
                    <Link key={it.href} href={it.href} role="menuitem" onClick={() => close()} style={row}>
                      <Icon name={it.icon} size={20} color="var(--accent)" /> {it.label}
                    </Link>
                  ))}
                  {gi < groups.length - 1 && <div style={divider} />}
                </div>
              ))}
            </div>

            {/* ── Column B — my projects ── */}
            <div style={projectsCol}>
              <div style={sectionLabel}>
                مشاريعي
                {list && <span style={countChip}>{count.toLocaleString('ar-SA')}</span>}
              </div>

              {projects === undefined && (
                /* Skeleton, so the panel does not change height when the second
                   request lands. Two rows is the common case. */
                <div aria-hidden>
                  <div style={skeletonRow} />
                  <div style={skeletonRow} />
                </div>
              )}

              {list && list.length > 0 && (
                <div style={{ display: 'grid', gap: 2 }}>
                  {list.slice(0, 4).map((p) => (
                    <Link key={p.id} href={projectHref(p)} role="menuitem" onClick={() => close()} style={projectRow}>
                      <span style={thumb} aria-hidden>
                        {p.mediaUrls?.[0]
                          ? <Image src={p.mediaUrls[0]} alt="" width={48} height={48} style={{ objectFit: 'cover', borderRadius: 9 }} />
                          : <Icon name="query_stats" size={18} color="var(--accent)" />}
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={projectTitle}>{p.titleAr}</span>
                        <span style={statusChip}>{STATUS_AR[p.status] ?? p.status}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {list && list.length === 0 && (
                /* An empty state is an invitation, not a shrug. */
                <p style={emptyCopy}>ابدأ مشروعك الأول — اعرض فكرتك على من يبحث عنها.</p>
              )}

              {projects && (projects.canCreate ? (
                <Link href="/projects/start" role="menuitem" onClick={() => close()} style={createBtn}>
                  + أنشئ مشروعًا
                </Link>
              ) : (
                /* Disabled WITH the reason inline. A create button that refuses
                   silently sends the creator to support to find out why. */
                <span style={createBtnOff} aria-disabled="true">
                  + أنشئ مشروعًا
                  {projects.blockedReasonAr && <em style={reasonText}>{projects.blockedReasonAr}</em>}
                </span>
              ))}
            </div>
          </div>

          <div style={divider} />
          <form action={signOutAction}>
            <button type="submit" role="menuitem" style={{ ...row, width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--err,#dc2626)', fontFamily: 'inherit' }}>
              <Icon name="logout" size={20} color="var(--err,#dc2626)" /> تسجيل الخروج
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
  background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent-ink)', fontWeight: 800, fontSize: 17,
  cursor: 'pointer', display: 'grid', placeItems: 'center', fontFamily: 'inherit',
};
const panel: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 8px)', insetInlineEnd: 0, width: 620, maxWidth: 'calc(100vw - 24px)', zIndex: 80,
  background: 'var(--card)', border: '1px solid rgba(var(--ink-rgb),.1)', borderRadius: 16,
  boxShadow: '0 30px 60px -24px rgba(0,0,0,.5)', padding: 8,
};
const cols: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 8,
};
const identityRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px', borderRadius: 12,
  textDecoration: 'none', borderBottom: '1px solid rgba(var(--ink-rgb),.08)', marginBottom: 6,
};
const identityAvatar: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center',
  background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent-ink)', fontWeight: 800, fontSize: 16, overflow: 'hidden',
};
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10,
  textDecoration: 'none', color: 'var(--text-soft)', fontSize: 14, fontWeight: 500, textAlign: 'start',
};
const divider: React.CSSProperties = {
  height: 1, background: 'rgba(var(--ink-rgb),.08)', margin: '6px 0',
};
const projectsCol: React.CSSProperties = {
  borderInlineStart: '1px solid rgba(var(--ink-rgb),.08)', paddingInlineStart: 8, minWidth: 0,
};
const sectionLabel: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px 8px',
  fontSize: 12, fontWeight: 700, color: 'var(--muted2)',
};
const countChip: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--accent-ink)', background: 'rgba(var(--accent-rgb),.12)',
  borderRadius: 999, padding: '1px 7px',
};
const projectRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 10, textDecoration: 'none',
};
const thumb: React.CSSProperties = {
  width: 48, height: 48, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center',
  background: 'rgba(var(--accent-rgb),.10)', overflow: 'hidden',
};
const projectTitle: React.CSSProperties = {
  display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text)',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
};
const statusChip: React.CSSProperties = {
  display: 'inline-block', marginTop: 3, fontSize: 11, fontWeight: 600, color: 'var(--muted2)',
  background: 'rgba(var(--ink-rgb),.06)', borderRadius: 999, padding: '1px 8px',
};
const emptyCopy: React.CSSProperties = {
  padding: '2px 10px 10px', fontSize: 12.5, lineHeight: 1.7, color: 'var(--muted2)', margin: 0,
};
const createBtn: React.CSSProperties = {
  display: 'block', marginTop: 8, textAlign: 'center', background: 'var(--grad)', color: 'var(--on-accent)',
  fontWeight: 700, fontSize: 13.5, padding: '10px', borderRadius: 11, textDecoration: 'none',
};
const createBtnOff: React.CSSProperties = {
  display: 'block', marginTop: 8, textAlign: 'center', background: 'rgba(var(--ink-rgb),.06)',
  color: 'var(--muted2)', fontWeight: 700, fontSize: 13.5, padding: '10px', borderRadius: 11, cursor: 'not-allowed',
};
const reasonText: React.CSSProperties = {
  display: 'block', fontStyle: 'normal', fontSize: 11.5, fontWeight: 500, marginTop: 2,
};
const skeletonRow: React.CSSProperties = {
  height: 48, borderRadius: 9, margin: '2px 8px', background: 'rgba(var(--ink-rgb),.06)',
};
