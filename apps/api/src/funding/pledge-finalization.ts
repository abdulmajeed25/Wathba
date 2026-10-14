import { COUNTED_PLEDGE_STATUSES } from '../escrow-payments/refund-finalization';
import { ConflictException } from '@nestjs/common';
import { PledgeStatus, type Prisma, type Project, type RewardTier } from '@prisma/client';

export type PricedAddOn = { addOnId: string; qty: number; amountHalalas: bigint; unitPrice: bigint; limitQty: number | null };
export type ProjectTerms = Pick<Project, 'id' | 'fundingGoalHalalas' | 'releaseThresholdPct' | 'durationDays' | 'deadline'>;
export type TierTerms = Pick<RewardTier, 'id' | 'amountHalalas' | 'limitQty' | 'requiresShipping' | 'includesPhysicalProduct' | 'shippingHalalas' | 'shipsTo' | 'earlyBirdAmountHalalas' | 'earlyBirdUntil'>;

/** No provider calls here. Every counter and stock claim commits together,
 * only while the financial terms used for authorization are still current. */
export async function finalizePledge(tx: Prisma.TransactionClient, input: {
  pledgeId: string; backerId: string; paymentRef: string; total: bigint;
  project: ProjectTerms; tier: TierTerms | null; amountHalalas: number;
  addOns: PricedAddOn[]; isBnpl: boolean;
  authorizationIssue?: string | null;
}) {
  const { project, tier } = input;
  // Evaluate time AFTER waiting for a competing settlement/edit to release
  // the project row, not at the beginning of that wait.
  await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${project.id}::uuid FOR UPDATE`;
  const existing = await tx.pledge.count({ where: { projectId: project.id, backerId: input.backerId,
    status: { in: COUNTED_PLEDGE_STATUSES } } });
  const now = new Date();
  const changed = () => new ConflictException('تغيرت الحملة أو شروط العرض أثناء التحقق من الدفع؛ لم يُحتسب هذا الدعم');
  const claimed = await tx.project.updateMany({
    where: {
      id: project.id, status: 'LIVE',
      fundingGoalHalalas: project.fundingGoalHalalas,
      releaseThresholdPct: project.releaseThresholdPct,
      durationDays: project.durationDays,
      AND: [{ deadline: project.deadline }, { deadline: { gt: now } }],
    },
    data: { raisedHalalas: { increment: input.total }, ...(existing === 0 ? { backersCount: { increment: 1 } } : {}) },
  });
  if (claimed.count !== 1) throw changed();

  const pledgeClaim = await tx.pledge.updateMany({
    where: { id: input.pledgeId, backerId: input.backerId, projectId: project.id,
      amountHalalas: BigInt(input.amountHalalas), addOnsHalalas: input.total - BigInt(input.amountHalalas),
      status: PledgeStatus.PENDING_AUTH, paymentRef: input.paymentRef, authorizationIssue: input.authorizationIssue ?? null },
    data: { status: input.isBnpl ? PledgeStatus.PENDING_BNPL : PledgeStatus.HELD, authorizationIssue: null },
  });
  if (pledgeClaim.count !== 1) throw changed();

  if (tier) {
    const shipping = tier.requiresShipping ? tier.shippingHalalas ?? 0n : 0n;
    const discounted = BigInt(input.amountHalalas) - shipping < tier.amountHalalas;
    const stock = await tx.rewardTier.updateMany({
      where: {
        id: tier.id, projectId: project.id, isActive: true,
        amountHalalas: tier.amountHalalas, limitQty: tier.limitQty,
        requiresShipping: tier.requiresShipping, includesPhysicalProduct: tier.includesPhysicalProduct,
        shippingHalalas: tier.shippingHalalas,
        ...(tier.requiresShipping ? { shipsTo: { equals: tier.shipsTo } } : {}),
        earlyBirdAmountHalalas: tier.earlyBirdAmountHalalas,
        AND: [{ earlyBirdUntil: tier.earlyBirdUntil }, ...(discounted ? [{ earlyBirdUntil: { gt: now } }] : [])],
        ...(tier.limitQty === null ? {} : { claimedQty: { lt: tier.limitQty } }),
      },
      data: { claimedQty: { increment: 1 } },
    });
    if (stock.count !== 1) throw changed();
  }
  for (const item of input.addOns) {
    const stock = await tx.addOn.updateMany({
      where: { id: item.addOnId, projectId: project.id, amountHalalas: item.unitPrice,
        limitQty: item.limitQty,
        ...(item.limitQty === null ? {} : { claimedQty: { lte: item.limitQty - item.qty } }),
      },
      data: { claimedQty: { increment: item.qty } },
    });
    if (stock.count !== 1) throw changed();
  }
  await tx.user.update({ where: { id: input.backerId }, data: { totalPledgedHalalas: { increment: input.total } } });
  const totals = await tx.project.findUniqueOrThrow({ where: { id: project.id }, select: { raisedHalalas: true, backersCount: true, titleAr: true } });
  // Every entry path (sync response, browser, ops or webhook recovery) writes
  // the receipt in the same transaction as the credited pledge. No financial
  // commit may lose its in-app receipt after a process crash.
  const amount = `${input.total / 100n}.${(input.total % 100n).toString().padStart(2, '0')}`;
  await tx.notification.createMany({ data: [{ userId: input.backerId, kind: 'PLEDGE_RECEIVED',
    dedupKey: `pledge-receipt:${input.pledgeId}`, payload: { projectId: project.id, pledgeId: input.pledgeId,
      amountHalalas: input.total.toString(), deepLink: '/projects/me/pledges',
      title: `تأكيد تعهّدك لمشروع «${totals.titleAr}»`,
      body: input.isBnpl ? `سجّلنا نية دعمك بالتقسيط بمبلغ ${amount} ر.س.، ولم يبدأ عقد التقسيط أو التحصيل بعد.`
        : `تأكد حجز مبلغ ${amount} ر.س. وسُجّل تعهّدك؛ لم يُحصّل المبلغ بعد.` } }], skipDuplicates: true });
  return {
    updated: await tx.pledge.findUniqueOrThrow({ where: { id: input.pledgeId } }),
    totals,
  };
}
