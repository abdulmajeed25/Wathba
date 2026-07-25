import type { StatusIntent } from '../../_components/badge';

/**
 * OPS-360 Unit 4 — the contest-status vocabulary. Contests are creator-driven
 * (no ops mutations yet), so this is presentation only: one place maps each
 * status onto an Arabic label + badge intent for the list + detail screens.
 * Unknown statuses fall back to a muted pill with the raw value.
 */

export const CONTEST_STATUS_LABEL_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  SCHEDULED: 'مجدولة',
  OPEN: 'مفتوحة',
  RUNNING: 'جارية',
  CLOSED: 'مغلقة',
  JUDGING: 'قيد التحكيم',
  ANNOUNCED: 'أُعلنت النتائج',
  COMPLETED: 'مكتملة',
  CANCELLED: 'ملغاة',
};

export const CONTEST_STATUS_INTENT: Record<string, StatusIntent> = {
  DRAFT: 'muted',
  SCHEDULED: 'info',
  OPEN: 'ok',
  RUNNING: 'ok',
  CLOSED: 'warn',
  JUDGING: 'warn',
  ANNOUNCED: 'ok',
  COMPLETED: 'ok',
  CANCELLED: 'danger',
};

export function contestStatusLabel(status: string): string {
  return CONTEST_STATUS_LABEL_AR[status] ?? status;
}

export function contestStatusIntent(status: string): StatusIntent {
  return CONTEST_STATUS_INTENT[status] ?? 'muted';
}

/**
 * The list/detail row shape returned by GET /v1/ops/contests.
 *
 * CLOSEOUT C5 — `entryCount` was declared here and rendered by the table, but
 * the API has never sent it and cannot: `Contest` has no entries relation, only
 * `winners`. The table read it undefined and called .toLocaleString() on it, so
 * /ops/contests 500ed on every load. Replaced with `targetWinnersCount`, which
 * the read layer does return.
 */
export interface ContestRow {
  id: string;
  projectId: string;
  projectTitleAr: string | null;
  status: string;
  targetWinnersCount: number;
  winnerCount: number;
}
