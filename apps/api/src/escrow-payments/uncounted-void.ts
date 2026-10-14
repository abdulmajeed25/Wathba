import { ConflictException } from '@nestjs/common';
import type { Pledge, Prisma } from '@prisma/client';

export const VOID_PENDING_ISSUES = ['void-awaiting-confirmation', 'void-outcome-unknown', 'void-not-confirmed'];
export interface VoidVerification {
  outcome: 'confirmed' | 'pending';
  providerStatus: string;
  paymentRef: string;
  amountHalalas: string;
}

export function verifyVoidEvidence(raw: unknown, p: Pick<Pledge, 'paymentRef' | 'amountHalalas' | 'addOnsHalalas'>): VoidVerification {
  const e = raw as Record<string, unknown> | null;
  const amount = p.amountHalalas + p.addOnsHalalas;
  if (!e || amount <= 0n || e.id !== p.paymentRef || e.currency !== 'SAR' ||
    !Number.isSafeInteger(e.amount) || BigInt(e.amount as number) !== amount ||
    e.captured !== 0 || e.refunded !== 0 || !['voided', 'authorized'].includes(e.status as string)) {
    throw new ConflictException('لا تثبت بيانات المزود فك هذا الحجز؛ بقي التعهد غير محتسب وللمراجعة.');
  }
  // An issuer-expired hold can remain "authorized" at the PSP. Never infer
  // release from age or this label, and never automatically submit again.
  return { outcome: e.status === 'voided' ? 'confirmed' : 'pending', providerStatus: e.status as string,
    paymentRef: p.paymentRef, amountHalalas: amount.toString() };
}

export async function claimUncountedVoid(tx: Prisma.TransactionClient, p: Pledge, expectedIssue: null | 'authorization-terms-changed' = null): Promise<boolean> {
  if (p.status !== 'PENDING_AUTH' || p.capturedAt || p.amountHalalas + p.addOnsHalalas <= 0n) return false;
  await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${p.projectId}::uuid FOR UPDATE`;
  const claim = await tx.pledge.updateMany({ where: { id: p.id, projectId: p.projectId,
    status: 'PENDING_AUTH', capturedAt: null, paymentRef: p.paymentRef,
    amountHalalas: p.amountHalalas, addOnsHalalas: p.addOnsHalalas, authorizationIssue: expectedIssue },
    data: { authorizationIssue: 'void-awaiting-confirmation' } });
  return claim.count === 1;
}

/** Uncounted authorizations never claimed inventory or credited funding. */
export async function finalizeUncountedVoid(tx: Prisma.TransactionClient, p: Pledge, source: string): Promise<'applied' | 'duplicate' | 'mismatch'> {
  if (p.status !== 'PENDING_AUTH') return 'mismatch';
  await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${p.projectId}::uuid FOR UPDATE`;
  const changed = await tx.pledge.updateMany({ where: { id: p.id, projectId: p.projectId,
    status: 'PENDING_AUTH', capturedAt: null, paymentRef: p.paymentRef,
    amountHalalas: p.amountHalalas, addOnsHalalas: p.addOnsHalalas },
    data: { status: 'REFUNDED', refundedAt: new Date(), authorizationIssue: null } });
  if (changed.count !== 1) {
    const current = await tx.pledge.findUnique({ where: { id: p.id } });
    return current?.status === 'REFUNDED' && current.projectId === p.projectId && !current.capturedAt && current.paymentRef === p.paymentRef &&
      current.amountHalalas === p.amountHalalas && current.addOnsHalalas === p.addOnsHalalas ? 'duplicate' : 'mismatch';
  }
  await tx.ledgerEntry.create({ data: { entryType: 'VOID', pledgeId: p.id, projectId: p.projectId,
    pspRef: p.paymentRef, amountHalalas: p.amountHalalas + p.addOnsHalalas, source } });
  return 'applied';
}
