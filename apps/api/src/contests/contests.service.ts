import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ContestStatus,
  NotificationKind,
  PledgeStatus,
  type Contest,
  type ContestWinner,
} from '@prisma/client';
import {
  AnnounceContestDto,
  CreateContestDto,
  UpdateContestDto,
} from './dto/contest.dto';

type ContestWithWinners = Contest & { winners: ContestWinner[] };

@Injectable()
export class ContestsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForProject(projectId: string): Promise<ContestWithWinners[]> {
    await this.requireProject(projectId);
    return this.prisma.contest.findMany({
      where: { projectId },
      include: { winners: true },
      orderBy: { roundNum: 'asc' },
    });
  }

  async create(
    creatorId: string,
    projectId: string,
    dto: CreateContestDto,
  ): Promise<ContestWithWinners> {
    await this.requireOwned(creatorId, projectId);
    this.assertExactlyOnePrize(dto);

    const last = await this.prisma.contest.findFirst({
      where: { projectId },
      orderBy: { roundNum: 'desc' },
      select: { roundNum: true },
    });
    const roundNum = (last?.roundNum ?? 0) + 1;

    const contest = await this.prisma.contest.create({
      data: {
        projectId,
        roundNum,
        promptAr: dto.promptAr,
        prizeRewardTierId: dto.prizeRewardTierId ?? null,
        prizeAddOnId: dto.prizeAddOnId ?? null,
        prizeCustomAr: dto.prizeCustomAr ?? null,
        winnersCount: dto.winnersCount,
        status: ContestStatus.DRAFT,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
      include: { winners: true },
    });
    return contest;
  }

  async update(
    creatorId: string,
    projectId: string,
    contestId: string,
    dto: UpdateContestDto,
  ): Promise<ContestWithWinners> {
    await this.requireOwned(creatorId, projectId);
    const existing = await this.requireContest(projectId, contestId);
    if (existing.status === ContestStatus.ANNOUNCED) {
      throw new BadRequestException('cannot edit an ANNOUNCED contest');
    }

    // If any prize fields are touched, validate the resulting trio still has
    // exactly one of {tier, addOn, customAr} set.
    const touchesPrize =
      dto.prizeRewardTierId !== undefined ||
      dto.prizeAddOnId !== undefined ||
      dto.prizeCustomAr !== undefined;
    if (touchesPrize) {
      const next = {
        prizeRewardTierId:
          dto.prizeRewardTierId !== undefined
            ? dto.prizeRewardTierId
            : existing.prizeRewardTierId,
        prizeAddOnId:
          dto.prizeAddOnId !== undefined ? dto.prizeAddOnId : existing.prizeAddOnId,
        prizeCustomAr:
          dto.prizeCustomAr !== undefined ? dto.prizeCustomAr : existing.prizeCustomAr,
      };
      this.assertExactlyOnePrize(next);
    }

    return this.prisma.contest.update({
      where: { id: contestId },
      data: {
        ...(dto.promptAr !== undefined && { promptAr: dto.promptAr }),
        ...(dto.prizeRewardTierId !== undefined && {
          prizeRewardTierId: dto.prizeRewardTierId,
        }),
        ...(dto.prizeAddOnId !== undefined && { prizeAddOnId: dto.prizeAddOnId }),
        ...(dto.prizeCustomAr !== undefined && { prizeCustomAr: dto.prizeCustomAr }),
        ...(dto.winnersCount !== undefined && { winnersCount: dto.winnersCount }),
        ...(dto.startsAt !== undefined && {
          startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        }),
        ...(dto.endsAt !== undefined && {
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        }),
      },
      include: { winners: true },
    });
  }

  async transition(
    creatorId: string,
    projectId: string,
    contestId: string,
    next: ContestStatus,
  ): Promise<ContestWithWinners> {
    await this.requireOwned(creatorId, projectId);
    const existing = await this.requireContest(projectId, contestId);

    // Only handle DRAFT→OPEN and OPEN→CLOSED here. ANNOUNCED is handled
    // by the announce() flow so the comment + winners stay atomic.
    if (next === ContestStatus.OPEN) {
      if (existing.status !== ContestStatus.DRAFT) {
        throw new BadRequestException(`cannot open from ${existing.status}`);
      }
      return this.prisma.contest.update({
        where: { id: contestId },
        data: { status: ContestStatus.OPEN, startsAt: existing.startsAt ?? new Date() },
        include: { winners: true },
      });
    }
    if (next === ContestStatus.CLOSED) {
      if (existing.status !== ContestStatus.OPEN) {
        throw new BadRequestException(`cannot close from ${existing.status}`);
      }
      return this.prisma.contest.update({
        where: { id: contestId },
        data: { status: ContestStatus.CLOSED, endsAt: existing.endsAt ?? new Date() },
        include: { winners: true },
      });
    }
    throw new BadRequestException(`unsupported transition target ${next}`);
  }

  async announce(
    creatorId: string,
    projectId: string,
    contestId: string,
    dto: AnnounceContestDto,
  ): Promise<ContestWithWinners> {
    await this.requireOwned(creatorId, projectId);
    const existing = await this.requireContest(projectId, contestId);
    if (existing.status !== ContestStatus.CLOSED) {
      throw new BadRequestException('contest must be CLOSED before announcing winners');
    }
    if (dto.winnerBackerIds.length !== existing.winnersCount) {
      throw new BadRequestException(
        `expected ${existing.winnersCount} winners, got ${dto.winnerBackerIds.length}`,
      );
    }
    const uniq = new Set(dto.winnerBackerIds);
    if (uniq.size !== dto.winnerBackerIds.length) {
      throw new BadRequestException('duplicate winner ids');
    }

    // Resolve each winner's per-project Pledge.backerNo. Only CAPTURED pledges
    // count — held/refunded backers can't win.
    const pledges = await this.prisma.pledge.findMany({
      where: {
        projectId,
        backerId: { in: dto.winnerBackerIds },
        status: PledgeStatus.CAPTURED,
        backerNo: { not: null },
      },
      select: { backerId: true, backerNo: true },
    });
    const numByBacker = new Map<string, number>();
    for (const p of pledges) {
      if (p.backerNo != null && !numByBacker.has(p.backerId)) {
        numByBacker.set(p.backerId, p.backerNo);
      }
    }
    const missing = dto.winnerBackerIds.filter((id) => !numByBacker.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `${missing.length} winner(s) are not captured backers on this project`,
      );
    }

    // Build the pinned creator comment body. Sort the # tags ascending for a
    // tidy ribbon: "🎉 فائزو الجولة 2: الداعمون #3، #7، #12".
    const numbers = dto.winnerBackerIds
      .map((id) => numByBacker.get(id) as number)
      .sort((a, b) => a - b);
    const tags = numbers.map((n) => `#${n}`).join('، ');
    const bodyAr = `🎉 فائزو الجولة ${existing.roundNum}: الداعمون ${tags}`;

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Insert ContestWinner rows.
      await tx.contestWinner.createMany({
        data: dto.winnerBackerIds.map((backerId) => ({
          contestId,
          backerId,
          backerNo: numByBacker.get(backerId) as number,
        })),
      });

      // 2. Insert the pinned creator comment. Slice 2B's comments controller
      // will read this row unchanged — we write directly via PrismaService to
      // avoid a cross-slice import dependency.
      const comment = await tx.comment.create({
        data: {
          projectId,
          userId: creatorId,
          bodyAr,
          isCreator: true,
          pinned: true,
          pinnedAt: now,
          hidden: false,
        },
      });

      // 3. Update the contest to ANNOUNCED, stamp announcedAt + comment id.
      const updated = await tx.contest.update({
        where: { id: contestId },
        data: {
          status: ContestStatus.ANNOUNCED,
          announcedAt: now,
          announcementCommentId: comment.id,
        },
        include: { winners: true },
      });

      // 4. Notify each winner. Outbox row created in-tx, no drift.
      for (const backerId of dto.winnerBackerIds) {
        await tx.notification.create({
          data: {
            userId: backerId,
            kind: NotificationKind.CONTEST_ANNOUNCED,
            payload: {
              projectId,
              contestId,
              roundNum: updated.roundNum,
              backerNo: numByBacker.get(backerId) as number,
              commentId: comment.id,
            },
          },
        });
      }

      return updated;
    });
    return result;
  }

  async remove(
    creatorId: string,
    projectId: string,
    contestId: string,
  ): Promise<{ deleted: true }> {
    await this.requireOwned(creatorId, projectId);
    const existing = await this.requireContest(projectId, contestId);
    if (existing.status !== ContestStatus.DRAFT) {
      throw new BadRequestException('only DRAFT contests can be deleted');
    }
    await this.prisma.contest.delete({ where: { id: contestId } });
    return { deleted: true };
  }

  toPublic(c: ContestWithWinners): Record<string, unknown> {
    return {
      id: c.id,
      projectId: c.projectId,
      roundNum: c.roundNum,
      promptAr: c.promptAr,
      prizeRewardTierId: c.prizeRewardTierId,
      prizeAddOnId: c.prizeAddOnId,
      prizeCustomAr: c.prizeCustomAr,
      winnersCount: c.winnersCount,
      status: c.status,
      startsAt: c.startsAt?.toISOString() ?? null,
      endsAt: c.endsAt?.toISOString() ?? null,
      announcedAt: c.announcedAt?.toISOString() ?? null,
      announcementCommentId: c.announcementCommentId,
      createdAt: c.createdAt.toISOString(),
      winners: c.winners.map((w) => ({ backerId: w.backerId, backerNo: w.backerNo })),
    };
  }

  // ----- helpers -----

  private assertExactlyOnePrize(p: {
    prizeRewardTierId?: string | null;
    prizeAddOnId?: string | null;
    prizeCustomAr?: string | null;
  }): void {
    const count = [p.prizeRewardTierId, p.prizeAddOnId, p.prizeCustomAr].filter(
      (v) => v != null && v !== '',
    ).length;
    if (count !== 1) {
      throw new BadRequestException(
        'exactly one of prizeRewardTierId / prizeAddOnId / prizeCustomAr must be set',
      );
    }
  }

  private async requireProject(projectId: string) {
    const p = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!p) throw new NotFoundException('project not found');
    return p;
  }

  private async requireOwned(creatorId: string, projectId: string) {
    const p = await this.requireProject(projectId);
    if (p.createdById !== creatorId) throw new ForbiddenException('not your project');
    return p;
  }

  private async requireContest(projectId: string, contestId: string): Promise<Contest> {
    const c = await this.prisma.contest.findUnique({ where: { id: contestId } });
    if (!c || c.projectId !== projectId) throw new NotFoundException('contest not found');
    return c;
  }
}
