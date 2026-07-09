import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PledgeStatus } from '@prisma/client';
import { METHOD_FEES, feeFor } from '../config/fees';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Creator analytics (Creator-CC / CC-16). Everything here is DERIVED from
 * existing data (Pledge, ProjectUpdate) — no event/tracking infrastructure is
 * required. Traffic, conversion, funnel and referral analytics are NOT included
 * because they genuinely need visit/attribution events we don't capture yet;
 * the response says so honestly via `notTracked`.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async forProject(creatorId: string, projectId: string): Promise<Record<string, unknown>> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('project not found');
    if (project.createdById !== creatorId) throw new ForbiddenException('not your project');

    const backerStatuses = [PledgeStatus.CAPTURED, PledgeStatus.HELD];

    // Pledges over time — day buckets (date_trunc). Derivable, indexed.
    const overTimeRaw = await this.prisma.$queryRaw<
      Array<{ day: Date; cnt: bigint; total: bigint }>
    >`
      SELECT date_trunc('day', "createdAt")::date AS day,
             count(*)::bigint AS cnt,
             COALESCE(sum("amountHalalas" + "addOnsHalalas"), 0)::bigint AS total
      FROM "Pledge"
      WHERE "projectId" = ${projectId}::uuid
        AND "status" IN ('CAPTURED', 'HELD')
      GROUP BY day
      ORDER BY day ASC
    `;
    const pledgesOverTime = overTimeRaw.map((r) => ({
      date: new Date(r.day).toISOString().slice(0, 10),
      count: Number(r.cnt),
      amountHalalas: Number(r.total),
    }));

    // Tier performance — per-tier backers + amount (groupBy).
    const grouped = await this.prisma.pledge.groupBy({
      by: ['tierId'],
      where: { projectId, status: { in: backerStatuses } },
      _count: { _all: true },
      _sum: { amountHalalas: true, addOnsHalalas: true },
    });
    const tiers = await this.prisma.rewardTier.findMany({
      where: { projectId },
      select: { id: true, titleAr: true, amountHalalas: true },
    });
    const tierMap = new Map(tiers.map((t) => [t.id, t]));
    const tierPerformance = grouped
      .map((g) => ({
        tierId: g.tierId,
        // Batch PAY (Part 3) — tierless pledges group under the null key.
        titleAr: g.tierId === null ? 'دعم بدون مكافأة' : (tierMap.get(g.tierId)?.titleAr ?? '—'),
        backers: g._count._all,
        amountHalalas: Number((g._sum.amountHalalas ?? 0n) + (g._sum.addOnsHalalas ?? 0n)),
      }))
      .sort((a, b) => b.amountHalalas - a.amountHalalas);

    // Status split of pledges.
    const statusGroups = await this.prisma.pledge.groupBy({
      by: ['status'],
      where: { projectId },
      _count: { _all: true },
    });
    const statusCounts = Object.fromEntries(
      statusGroups.map((s) => [s.status, s._count._all]),
    ) as Record<string, number>;

    // Batch PAY (Part 4) — per-method breakdown, fee-aware: creators see the
    // effective platform+processor cost per method (numbers, never controls).
    const methodGroups = await this.prisma.pledge.groupBy({
      by: ['paymentMethod'],
      where: { projectId, status: { in: [PledgeStatus.CAPTURED, PledgeStatus.HELD, PledgeStatus.PENDING_BNPL, PledgeStatus.CAPTURE_GRACE] } },
      _count: { _all: true },
      _sum: { amountHalalas: true, addOnsHalalas: true },
    });
    const byMethod = methodGroups.map((g) => {
      const gross = (g._sum.amountHalalas ?? 0n) + (g._sum.addOnsHalalas ?? 0n);
      const method = (g.paymentMethod as keyof typeof METHOD_FEES) ?? 'CARD';
      const fees = feeFor(method in METHOD_FEES ? method : 'CARD', gross);
      return {
        method: g.paymentMethod,
        labelAr: METHOD_FEES[method in METHOD_FEES ? method : 'CARD'].labelAr,
        pledges: g._count._all,
        grossHalalas: Number(gross),
        platformFeeHalalas: Number(fees.platformHalalas),
        processorFeeHalalas: Number(fees.processorHalalas),
        netHalalas: Number(fees.netHalalas),
      };
    });

    // Update engagement — already-materialised counters, just aggregated.
    const upd = await this.prisma.projectUpdate.aggregate({
      where: { projectId },
      _count: { _all: true },
      _sum: { likeCount: true, commentCount: true },
    });

    const captured = statusCounts[PledgeStatus.CAPTURED] ?? 0;
    const held = statusCounts[PledgeStatus.HELD] ?? 0;
    const activeBackers = captured + held;

    return {
      byMethod,
      totals: {
        raisedHalalas: Number(project.raisedHalalas),
        realizedHalalas: Number(project.realizedHalalas),
        goalHalalas: Number(project.fundingGoalHalalas),
        backersCount: project.backersCount,
        percentFunded:
          project.fundingGoalHalalas > 0n
            ? Math.round((Number(project.raisedHalalas) / Number(project.fundingGoalHalalas)) * 100)
            : 0,
        avgPledgeHalalas: activeBackers > 0 ? Math.round(Number(project.raisedHalalas) / activeBackers) : 0,
        capturedCount: captured,
        heldCount: held,
        refundedCount: statusCounts[PledgeStatus.REFUNDED] ?? 0,
      },
      pledgesOverTime,
      tierPerformance,
      updateEngagement: {
        updates: upd._count._all,
        likes: upd._sum.likeCount ?? 0,
        comments: upd._sum.commentCount ?? 0,
      },
      // Honest scoping — these require event/attribution infrastructure we don't
      // have yet, so we don't fake them.
      notTracked: ['traffic', 'conversion-funnel', 'referral-sources', 'update-views'],
    };
  }
}
