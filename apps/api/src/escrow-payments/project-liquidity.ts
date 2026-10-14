import { ConflictException } from '@nestjs/common';
import { Prisma, type Pledge } from '@prisma/client';

type MoneyReader = Pick<Prisma.TransactionClient, 'project' | 'milestone' | 'payout' | 'pledge'>;

/** Read-only estimate unless the caller holds the Project row lock.
 * Keep failed/unknown payouts reserved: failure alone is not a release policy.
 * Legacy milestone totals and payout totals overlap; use their maximum. */
export async function availableProjectFunds(db: MoneyReader, projectId: string): Promise<bigint> {
  const [project, milestones, payouts, refunds] = await Promise.all([
    db.project.findUniqueOrThrow({ where: { id: projectId }, select: { realizedHalalas: true } }),
    db.milestone.aggregate({ where: { projectId }, _sum: { releasedHalalas: true } }),
    db.payout.aggregate({ where: { projectId }, _sum: { amountHalalas: true } }),
    db.pledge.aggregate({ where: { projectId }, _sum: { refundReservedHalalas: true } }),
  ]);
  const released = milestones._sum.releasedHalalas ?? 0n;
  const payable = payouts._sum.amountHalalas ?? 0n;
  return project.realizedHalalas - (released > payable ? released : payable) - (refunds._sum.refundReservedHalalas ?? 0n);
}

/** Reserve before the external call, not across a long-running DB transaction.
 * No automatic unreserve after a timeout/rejection: evidence must settle it. */
export async function reserveCapturedRefund(tx: Prisma.TransactionClient, p: Pledge): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${p.projectId}::uuid FOR UPDATE`;
  const current = await tx.pledge.findUnique({ where: { id: p.id } });
  if (!current || current.status !== 'CAPTURED' || current.paymentRef !== p.paymentRef ||
      current.amountHalalas !== p.amountHalalas || current.addOnsHalalas !== p.addOnsHalalas || current.refundRequestedAt) {
    throw new ConflictException('refund-already-requested-or-state-changed');
  }
  const amount = p.amountHalalas + p.addOnsHalalas;
  if (amount <= 0n || await availableProjectFunds(tx, p.projectId) < amount) {
    throw new ConflictException('insufficient-unreserved-funds');
  }
  const claim = await tx.pledge.updateMany({
    where: { id: p.id, status: 'CAPTURED', refundRequestedAt: null, refundReservedHalalas: 0n,
      paymentRef: p.paymentRef, amountHalalas: p.amountHalalas, addOnsHalalas: p.addOnsHalalas },
    data: { refundRequestedAt: new Date(), refundReservedHalalas: amount, refundIssue: 'refund-awaiting-confirmation' },
  });
  if (claim.count !== 1) throw new ConflictException('refund-already-requested-or-state-changed');
}
