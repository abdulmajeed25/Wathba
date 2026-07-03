import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationKind, PledgeStatus, type ProjectUpdate } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUpdateDto,
  ListUpdatesQueryDto,
  UpdateUpdateDto,
} from './dto/update.dto';

/**
 * Project Updates — numbered creator broadcasts (#1, #2…) that backers see in
 * the "التحديثات" tab. orderNum is auto-assigned (max+1) on create and
 * fronts the public sort. Likes are increment-only in v1 (no per-user dedupe).
 */
export interface PublicUpdate {
  id: string;
  projectId: string;
  orderNum: number;
  titleAr: string;
  bodyAr: string;
  likeCount: number;
  commentCount: number;
  date: string;
}

@Injectable()
export class UpdatesService {
  private readonly logger = new Logger(UpdatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(
    projectId: string,
    q: ListUpdatesQueryDto,
  ): Promise<{ items: PublicUpdate[] }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('project not found');

    const take = Math.min(Math.max(q.take ?? 20, 1), 100);
    const items = await this.prisma.projectUpdate.findMany({
      where: { projectId },
      orderBy: { orderNum: 'desc' },
      take,
    });
    return { items: items.map((u) => this.toPublic(u)) };
  }

  async getOne(projectId: string, updateId: string): Promise<PublicUpdate> {
    const u = await this.prisma.projectUpdate.findFirst({
      where: { id: updateId, projectId },
    });
    if (!u) throw new NotFoundException('update not found');
    return this.toPublic(u);
  }

  async create(
    creatorId: string,
    projectId: string,
    dto: CreateUpdateDto,
  ): Promise<PublicUpdate> {
    await this.requireCreator(creatorId, projectId);

    // orderNum = max(existing) + 1, else 1.
    const top = await this.prisma.projectUpdate.findFirst({
      where: { projectId },
      orderBy: { orderNum: 'desc' },
      select: { orderNum: true },
    });
    const orderNum = (top?.orderNum ?? 0) + 1;

    const created = await this.prisma.projectUpdate.create({
      data: {
        projectId,
        titleAr: dto.titleAr,
        bodyAr: dto.bodyAr,
        orderNum,
      },
    });

    // CC-01 — notify backers + followers. Fire-and-forget (same discipline as
    // community.materializeFromPledge): publishing must never block on the
    // fan-out, and a notification glitch must never fail the creator's post.
    this.fanOutUpdatePosted(projectId, created).catch((err) =>
      this.logger.warn(`update fan-out failed for update=${created.id}: ${String(err)}`),
    );

    return this.toPublic(created);
  }

  /**
   * CC-01 — fan out an UPDATE_POSTED notification to every backer with a
   * CAPTURED or HELD pledge on the project plus every follower of the creator,
   * deduplicated (a user who is both gets one). The creator themselves is
   * excluded. Idempotent per (updateId, userId) via the `dedupKey` unique
   * index + `skipDuplicates`, so a re-publish or retry can't double-notify.
   * One batched `createMany` — never N round-trips.
   */
  async fanOutUpdatePosted(
    projectId: string,
    update: Pick<ProjectUpdate, 'id' | 'titleAr'>,
  ): Promise<{ notified: number }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { titleAr: true, createdById: true },
    });
    if (!project) return { notified: 0 };

    const [backers, followers] = await Promise.all([
      this.prisma.pledge.findMany({
        where: {
          projectId,
          status: { in: [PledgeStatus.CAPTURED, PledgeStatus.HELD] },
        },
        select: { backerId: true },
        distinct: ['backerId'],
      }),
      this.prisma.creatorFollow.findMany({
        where: { creatorProfile: { userId: project.createdById } },
        select: { followerId: true },
      }),
    ]);

    const recipients = new Set<string>();
    for (const b of backers) recipients.add(b.backerId);
    for (const f of followers) recipients.add(f.followerId);
    recipients.delete(project.createdById); // don't notify yourself
    if (recipients.size === 0) return { notified: 0 };

    const deepLink = `/projects/${projectId}/updates/${update.id}`;
    const data = [...recipients].map((userId) => ({
      userId,
      kind: NotificationKind.UPDATE_POSTED,
      payload: {
        projectId,
        projectTitleAr: project.titleAr,
        updateId: update.id,
        updateTitleAr: update.titleAr,
        deepLink,
      },
      dedupKey: `update:${update.id}:${userId}`,
    }));

    const { count } = await this.prisma.notification.createMany({
      data,
      skipDuplicates: true,
    });
    this.logger.log(`update=${update.id} fan-out notified=${count} recipients=${recipients.size}`);
    return { notified: count };
  }

  async update(
    creatorId: string,
    projectId: string,
    updateId: string,
    dto: UpdateUpdateDto,
  ): Promise<PublicUpdate> {
    await this.requireCreator(creatorId, projectId);
    const existing = await this.prisma.projectUpdate.findFirst({
      where: { id: updateId, projectId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('update not found');

    const updated = await this.prisma.projectUpdate.update({
      where: { id: updateId },
      data: {
        ...(dto.titleAr !== undefined && { titleAr: dto.titleAr }),
        ...(dto.bodyAr !== undefined && { bodyAr: dto.bodyAr }),
      },
    });
    return this.toPublic(updated);
  }

  /**
   * Toggle like — Tier 3.4. Idempotent per (userId, updateId): first call
   * inserts a join row + increments likeCount; second call removes the row
   * + decrements. The denormalised counter stays in sync via the same tx.
   */
  async like(
    userId: string,
    projectId: string,
    updateId: string,
  ): Promise<PublicUpdate & { liked: boolean }> {
    const existing = await this.prisma.projectUpdate.findFirst({
      where: { id: updateId, projectId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('update not found');

    const { row, liked } = await this.prisma.$transaction(async (tx) => {
      const had = await tx.updateLike.findUnique({
        where: { updateId_userId: { updateId, userId } },
        select: { updateId: true },
      });
      if (had) {
        await tx.updateLike.delete({
          where: { updateId_userId: { updateId, userId } },
        });
        let r = await tx.projectUpdate.update({
          where: { id: updateId },
          data: { likeCount: { decrement: 1 } },
        });
        // Defensive: never let the counter dip below 0 (historical drift).
        if (r.likeCount < 0) {
          r = await tx.projectUpdate.update({
            where: { id: updateId },
            data: { likeCount: 0 },
          });
        }
        return { row: r, liked: false };
      }
      await tx.updateLike.create({ data: { updateId, userId } });
      const r = await tx.projectUpdate.update({
        where: { id: updateId },
        data: { likeCount: { increment: 1 } },
      });
      return { row: r, liked: true };
    });
    return { ...this.toPublic(row), liked };
  }

  async remove(
    creatorId: string,
    projectId: string,
    updateId: string,
  ): Promise<{ ok: true }> {
    await this.requireCreator(creatorId, projectId);
    const existing = await this.prisma.projectUpdate.findFirst({
      where: { id: updateId, projectId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('update not found');
    await this.prisma.projectUpdate.delete({ where: { id: updateId } });
    return { ok: true };
  }

  private async requireCreator(creatorId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { createdById: true },
    });
    if (!project) throw new NotFoundException('project not found');
    if (project.createdById !== creatorId) {
      throw new ForbiddenException('not your project');
    }
  }

  private toPublic(u: ProjectUpdate): PublicUpdate {
    return {
      id: u.id,
      projectId: u.projectId,
      orderNum: u.orderNum,
      titleAr: u.titleAr,
      bodyAr: u.bodyAr,
      likeCount: u.likeCount,
      commentCount: u.commentCount,
      date: u.date.toISOString(),
    };
  }
}
