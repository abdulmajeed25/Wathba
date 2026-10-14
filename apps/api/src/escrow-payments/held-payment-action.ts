import { randomUUID } from 'node:crypto';
import type { Pledge, Prisma } from '@prisma/client';
import { ConflictException } from '@nestjs/common';

export type HeldAction = 'CAPTURE' | 'VOID' | 'REAUTHORIZE' | 'AUTHORIZE';
export function heldAction(issue: string | null | undefined): HeldAction | null {
  const match = /^payment:(CAPTURE|VOID|REAUTHORIZE|AUTHORIZE):[0-9a-f-]{36}$/.exec(issue ?? '');
  return match ? match[1] as HeldAction : null;
}

/** Persistent claim, not a process mutex or an expiring lease. An ambiguous
 * request stays claimed; only financial proof can resolve it. The UUID keeps
 * a late response from clearing a newer attempt. No transaction spans HTTP. */
export async function claimHeldAction(tx: Prisma.TransactionClient, p: Pledge, action: HeldAction): Promise<string | null> {
  const grace = p.status === 'CAPTURE_GRACE';
  if ((!['HELD', 'PENDING_REAUTH'].includes(p.status) && !grace) ||
      (grace && !['CAPTURE', 'AUTHORIZE'].includes(action)) || (!grace && action === 'AUTHORIZE') ||
      (grace && (p.paymentMethod !== 'CARD' || !p.graceExpiresAt || p.graceExpiresAt <= new Date())) ||
      p.capturedAt || p.amountHalalas + p.addOnsHalalas <= 0n) return null;
  await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${p.projectId}::uuid FOR UPDATE`;
  const key = `payment:${action}:${randomUUID()}`;
  const result = await tx.pledge.updateMany({ where: { id: p.id, projectId: p.projectId, status: p.status,
    paymentRef: p.paymentRef, capturedAt: null, amountHalalas: p.amountHalalas, addOnsHalalas: p.addOnsHalalas,
    reauthorizedAt: p.reauthorizedAt ?? null, authorizationIssue: null,
    ...(grace ? { graceExpiresAt: { gt: new Date() } } : {}) }, data: { authorizationIssue: key,
    ...(grace && action === 'CAPTURE' ? { captureAttempts: { increment: 1 } } : {}) } });
  return result.count === 1 ? key : null;
}

export interface HeldVerification { outcome: 'confirmed' | 'pending' | 'uncharged'; action: HeldAction; providerStatus: string; amountHalalas: string; paymentRef: string; }
export function verifyHeldEvidence(raw: unknown, p: Pick<Pledge, 'paymentRef' | 'amountHalalas' | 'addOnsHalalas'>, action: HeldAction): HeldVerification {
  const e = raw as Record<string, unknown> | null;
  const amount = p.amountHalalas + p.addOnsHalalas;
  if (!e || amount <= 0n || e.id !== p.paymentRef || e.currency !== 'SAR' || !Number.isSafeInteger(e.amount) ||
      BigInt(e.amount as number) !== amount || e.refunded !== 0 || !Number.isSafeInteger(e.captured) ||
      !['authorized', 'paid', 'captured', 'voided'].includes(e.status as string)) throw new ConflictException('بيانات المزود لا تثبت نتيجة المحاولة؛ يلزم مطابقة الدفع.');
  const captured = BigInt(e.captured as number);
  const pending = e.status === 'authorized' && captured === 0n;
  const confirmed = (['CAPTURE', 'AUTHORIZE'].includes(action) && ['paid', 'captured'].includes(e.status as string) && captured === amount) ||
    (action === 'VOID' && e.status === 'voided' && captured === 0n);
  // "authorized" has no proof that a previous authorization was renewed.
  if (!pending && !confirmed) throw new ConflictException('نتيجة الدفع لا تطابق العملية المطلوبة؛ يلزم مراجعة الفرق.');
  return { outcome: confirmed ? 'confirmed' : 'pending', action, providerStatus: e.status as string,
    paymentRef: p.paymentRef, amountHalalas: amount.toString() };
}

export function verifyUnchargedPayment(raw: unknown, p: Pick<Pledge, 'paymentRef' | 'amountHalalas' | 'addOnsHalalas'>): boolean {
  const e = raw as Record<string, unknown> | null;
  return !!e && p.amountHalalas + p.addOnsHalalas > 0n && ['failed', 'voided'].includes(e.status as string) && e.id === p.paymentRef && e.currency === 'SAR' &&
    Number.isSafeInteger(e.amount) && BigInt(e.amount as number) === p.amountHalalas + p.addOnsHalalas &&
    e.captured === 0 && e.refunded === 0;
}
