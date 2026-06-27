import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MilestoneStatus, ProjectStatus, type Milestone, type SpendLog } from '@prisma/client';
import {
  CreateSpendLogDto,
  SetMilestonesDto,
  SubmitEvidenceDto,
} from './dto/milestone.dto';

/**
 * Milestones bounded context — owns the milestone lifecycle and the
 * spending ledger (the data behind the **Live Transparency Dashboard**).
 *
 * Lifecycle:
 *   PENDING (creator drafts)
 *     → SUBMITTED (creator uploads evidence)
 *       → APPROVED (admin OKs evidence)
 *         → RELEASED (escrow disburses tranche to creator)
 *
 * Money is moved via the escrow service in a real prod build; here we
 * record the released amount and mark RELEASED. The release amount is
 * `releasePct%` of the total raised funds.
 */
@Injectable()
export class MilestonesService {
  private readonly logger = new Logger(MilestonesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Creator sets the full milestone plan in one go (replaces existing). */
  async setMilestones(
    userId: string,
    projectId: string,
    dto: SetMilestonesDto,
  ): Promise<Milestone[]> {
    const proj = await this.requireOwned(userId, projectId);
    if (proj.status !== ProjectStatus.DRAFT && proj.status !== ProjectStatus.UNDER_REVIEW) {
      throw new BadRequestException(`cannot edit milestones in status ${proj.status}`);
    }
    const totalPct = dto.milestones.reduce((acc, m) => acc + m.releasePct, 0);
    if (totalPct !== 100) {
      throw new BadRequestException(`milestone releasePct must sum to 100 (got ${totalPct})`);
    }
    return this.prisma.$transaction(async (tx) => {
      // Delete only PENDING milestones; never wipe milestones already in flight.
      const existing = await tx.milestone.findMany({ where: { projectId } });
      const inFlight = existing.find((m) => m.status !== MilestoneStatus.PENDING);
      if (inFlight) {
        throw new BadRequestException(
          `milestone ${inFlight.order} is already ${inFlight.status} — cannot redo plan`,
        );
      }
      await tx.milestone.deleteMany({ where: { projectId } });
      const sorted = [...dto.milestones].sort((a, b) => a.order - b.order);
      const created: Milestone[] = [];
      for (const m of sorted) {
        const row = await tx.milestone.create({
          data: {
            projectId,
            order: m.order,
            titleAr: m.titleAr,
            releasePct: m.releasePct,
            evidenceRequired: m.evidenceRequired,
            status: MilestoneStatus.PENDING,
          },
        });
        created.push(row);
      }
      return created;
    });
  }

  async listForProject(projectId: string): Promise<Milestone[]> {
    return this.prisma.milestone.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  /** Creator uploads evidence — moves PENDING → SUBMITTED. */
  async submitEvidence(
    userId: string,
    projectId: string,
    milestoneId: string,
    dto: SubmitEvidenceDto,
  ): Promise<Milestone> {
    await this.requireOwned(userId, projectId);
    const m = await this.requireMilestone(projectId, milestoneId);
    if (m.status !== MilestoneStatus.PENDING) {
      throw new BadRequestException(`milestone is ${m.status} — only PENDING can be submitted`);
    }
    return this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: MilestoneStatus.SUBMITTED,
        submittedAt: new Date(),
        evidenceUrl: dto.evidenceUrl,
      },
    });
  }

  /** Admin approves — SUBMITTED → APPROVED. */
  async approve(projectId: string, milestoneId: string): Promise<Milestone> {
    const m = await this.requireMilestone(projectId, milestoneId);
    if (m.status !== MilestoneStatus.SUBMITTED) {
      throw new BadRequestException(`milestone is ${m.status} — only SUBMITTED can be approved`);
    }
    return this.prisma.milestone.update({
      where: { id: milestoneId },
      data: { status: MilestoneStatus.APPROVED, approvedAt: new Date() },
    });
  }

  /**
   * Admin (or post-approval automation) releases the tranche. Calculates
   * the amount = raised × releasePct / 100. The actual disbursement is
   * the responsibility of the payouts module (Phase 4); here we mark the
   * milestone RELEASED and record the released amount.
   */
  async release(projectId: string, milestoneId: string): Promise<{ milestone: Milestone; amountHalalas: bigint }> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('project not found');
    if (project.status !== ProjectStatus.FUNDED && project.status !== ProjectStatus.IN_PRODUCTION) {
      throw new BadRequestException(
        `project must be FUNDED/IN_PRODUCTION to release milestones (was ${project.status})`,
      );
    }
    const m = await this.requireMilestone(projectId, milestoneId);
    if (m.status !== MilestoneStatus.APPROVED) {
      throw new BadRequestException(`milestone is ${m.status} — only APPROVED can be released`);
    }
    const amountHalalas = (project.raisedHalalas * BigInt(m.releasePct)) / BigInt(100);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.milestone.update({
        where: { id: milestoneId },
        data: {
          status: MilestoneStatus.RELEASED,
          releasedAt: new Date(),
          releasedHalalas: amountHalalas,
        },
      });
      // Move project into IN_PRODUCTION on first release.
      if (project.status === ProjectStatus.FUNDED) {
        await tx.project.update({
          where: { id: projectId },
          data: { status: ProjectStatus.IN_PRODUCTION },
        });
      }
      return row;
    });
    this.logger.log(`Released milestone=${milestoneId} amount=${amountHalalas} halalas`);
    return { milestone: updated, amountHalalas };
  }

  // ===========================================================================
  // SPEND LOGS — live transparency
  // ===========================================================================

  async addSpendLog(userId: string, projectId: string, dto: CreateSpendLogDto): Promise<SpendLog> {
    await this.requireOwned(userId, projectId);
    if (dto.milestoneId) {
      // Optional: validate the milestone belongs to this project.
      const m = await this.prisma.milestone.findUnique({ where: { id: dto.milestoneId } });
      if (!m || m.projectId !== projectId) {
        throw new BadRequestException('milestoneId does not belong to this project');
      }
    }
    return this.prisma.spendLog.create({
      data: {
        projectId,
        milestoneId: dto.milestoneId ?? null,
        amountHalalas: BigInt(dto.amountHalalas),
        descAr: dto.descAr,
        date: dto.date ? new Date(dto.date) : new Date(),
        proofUrl: dto.proofUrl,
      },
    });
  }

  async listSpendLogs(projectId: string): Promise<SpendLog[]> {
    return this.prisma.spendLog.findMany({
      where: { projectId },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Compute the budget split shown on the live transparency dashboard:
   * for each milestone, sum its spend logs and present as % of total
   * raised funds. Unallocated spend (milestoneId=null) goes to "أخرى".
   */
  async budgetSplit(projectId: string): Promise<{
    totalSpentHalalas: number;
    totalRaisedHalalas: number;
    rows: Array<{ label: string; amountHalalas: number; pct: number }>;
  }> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('project not found');
    const logs = await this.prisma.spendLog.findMany({ where: { projectId } });
    const milestones = await this.prisma.milestone.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
    const buckets = new Map<string, bigint>();
    for (const m of milestones) buckets.set(m.id, 0n);
    let unalloc = 0n;
    for (const l of logs) {
      if (l.milestoneId && buckets.has(l.milestoneId)) {
        buckets.set(l.milestoneId, buckets.get(l.milestoneId)! + l.amountHalalas);
      } else {
        unalloc += l.amountHalalas;
      }
    }
    const totalSpent = logs.reduce((acc, l) => acc + l.amountHalalas, 0n);
    const totalRaised = project.raisedHalalas;
    const rows: Array<{ label: string; amountHalalas: number; pct: number }> = [];
    for (const m of milestones) {
      const amt = buckets.get(m.id) ?? 0n;
      rows.push({
        label: m.titleAr,
        amountHalalas: Number(amt),
        pct: totalRaised > 0n ? Math.round(Number((amt * 100n) / totalRaised)) : 0,
      });
    }
    if (unalloc > 0n) {
      rows.push({
        label: 'أخرى',
        amountHalalas: Number(unalloc),
        pct: totalRaised > 0n ? Math.round(Number((unalloc * 100n) / totalRaised)) : 0,
      });
    }
    return {
      totalSpentHalalas: Number(totalSpent),
      totalRaisedHalalas: Number(totalRaised),
      rows,
    };
  }

  toPublic(m: Milestone): Record<string, unknown> {
    return {
      id: m.id,
      projectId: m.projectId,
      order: m.order,
      titleAr: m.titleAr,
      releasePct: m.releasePct,
      evidenceRequired: m.evidenceRequired,
      status: m.status,
      releasedHalalas: Number(m.releasedHalalas),
      submittedAt: m.submittedAt?.toISOString() ?? null,
      approvedAt: m.approvedAt?.toISOString() ?? null,
      releasedAt: m.releasedAt?.toISOString() ?? null,
      evidenceUrl: m.evidenceUrl,
    };
  }

  spendLogToPublic(s: SpendLog): Record<string, unknown> {
    return {
      id: s.id,
      projectId: s.projectId,
      milestoneId: s.milestoneId,
      amountHalalas: Number(s.amountHalalas),
      descAr: s.descAr,
      date: s.date.toISOString(),
      proofUrl: s.proofUrl,
    };
  }

  private async requireOwned(userId: string, projectId: string) {
    const proj = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!proj) throw new NotFoundException('project not found');
    if (proj.createdById !== userId) throw new ForbiddenException('not your project');
    return proj;
  }

  private async requireMilestone(projectId: string, milestoneId: string): Promise<Milestone> {
    const m = await this.prisma.milestone.findUnique({ where: { id: milestoneId } });
    if (!m || m.projectId !== projectId) throw new NotFoundException('milestone not found');
    return m;
  }
}
