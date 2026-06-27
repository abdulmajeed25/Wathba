import {
  BadRequestException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EscrowService } from '../escrow-payments/escrow.service';
import { ContractsService } from '../contracts/contracts.service';
import { Prisma, PledgeStatus, ProjectStatus, type Pledge } from '@prisma/client';
import { CreatePledgeDto } from './dto/pledge.dto';

/**
 * Funding bounded context — §5 FSM, exactly:
 *
 *   At deadline:
 *     if raised ≥ goal × releaseThresholdPct / 100  →  SUCCESSFUL  →  Capture  →  FUNDED
 *     else                                          →  FAILED      →  Void/Refund → REFUNDED
 *
 * All money BigInt halalas. Pledges are HELD (authorize only) while LIVE.
 * raisedHalalas + backersCount + tier.claimedQty + user.totalPledgedHalalas
 * are denormalized counters maintained in the same transaction as the
 * pledge insert.
 */
@Injectable()
export class FundingService {
  private readonly logger = new Logger(FundingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly escrow: EscrowService,
    private readonly contracts: ContractsService,
  ) {}

  async pledge(backerId: string, dto: CreatePledgeDto): Promise<Pledge> {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('project not found');
    if (project.status !== ProjectStatus.LIVE) {
      throw new BadRequestException(`project is not LIVE (was ${project.status})`);
    }
    if (project.deadline.getTime() <= Date.now()) {
      throw new BadRequestException('project has reached its deadline');
    }

    const tier = await this.prisma.rewardTier.findUnique({ where: { id: dto.tierId } });
    if (!tier || tier.projectId !== dto.projectId) {
      throw new BadRequestException('invalid tier for this project');
    }
    if (Number(tier.amountHalalas) > dto.amountHalalas) {
      throw new BadRequestException(
        `amount ${dto.amountHalalas} is below the tier minimum ${Number(tier.amountHalalas)}`,
      );
    }
    if (tier.limitQty !== null && tier.claimedQty >= tier.limitQty) {
      throw new BadRequestException('tier is sold out');
    }
    if (tier.requiresShipping && !dto.shipping) {
      throw new BadRequestException('shipping address is required for this tier');
    }

    const contractType =
      dto.contractType ??
      this.contracts.inferType({ includesPhysicalProduct: tier.includesPhysicalProduct });

    // 1) Insert the pledge in HELD state, paymentRef='pending'.
    const pledge = await this.prisma.pledge.create({
      data: {
        backerId,
        projectId: dto.projectId,
        tierId: dto.tierId,
        amountHalalas: BigInt(dto.amountHalalas),
        contractType,
        shipping: dto.shipping
          ? (dto.shipping as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        status: PledgeStatus.HELD,
        paymentRef: `pending-${Date.now()}-${backerId.slice(0, 8)}`,
      },
    });

    // 2) Authorize-only hold against the PSP (outside the DB tx — if it
    //    fails we mark the pledge FAILED and skip counter increments).
    let payment: { paymentRef: string; status: 'authorized' | 'failed' };
    try {
      payment = await this.escrow.hold({
        pledgeId: pledge.id,
        amountHalalas: pledge.amountHalalas,
        source: dto.source,
        description: `وثبة — دعم لمشروع ${project.titleAr}`,
      });
    } catch (err) {
      this.logger.error(`hold failed for pledge=${pledge.id}`, err as Error);
      await this.prisma.pledge.update({
        where: { id: pledge.id },
        data: { status: PledgeStatus.FAILED, paymentRef: `failed-${pledge.id}` },
      });
      throw new BadRequestException('payment authorization failed');
    }

    if (payment.status !== 'authorized') {
      await this.prisma.pledge.update({
        where: { id: pledge.id },
        data: { status: PledgeStatus.FAILED, paymentRef: payment.paymentRef },
      });
      throw new BadRequestException('payment was not authorized');
    }

    // 3) Commit paymentRef + bump counters atomically.
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.pledge.update({
        where: { id: pledge.id },
        data: { paymentRef: payment.paymentRef },
      });
      await tx.project.update({
        where: { id: dto.projectId },
        data: {
          raisedHalalas: { increment: pledge.amountHalalas },
          backersCount: { increment: 1 },
        },
      });
      await tx.rewardTier.update({
        where: { id: dto.tierId },
        data: { claimedQty: { increment: 1 } },
      });
      await tx.user.update({
        where: { id: backerId },
        data: { totalPledgedHalalas: { increment: pledge.amountHalalas } },
      });
      return updated;
    });
  }

  async listMine(backerId: string): Promise<Pledge[]> {
    return this.prisma.pledge.findMany({
      where: { backerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  toPublic(p: Pledge): Record<string, unknown> {
    return {
      id: p.id,
      backerId: p.backerId,
      projectId: p.projectId,
      tierId: p.tierId,
      amountHalalas: Number(p.amountHalalas),
      status: p.status,
      shipping: p.shipping,
      contractType: p.contractType,
      paymentRef: p.paymentRef,
      createdAt: p.createdAt.toISOString(),
      capturedAt: p.capturedAt?.toISOString() ?? null,
      refundedAt: p.refundedAt?.toISOString() ?? null,
    };
  }

  // -- FSM at deadline --------------------------------------------------------

  /**
   * Settle a single project: if past deadline & still LIVE, apply the §5
   * rule. Idempotent.
   */
  async settleProject(projectId: string): Promise<{
    projectId: string;
    transition: 'noop' | 'funded' | 'refunded';
  }> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('project not found');
    if (project.status !== ProjectStatus.LIVE) return { projectId, transition: 'noop' };
    if (project.deadline.getTime() > Date.now()) return { projectId, transition: 'noop' };

    const goal = project.fundingGoalHalalas;
    const threshold = (goal * BigInt(project.releaseThresholdPct)) / BigInt(100);
    const successful = project.raisedHalalas >= threshold;

    this.logger.log(
      `Settling project=${projectId} raised=${project.raisedHalalas} threshold=${threshold} successful=${successful}`,
    );

    if (successful) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.SUCCESSFUL },
      });
      await this.escrow.captureAllHeld(projectId);
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.FUNDED },
      });
      return { projectId, transition: 'funded' };
    }
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.FAILED },
    });
    await this.escrow.refundAllHeld(projectId);
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.REFUNDED },
    });
    return { projectId, transition: 'refunded' };
  }

  /** Settle every project whose deadline has passed (called by deadline cron). */
  async settleDueProjects(): Promise<{ scanned: number; settled: number }> {
    const due = await this.prisma.project.findMany({
      where: { status: ProjectStatus.LIVE, deadline: { lte: new Date() } },
      select: { id: true },
    });
    let settled = 0;
    for (const p of due) {
      try {
        const r = await this.settleProject(p.id);
        if (r.transition !== 'noop') settled++;
      } catch (err) {
        this.logger.error(`settle failed for project=${p.id}`, err as Error);
      }
    }
    return { scanned: due.length, settled };
  }
}
