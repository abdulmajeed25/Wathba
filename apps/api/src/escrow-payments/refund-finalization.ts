import { ConflictException } from '@nestjs/common';
import { LedgerEntryType, PledgeStatus, type Pledge, type Prisma } from '@prisma/client';

// These states retain the original funding commitment. PENDING_AUTH has
// never incremented counters; REFUNDED has already released them.
export const COUNTED_PLEDGE_STATUSES: PledgeStatus[] = [
  'HELD', 'PENDING_BNPL', 'PENDING_REAUTH', 'CAPTURED', 'CAPTURE_GRACE',
  'FAILED_CAPTURE', 'DISPUTED', 'FAILED',
];

/** Apply a confirmed FULL refund/void, never initiate a provider request.
 * Project-first locking also serializes last-backer accounting with new
 * pledges and other refunds. A failed journal/stock write rolls back all of it.
 * Historical REFUNDED rows are not repaired or compensated on replay. */
export async function finalizeRefund(tx: Prisma.TransactionClient, p: Pledge, options: {
  source: string;
  disputeLost?: boolean;
  attemptKey?: string;
}): Promise<'applied' | 'duplicate' | 'mismatch'> {
  const captured = p.status === PledgeStatus.CAPTURED ||
    (p.status === PledgeStatus.DISPUTED && options.disputeLost);
  const held = p.status === PledgeStatus.HELD || p.status === PledgeStatus.PENDING_REAUTH;
  const intent = p.status === PledgeStatus.PENDING_BNPL;
  if (!captured && !held && !intent) return 'mismatch';
  await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${p.projectId}::uuid FOR UPDATE`;
  const now = new Date();
  const changed = await tx.pledge.updateMany({
    where: { id: p.id, projectId: p.projectId, backerId: p.backerId,
      paymentRef: p.paymentRef, status: p.status, tierId: p.tierId,
      amountHalalas: p.amountHalalas, addOnsHalalas: p.addOnsHalalas,
      ...(!captured ? { capturedAt: null } : {}),
      ...(options.attemptKey ? { authorizationIssue: options.attemptKey } : held ? { OR: [{ authorizationIssue: null }, { authorizationIssue: { startsWith: 'payment:VOID:' } }] } : {}),
    },
    data: { status: PledgeStatus.REFUNDED, refundedAt: now,
      refundReservedHalalas: 0n, refundIssue: null, authorizationIssue: null,
      ...(options.disputeLost ? { disputeOutcome: 'LOST', disputeResolvedAt: now } : {}),
    },
  });
  if (changed.count !== 1) {
    const current = await tx.pledge.findUnique({ where: { id: p.id } });
    return current?.status === PledgeStatus.REFUNDED && current.paymentRef === p.paymentRef &&
      current.amountHalalas === p.amountHalalas && current.addOnsHalalas === p.addOnsHalalas &&
      (!options.disputeLost || current.disputeOutcome === 'LOST') ? 'duplicate' : 'mismatch';
  }
  const amount = p.amountHalalas + p.addOnsHalalas;
  // A BNPL intent has no external payment: do not invent a financial journal.
  if (!intent) await tx.ledgerEntry.create({ data: {
    entryType: captured ? LedgerEntryType.REFUND : LedgerEntryType.VOID,
    amountHalalas: amount, pspRef: p.paymentRef, pledgeId: p.id,
    projectId: p.projectId, payoutId: null, source: options.source,
  } });
  const remaining = await tx.pledge.count({ where: {
    projectId: p.projectId, backerId: p.backerId, status: { in: COUNTED_PLEDGE_STATUSES },
  } });
  const conflict = () => new ConflictException('Refund accounting requires reconciliation; no local refund changes committed');
  const project = await tx.project.updateMany({
    where: { id: p.projectId, raisedHalalas: { gte: amount },
      ...(captured ? { realizedHalalas: { gte: amount } } : {}),
      ...(remaining === 0 ? { backersCount: { gt: 0 } } : {}),
    },
    data: { raisedHalalas: { decrement: amount },
      ...(captured ? { realizedHalalas: { decrement: amount } } : {}),
      ...(remaining === 0 ? { backersCount: { decrement: 1 } } : {}),
    },
  });
  if (project.count !== 1) throw conflict();
  if (p.tierId) {
    const stock = await tx.rewardTier.updateMany({ where: { id: p.tierId, claimedQty: { gt: 0 } },
      data: { claimedQty: { decrement: 1 } } });
    if (stock.count !== 1) throw conflict();
  }
  const addOns = await tx.pledgeAddOn.findMany({ where: { pledgeId: p.id }, orderBy: { addOnId: 'asc' } });
  for (const item of addOns) {
    const stock = await tx.addOn.updateMany({ where: { id: item.addOnId, claimedQty: { gte: item.qty } },
      data: { claimedQty: { decrement: item.qty } } });
    if (stock.count !== 1) throw conflict();
  }
  const backer = await tx.user.updateMany({ where: { id: p.backerId, totalPledgedHalalas: { gte: amount } },
    data: { totalPledgedHalalas: { decrement: amount } } });
  if (backer.count !== 1) throw conflict();
  return 'applied';
}
