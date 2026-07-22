import type { StatusIntent } from '../_components/badge';

/**
 * OPS-GAPS R1 — appeal status vocabulary. Plain module (no 'use client') so
 * BOTH the server pages and the client table import the label/intent helpers
 * — a server component cannot call a function that lives in a 'use client'
 * file.
 */

export function appealStatusIntent(status: string): StatusIntent {
  switch (status) {
    case 'SUBMITTED':
      return 'warn';
    case 'UNDER_REVIEW':
      return 'info';
    case 'UPHELD':
      return 'danger';
    case 'OVERTURNED':
      return 'ok';
    case 'PARTIALLY_GRANTED':
      return 'ok';
    default:
      return 'muted';
  }
}

const STATUS_LABEL_AR: Record<string, string> = {
  SUBMITTED: 'مُقدَّم',
  UNDER_REVIEW: 'قيد المراجعة',
  UPHELD: 'مُثبَّت (رُفض التظلّم)',
  OVERTURNED: 'مُلغى (قُبل التظلّم)',
  PARTIALLY_GRANTED: 'مقبول جزئياً',
};

export function appealStatusLabel(status: string): string {
  return STATUS_LABEL_AR[status] ?? status;
}
