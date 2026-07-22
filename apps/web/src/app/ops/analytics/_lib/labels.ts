/**
 * OPS-360 Phase B Unit 5 — analytics label + helper maps.
 *
 * A PLAIN module (no 'use client', no server-only): both the server page and the
 * client-side category table import from here. It carries NO React and NO
 * side effects — only pure data maps and pure functions — so it is safe to pull
 * into either environment. (A server component may not call a function that
 * lives in a 'use client' module; keeping the shared helpers here avoids that.)
 */

/** ar-SA integer. */
export const arInt = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : n.toLocaleString('ar-SA');

/** A already-computed percentage number (e.g. 42.5) → ar-SA "42.5%". null → honest dash. */
export function fmtPct(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return '—';
  return `${pct.toLocaleString('ar-SA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}٪`;
}

export type Intent = 'ok' | 'warn' | 'danger' | 'default';

/**
 * Color a percentage by direction. `higher` = bigger is healthier (success,
 * conversion, retention); `lower` = bigger is worse (failure/refund/dispute).
 * Returns 'default' for null so we never imply a judgement on missing data.
 */
export function pctIntent(
  pct: number | null | undefined,
  direction: 'higher' | 'lower',
): Intent {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return 'default';
  if (direction === 'higher') {
    if (pct >= 75) return 'ok';
    if (pct >= 50) return 'warn';
    return 'danger';
  }
  // lower-is-better
  if (pct <= 5) return 'ok';
  if (pct <= 15) return 'warn';
  return 'danger';
}

/** Tailwind text color for an intent (used alongside — never instead of — the number). */
export function intentText(intent: Intent): string {
  return intent === 'ok'
    ? 'text-emerald-300'
    : intent === 'warn'
      ? 'text-amber-300'
      : intent === 'danger'
        ? 'text-red-300'
        : 'text-[#e6edf3]';
}

/** Tailwind bg for a bar fill by intent. */
export function intentFill(intent: Intent): string {
  return intent === 'ok'
    ? 'bg-emerald-500/70'
    : intent === 'warn'
      ? 'bg-amber-500/70'
      : intent === 'danger'
        ? 'bg-red-500/70'
        : 'bg-sky-500/60';
}

/** Pull the first present numeric `*Pct` from a loosely-typed rate object. null when absent. */
export function pickPct(
  obj: Record<string, unknown> | null | undefined,
  keys: string[],
): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  return null;
}

/** Pull a plain integer field defensively. */
export function pickInt(
  obj: Record<string, unknown> | null | undefined,
  keys: string[],
): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  return null;
}

/** Project lifecycle status → Arabic label (unknown keys pass through verbatim). */
export const PROJECT_STATUS_AR: Record<string, string> = {
  DRAFT: 'مسودّة',
  PENDING_REVIEW: 'بانتظار المراجعة',
  UNDER_REVIEW: 'قيد المراجعة',
  CHANGES_REQUESTED: 'طُلبت تعديلات',
  APPROVED: 'معتمد',
  LIVE: 'حيّ',
  SUCCESSFUL: 'ناجح',
  SUCCEEDED: 'ناجح',
  WON: 'مكتمل بنجاح',
  FAILED: 'أخفق',
  LOST: 'أخفق',
  CANCELLED: 'ملغى',
  CANCELED: 'ملغى',
  REJECTED: 'مرفوض',
  SUSPENDED: 'موقوف',
  CONCLUDED: 'منتهٍ',
};

/** Reputation tier → Arabic label. */
export const REP_TIER_AR: Record<string, string> = {
  NEW: 'جديد',
  NEWCOMER: 'جديد',
  BRONZE: 'برونزي',
  SILVER: 'فضّي',
  GOLD: 'ذهبي',
  PLATINUM: 'بلاتيني',
  DIAMOND: 'ماسي',
  TRUSTED: 'موثوق',
  VETERAN: 'مخضرم',
};

/** Support ticket status → Arabic label. */
export const TICKET_STATUS_AR: Record<string, string> = {
  OPEN: 'مفتوحة',
  PENDING: 'معلّقة',
  IN_PROGRESS: 'قيد المعالجة',
  WAITING: 'بانتظار العميل',
  ON_HOLD: 'مُعلّقة',
  RESOLVED: 'محلولة',
  CLOSED: 'مغلقة',
};

export const labelOf = (map: Record<string, string>, key: string): string => map[key] ?? key;

/** Map a project status onto a StatusBadge intent for the distribution bars. */
export function statusIntent(status: string): Intent {
  const s = status.toUpperCase();
  if (['LIVE', 'SUCCESSFUL', 'SUCCEEDED', 'WON', 'APPROVED', 'CONCLUDED'].includes(s)) return 'ok';
  if (['PENDING_REVIEW', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'DRAFT', 'SUSPENDED'].includes(s))
    return 'warn';
  if (['FAILED', 'LOST', 'REJECTED', 'CANCELLED', 'CANCELED'].includes(s)) return 'danger';
  return 'default';
}

/** The per-category row the projects endpoint returns, plus an id for DataTable. */
export interface CategoryRow {
  id: string;
  categoryId: string;
  nameAr: string;
  projectCount: number;
  raisedHalalas: string;
}
