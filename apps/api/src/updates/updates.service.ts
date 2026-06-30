import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type ProjectUpdate } from '@prisma/client';
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
    return this.toPublic(created);
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
