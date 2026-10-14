import { ConflictException } from '@nestjs/common';
import type { Pledge } from '@prisma/client';

export interface RefundVerification {
  outcome: 'confirmed' | 'pending' | 'partial';
  providerStatus: string;
  paymentRef: string;
  amountHalalas: string;
  refundedHalalas: string;
}

/** Only allowlisted financial fields leave this boundary; never persist card data. */
export function verifyRefundEvidence(raw: unknown, p: Pick<Pledge, 'paymentRef' | 'amountHalalas' | 'addOnsHalalas'>): RefundVerification {
  const e = raw as Record<string, unknown> | null;
  const total = p.amountHalalas + p.addOnsHalalas;
  const mismatch = () => new ConflictException('بيانات المزود لا تطابق التعهد أو لا تثبت نتيجته؛ بقي المبلغ محجوزًا للمراجعة.');
  if (!e || total <= 0n || e.id !== p.paymentRef || e.currency !== 'SAR' ||
      !Number.isSafeInteger(e.amount) || BigInt(e.amount as number) !== total ||
      !Number.isSafeInteger(e.captured) || BigInt(e.captured as number) !== total ||
      !Number.isSafeInteger(e.refunded) || (e.refunded as number) < 0 || BigInt(e.refunded as number) > total ||
      !['paid', 'captured', 'refunded'].includes(e.status as string)) throw mismatch();
  const refunded = BigInt(e.refunded as number);
  if ((refunded === total && e.status !== 'refunded') || (refunded === 0n && e.status === 'refunded')) throw mismatch();
  return { outcome: refunded === total ? 'confirmed' : refunded > 0n ? 'partial' : 'pending',
    providerStatus: e.status as string, paymentRef: p.paymentRef,
    amountHalalas: total.toString(), refundedHalalas: refunded.toString() };
}
