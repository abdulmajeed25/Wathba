import type { StatusIntent } from '../../_components/badge';

/**
 * OPS Phase 2 — the project-status vocabulary shared by the list, the
 * workspace and the review queue. One place maps each ProjectStatus onto an
 * Arabic label + a badge intent so the three screens pill status identically.
 */

export type ProjectStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'SCHEDULED'
  | 'LIVE'
  | 'PAUSED'
  | 'SUCCESSFUL'
  | 'FAILED'
  | 'FUNDED'
  | 'IN_PRODUCTION'
  | 'DELIVERED'
  | 'REFUNDED';

export const STATUS_LABEL_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  UNDER_REVIEW: 'قيد المراجعة',
  SCHEDULED: 'مجدولة',
  LIVE: 'قيد النشر',
  PAUSED: 'موقوفة',
  SUCCESSFUL: 'ناجحة',
  FAILED: 'فاشلة',
  FUNDED: 'مموَّلة',
  IN_PRODUCTION: 'قيد الإنتاج',
  DELIVERED: 'مُسلَّمة',
  REFUNDED: 'مُستردَّة',
};

export const STATUS_INTENT: Record<string, StatusIntent> = {
  DRAFT: 'muted',
  UNDER_REVIEW: 'warn',
  SCHEDULED: 'info',
  LIVE: 'ok',
  PAUSED: 'warn',
  SUCCESSFUL: 'ok',
  FAILED: 'danger',
  FUNDED: 'ok',
  IN_PRODUCTION: 'info',
  DELIVERED: 'ok',
  REFUNDED: 'danger',
};

export function statusLabel(status: string): string {
  return STATUS_LABEL_AR[status] ?? status;
}

export function statusIntent(status: string): StatusIntent {
  return STATUS_INTENT[status] ?? 'muted';
}

/** The list/detail row shape returned by GET /v1/ops/projects. */
export interface ProjectRow {
  id: string;
  titleAr: string;
  status: string;
  categoryId: string | null;
  categoryNameAr: string | null;
  goalHalalas: string | null;
  raisedHalalas: string | null;
  realizedHalalas: string | null;
  backersCount: number;
  createdBy: string | null;
  createdById: string | null;
  hiddenAt: string | null;
  createdAt: string;
}
