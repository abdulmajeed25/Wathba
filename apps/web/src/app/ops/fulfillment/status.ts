import type { StatusIntent } from '../_components/badge';

/**
 * OPS-360 Unit 4 — reward-fulfillment status vocabulary. Plain module (no
 * 'use client') so BOTH the server page and the client table can import the
 * label/intent maps and the helper — a server component cannot call a function
 * that lives in a 'use client' file.
 */

export const REWARD_STATUS_LABEL_AR: Record<string, string> = {
  PENDING: 'قيد الانتظار',
  IN_PROGRESS: 'قيد التجهيز',
  SENT: 'أُرسلت',
  SHIPPED: 'شُحنت',
  FULFILLED: 'مُسلَّمة',
  CANCELLED: 'ملغاة',
};

export const REWARD_STATUS_INTENT: Record<string, StatusIntent> = {
  PENDING: 'muted',
  IN_PROGRESS: 'warn',
  SENT: 'info',
  SHIPPED: 'info',
  FULFILLED: 'ok',
  CANCELLED: 'danger',
};

export function rewardStatusLabel(s: string): string {
  return REWARD_STATUS_LABEL_AR[s] ?? s;
}
