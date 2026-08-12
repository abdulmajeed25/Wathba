/**
 * Batch ACCOUNT / U4 — ONE source for the account navigation.
 *
 * There were two hand-maintained arrays: the desktop panel
 * (wathba-account-menu.tsx) and the mobile hamburger sheet
 * (wathba-header.tsx). They had ALREADY drifted — the sheet was missing the
 * admin row and pointed «المشاريع المحفوظة» at a discover filter rather than a
 * page — which is what two copies of one menu always do. Both now render from
 * this file, so a destination cannot be changed in one place and not the other.
 *
 * Also the single definition of `isCreator`, which was independently re-derived
 * in FOUR places (the panel, the mobile header, and twice in lib/auth/guard).
 * Four copies of one rule is three opportunities for them to disagree about who
 * gets to see a dashboard.
 */

export interface AccountNavItem {
  href: string;
  /** The label. Same word for the same action everywhere it appears. */
  label: string;
  icon: string;
  /** Rows only an admin sees. */
  adminOnly?: boolean;
}

/**
 * Whether this account is a creator.
 *
 * A role grant OR a project already created — the second half matters because
 * a first-time creator has projects before anyone grants them a role, and
 * without it their own dashboard would be invisible to them.
 */
export function isCreatorAccount(
  user: { roles?: string[] | null; createdProjectsCount?: number | null } | null | undefined,
): boolean {
  if (!user) return false;
  return (user.roles ?? []).includes('CREATOR') || (user.createdProjectsCount ?? 0) > 0;
}

/** The public profile, which is the ONLY identity destination. */
export function publicProfileHref(user: { handle?: string | null; id: string }): string {
  return `/u/${encodeURIComponent(user.handle ?? user.id)}`;
}

/**
 * Column A — what you do as a BACKER, grouped by intent rather than by route.
 *
 * Group 1 is your own activity, group 2 is finding more, group 3 is the
 * account itself. Separation is spacing plus one hairline; there are no boxes
 * and no colour blocks, so the grouping reads without decoration.
 *
 * «الرسائل» is deliberately absent. No messaging system exists in this repo —
 * no model, no endpoint, no route — and a menu row that opens nothing is worse
 * than an absent one.
 */
export const ACCOUNT_GROUPS: readonly (readonly AccountNavItem[])[] = [
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
] as const;

/** The admin row, kept out of the groups so it can lead the column. */
export const ADMIN_ITEM: AccountNavItem = {
  href: '/projects/admin',
  label: 'الإدارة',
  icon: 'shield',
  adminOnly: true,
};

/** Flat list — the mobile sheet renders one column, so it wants them unwrapped. */
export const ACCOUNT_ITEMS_FLAT: readonly AccountNavItem[] = ACCOUNT_GROUPS.flat();

/** Status → the chip a creator recognises. Keys are the REAL ProjectStatus. */
export const PROJECT_STATUS_AR: Readonly<Record<string, string>> = {
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
 * Where a project row leads.
 *
 * A dashboard is for managing a campaign that EXISTS. Before review there is
 * nothing to manage, so a draft goes back to the editor and a submission to its
 * status tracker — never to an empty dashboard shell, which does not read as
 * "not ready yet" but as "your project is live and nobody came".
 *
 * Mirrors the server-side gate; the menu and a pasted URL must not disagree
 * about where a draft belongs.
 */
export function projectRowHref(p: { id: string; status: string }): string {
  if (p.status === 'DRAFT') return `/projects/submit?draft=${encodeURIComponent(p.id)}`;
  if (p.status === 'UNDER_REVIEW') return `/projects/dashboard/requests/${encodeURIComponent(p.id)}`;
  return `/projects/dashboard/${encodeURIComponent(p.id)}`;
}
