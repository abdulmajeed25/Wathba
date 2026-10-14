import { ConflictException } from '@nestjs/common';
import type { Pledge } from '@prisma/client';

export const INITIAL_AUTHORIZATION_ISSUES = [null, 'authorization-outcome-unknown', 'authorization-challenge', 'finalization-outcome-unknown', 'authorization-terms-changed'];
export function canRecoverAuthorization(p: Pick<Pledge, 'status' | 'paymentMethod' | 'authorizationContext' | 'authorizationIssue'>): boolean {
  return p.status === 'PENDING_AUTH' && p.paymentMethod === 'CARD' && !!p.authorizationContext && INITIAL_AUTHORIZATION_ISSUES.includes(p.authorizationIssue);
}

export type AuthorizationEvidence = { outcome: 'authorized' | 'uncharged' | 'challenge'; transactionUrl?: string };
export function safeChallengeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'api.moyasar.com' || url.port || url.username || url.password ||
        !url.pathname.startsWith('/v1/transaction_auths/') || url.hash) return undefined;
    return url.href;
  } catch { return undefined; }
}

/** Initial authorization is never inferred from a transport label or browser URL. */
export function verifyAuthorizationEvidence(raw: unknown, p: Pick<Pledge, 'paymentRef' | 'amountHalalas' | 'addOnsHalalas'>): AuthorizationEvidence {
  const e = raw as Record<string, unknown> | null;
  const total = p.amountHalalas + p.addOnsHalalas;
  if (!e || total <= 0n || e.id !== p.paymentRef || e.currency !== 'SAR' || !Number.isSafeInteger(e.amount) ||
      BigInt(e.amount as number) !== total || e.captured !== 0 || e.refunded !== 0)
    throw new ConflictException('لم تثبت بيانات المزود حجز المبلغ المطلوب؛ يلزم التحقق.');
  if (e.status === 'authorized') return { outcome: 'authorized' };
  if (e.status === 'failed' || e.status === 'voided') return { outcome: 'uncharged' };
  if (e.status === 'initiated') return { outcome: 'challenge', transactionUrl: safeChallengeUrl((e.source as Record<string, unknown> | null)?.transaction_url) };
  throw new ConflictException('نتيجة الدفع تحتاج مراجعة؛ لا تُحتسب كتفويض جديد.');
}
