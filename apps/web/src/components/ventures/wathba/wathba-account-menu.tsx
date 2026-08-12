'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { signOutAction } from '@/lib/auth/actions';
import { Icon } from './wathba-icons';
import {
  ACCOUNT_GROUPS,
  ADMIN_ITEM,
  PROJECT_STATUS_AR,
  isCreatorAccount,
  projectRowHref,
  publicProfileHref,
} from './wathba-account-nav';

/**
 * The identity control in the global header — rebuilt by Batch ACCOUNT / U4.
 *
 * WHAT IT WAS. A flat list of six links in which «ملفي العام» and «الملف
 * الشخصي» sat adjacent, both read as "profile", and went to different pages —
 * while a creator's projects hid behind one row that said nothing about how
 * many existed or what state they were in. Measured at every width from 1440
 * to 360 it was the SAME 220x329 absolute dropdown: a phone was served the
 * desktop control unchanged.
 *
 * WHAT IT IS. Two columns in one panel — backer activity on the leading side,
 * owned projects on the other — and a bottom sheet below md. The dashboard is
 * reached by naming a campaign, not by guessing which one a generic row opens.
 *
 * WHY THE STYLES ARE CLASSES AND NOT A STYLE OBJECT. The previous version held
 * 21 `React.CSSProperties` objects and had ZERO focus styles, because an inline
 * style cannot express :hover, :focus-visible or :disabled at all. The missing
 * focus ring was not an oversight to patch — it was unreachable until the
 * styles moved out. The rules live beside the other panel CSS in
 * wathba-shell.tsx.
 *
 * ACCESSIBILITY. role="menu" is a PROMISE of the APG interaction model. The
 * previous version declared it while implementing only a Tab trap, so assistive
 * tech announced arrow-key navigation that did not exist — a WCAG 2.2 4.1.2
 * failure, not a nicety. Arrow/Home/End are implemented below, Esc restores
 * focus to the trigger, and outside-click closes.
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

export function WathbaAccountMenu() {
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined = loading
  const [projects, setProjects] = useState<ProjectsPayload | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [isSheet, setIsSheet] = useState(false);
  const [sheetHost, setSheetHost] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Me | null) => alive && setMe(d ?? null))
      .catch(() => alive && setMe(null));
    return () => { alive = false; };
  }, []);

  /**
   * Below md the panel becomes a sheet, and a sheet cannot live where this
   * component sits: the header is a framer-motion element, and a TRANSFORMED
   * ancestor becomes the containing block for `position: fixed`. Measured
   * before this fix, `inset-block-end: 0` anchored to the header instead of
   * the viewport and the sheet rendered at y = -425 on a 390x664 screen —
   * off the top, with only its last two rows visible.
   *
   * Read in an effect, never during render: matchMedia does not exist on the
   * server and a server/client disagreement here is a hydration error.
   */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = (): void => setIsSheet(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    // The portal target is the PILLAR ROOT, not <body>.
    //
    // Every rule for this panel is scoped `[data-pillar="ventures"] .wathba-…`,
    // so portalling to <body> moved the sheet OUTSIDE its own stylesheet: it
    // rendered completely unstyled, flowed to the end of the document at
    // y=15587 on a 390x664 screen, and measured 1.26:1 contrast because it had
    // no surface at all. Escaping the header's transform does not require
    // leaving the design system.
    setSheetHost(document.querySelector<HTMLElement>('[data-pillar="ventures"]'));
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Fetched only once the panel is first opened — a signed-in reader who never
  // opens the menu should not pay for a second request. The skeleton reserves
  // the height so the panel does not jump when the answer lands.
  useEffect(() => {
    if (!open || projects !== undefined) return;
    let alive = true;
    const fallback: ProjectsPayload = { items: null, canCreate: false, blockedReasonAr: null };
    fetch('/api/me/projects')
      .then((r) => (r.ok ? r.json() : fallback))
      .then((d: ProjectsPayload) => alive && setProjects(d))
      .catch(() => alive && setProjects(fallback));
    return () => { alive = false; };
  }, [open, projects]);

  const close = useCallback((restore = false) => {
    setOpen(false);
    if (restore) btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      // panelRef is checked SEPARATELY from rootRef: as a sheet the panel is
      // portalled to the pillar root, so it is no longer a descendant of THIS
      // component and a tap inside it would read as "outside" and close the
      // sheet on every touch.
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !panelRef.current?.contains(t)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    if (!open) return;
    // Queried live rather than held in state: the projects column arrives after
    // the panel opens, so a snapshot taken at open time would be wrong.
    const list = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>('a,button:not([disabled])') ?? [],
    );
    if (list.length === 0) return;
    const at = list.indexOf(document.activeElement as HTMLElement);
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
  // two CTAs, so the slot grew 94px → 258px when /api/me answered, the nav
  // wrapped, and every page shifted ~0.11 CLS. It only reproduced at ≤1280px,
  // which is why measuring at 1366 called the page clean.
  if (me === undefined) return <div className="wathba-account-slot" aria-hidden />;

  if (me === null) {
    return (
      <div className="wathba-account-slot">
        {/* STAKES/S-2 — the text login hides on mobile so the header fits 360px. */}
        <Link href="/sign-in" className="wathba-desk-only wathba-acct-login">تسجيل الدخول</Link>
        <Link href="/projects/start" className="wathba-acct-start">
          <span className="wathba-desk-only">ابدأ مشروعك</span>
          <span className="wathba-mob-only" style={{ display: 'none' }}>ابدأ</span>
        </Link>
      </div>
    );
  }

  const isCreator = isCreatorAccount(me);
  const initial = (me.name || '؟').trim().charAt(0);
  const profileHref = publicProfileHref(me);
  const list = projects?.items ?? null;

  const panel = (
    <div
      ref={panelRef}
      role="menu"
      aria-label="حسابي"
      className="wathba-account-panel"
      onKeyDown={onKey}
    >
      {/* Identity. The whole row IS the link to the public profile — which is
          what «ملفي العام» used to spend a separate menu row on. */}
      <Link href={profileHref} role="menuitem" onClick={() => close()} className="wathba-acct-identity">
        <span className="wathba-acct-avatar" aria-hidden>
          {me.avatarUrl
            ? <Image src={me.avatarUrl} alt="" width={40} height={40} />
            : initial}
        </span>
        <span className="wathba-acct-identity-text">
          <strong>{me.name}</strong>
          <em>
            {me.handle ? `@${me.handle} · ` : ''}
            {me.roles.includes('ADMIN') ? 'مدير' : isCreator ? 'مبدع' : 'داعم'}
          </em>
        </span>
      </Link>

      <div className="wathba-account-cols">
        {/* ── Column A — account ── */}
        <div className="wathba-acct-col-a">
          {me.roles.includes('ADMIN') && (
            <>
              <Link href={ADMIN_ITEM.href} role="menuitem" onClick={() => close()} className="wathba-acct-row">
                <Icon name={ADMIN_ITEM.icon} size={20} color="var(--accent)" />
                {ADMIN_ITEM.label}
              </Link>
              <hr className="wathba-acct-divider" />
            </>
          )}
          {ACCOUNT_GROUPS.map((group, gi) => (
            <div key={gi}>
              {group.map((it) => (
                <Link key={it.href} href={it.href} role="menuitem" onClick={() => close()} className="wathba-acct-row">
                  <Icon name={it.icon} size={20} color="var(--accent)" />
                  {it.label}
                </Link>
              ))}
              {gi < ACCOUNT_GROUPS.length - 1 && <hr className="wathba-acct-divider" />}
            </div>
          ))}
        </div>

        {/* ── Column B — my projects ── */}
        <div className="wathba-acct-col-b">
          <p className="wathba-acct-section">
            مشاريعي
            {list && <span className="wathba-acct-chip">{list.length}</span>}
          </p>

          {projects === undefined && (
            <div aria-hidden>
              <span className="wathba-acct-skeleton" />
              <span className="wathba-acct-skeleton" />
            </div>
          )}

          {list && list.length > 0 && list.slice(0, 4).map((p) => (
            <Link key={p.id} href={projectRowHref(p)} role="menuitem" onClick={() => close()} className="wathba-acct-project">
              <span className="wathba-acct-thumb" aria-hidden>
                {p.mediaUrls?.[0]
                  ? <Image src={p.mediaUrls[0]} alt="" width={48} height={48} />
                  : <Icon name="query_stats" size={18} color="var(--accent)" />}
              </span>
              <span className="wathba-acct-project-text">
                <strong>{p.titleAr}</strong>
                <em>{PROJECT_STATUS_AR[p.status] ?? p.status}</em>
              </span>
            </Link>
          ))}

          {/* An empty state is an invitation to act, not a shrug. */}
          {list && list.length === 0 && (
            <p className="wathba-acct-empty">ابدأ مشروعك الأول — اعرض فكرتك على من يبحث عنها.</p>
          )}

          {projects && (projects.canCreate ? (
            <Link href="/projects/start" role="menuitem" onClick={() => close()} className="wathba-acct-create">
              + أنشئ مشروعًا
            </Link>
          ) : (
            /* Disabled WITH the reason inline. A create button that refuses
               silently sends the creator to support to find out why. */
            <span className="wathba-acct-create is-off" aria-disabled="true">
              + أنشئ مشروعًا
              {projects.blockedReasonAr && <em>{projects.blockedReasonAr}</em>}
            </span>
          ))}
        </div>
      </div>

      <hr className="wathba-acct-divider" />
      <form action={signOutAction}>
        <button type="submit" role="menuitem" className="wathba-acct-row is-destructive">
          <Icon name="logout" size={20} color="var(--err,#dc2626)" /> تسجيل الخروج
        </button>
      </form>
    </div>
  );

  return (
    <div ref={rootRef} className="wathba-account-slot wathba-acct-root" onKeyDown={onKey}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`حساب ${me.name}`}
        className="wathba-acct-trigger"
      >
        {me.avatarUrl
          ? <Image src={me.avatarUrl} alt="" width={42} height={42} />
          : initial}
      </button>
      {open && (isSheet && sheetHost ? createPortal(panel, sheetHost) : panel)}
    </div>
  );
}
