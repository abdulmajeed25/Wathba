import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, ListProjectsQueryDto, UpdateProjectDto } from './dto/project.dto';
import { Prisma, ProjectStatus, type Project } from '@prisma/client';

/**
 * Projects bounded context. Owns the project lifecycle.
 * DRAFT → UNDER_REVIEW → LIVE → … (admin reviews; here, owner submits).
 * Money in BigInt halalas; serialized via toPublic().
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(creatorId: string, dto: CreateProjectDto): Promise<Project> {
    // Provisional deadline; admin sets the real one on publish.
    const deadline = new Date(Date.now() + dto.durationDays * 86_400_000);
    return this.prisma.project.create({
      data: {
        titleAr: dto.titleAr,
        shortDescAr: dto.shortDescAr,
        category: dto.category,
        storyAr: dto.storyAr,
        mediaUrls: dto.mediaUrls ?? [],
        fundingGoalHalalas: BigInt(dto.fundingGoalHalalas),
        releaseThresholdPct: dto.releaseThresholdPct ?? 80,
        durationDays: dto.durationDays,
        deadline,
        productSpecAr: dto.productSpecAr,
        expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
        createdById: creatorId,
        status: ProjectStatus.DRAFT,
        platformPartner: dto.platformPartner
          ? (dto.platformPartner as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }

  async update(creatorId: string, projectId: string, dto: UpdateProjectDto): Promise<Project> {
    const proj = await this.requireOwned(creatorId, projectId);
    if (proj.status !== ProjectStatus.DRAFT && proj.status !== ProjectStatus.UNDER_REVIEW) {
      throw new BadRequestException(`cannot edit project in status ${proj.status}`);
    }
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.titleAr !== undefined && { titleAr: dto.titleAr }),
        ...(dto.shortDescAr !== undefined && { shortDescAr: dto.shortDescAr }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.storyAr !== undefined && { storyAr: dto.storyAr }),
        ...(dto.mediaUrls !== undefined && { mediaUrls: dto.mediaUrls }),
        ...(dto.fundingGoalHalalas !== undefined && {
          fundingGoalHalalas: BigInt(dto.fundingGoalHalalas),
        }),
        ...(dto.releaseThresholdPct !== undefined && {
          releaseThresholdPct: dto.releaseThresholdPct,
        }),
        ...(dto.durationDays !== undefined && { durationDays: dto.durationDays }),
        ...(dto.productSpecAr !== undefined && { productSpecAr: dto.productSpecAr }),
        ...(dto.expectedDeliveryDate !== undefined && {
          expectedDeliveryDate: dto.expectedDeliveryDate
            ? new Date(dto.expectedDeliveryDate)
            : null,
        }),
        ...(dto.platformPartner !== undefined && {
          platformPartner:
            dto.platformPartner === null
              ? Prisma.JsonNull
              : (dto.platformPartner as unknown as Prisma.InputJsonValue),
        }),
      },
    });
  }

  async submitForReview(creatorId: string, projectId: string): Promise<Project> {
    const proj = await this.requireOwned(creatorId, projectId);
    if (proj.status !== ProjectStatus.DRAFT) {
      throw new BadRequestException(`only DRAFT projects can be submitted (was ${proj.status})`);
    }
    if (proj.storyAr.length < 200) {
      throw new BadRequestException('story must be at least 200 chars to submit for review');
    }
    if (proj.fundingGoalHalalas <= 0n) {
      throw new BadRequestException('fundingGoal must be positive');
    }
    return this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.UNDER_REVIEW },
    });
  }

  /** Admin: approves a project and starts the funding clock. */
  async publish(projectId: string): Promise<Project> {
    const proj = await this.findById(projectId);
    if (proj.status !== ProjectStatus.UNDER_REVIEW) {
      throw new BadRequestException(`only UNDER_REVIEW projects can publish (was ${proj.status})`);
    }
    const now = new Date();
    const deadline = new Date(now.getTime() + proj.durationDays * 86_400_000);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.LIVE, publishedAt: now, deadline },
    });
  }

  async findById(id: string): Promise<Project> {
    const proj = await this.prisma.project.findUnique({
      where: { id },
      include: { rewardTiers: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!proj) throw new NotFoundException('project not found');
    return proj;
  }

  async list(q: ListProjectsQueryDto): Promise<{ items: Project[]; nextCursor: string | null }> {
    const take = q.take ?? 20;
    const where: Prisma.ProjectWhereInput = {};

    if (q.category) where.category = q.category;
    if (q.status === 'live') where.status = ProjectStatus.LIVE;
    else if (q.status === 'successful') where.status = ProjectStatus.SUCCESSFUL;
    else if (q.status === 'funded') where.status = ProjectStatus.FUNDED;
    else
      where.status = {
        in: [ProjectStatus.LIVE, ProjectStatus.SUCCESSFUL, ProjectStatus.FUNDED],
      };

    if (q.includePartnered === false) where.platformPartner = { equals: Prisma.JsonNull };

    const orderBy: Prisma.ProjectOrderByWithRelationInput[] =
      q.sort === 'new'
        ? [{ publishedAt: 'desc' }, { createdAt: 'desc' }]
        : q.sort === 'ending_soon'
          ? [{ deadline: 'asc' }]
          : q.sort === 'most_funded'
            ? [{ raisedHalalas: 'desc' }]
            : [{ backersCount: 'desc' }, { raisedHalalas: 'desc' }];

    const items = await this.prisma.project.findMany({
      where,
      orderBy,
      take: take + 1,
      ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
    });
    const nextCursor = items.length > take ? items[take]!.id : null;
    return { items: items.slice(0, take), nextCursor };
  }

  toPublic(
    p: Project & { rewardTiers?: Array<Record<string, unknown>> },
  ): Record<string, unknown> {
    return {
      id: p.id,
      titleAr: p.titleAr,
      shortDescAr: p.shortDescAr,
      category: p.category,
      storyAr: p.storyAr,
      mediaUrls: p.mediaUrls,
      fundingGoalHalalas: Number(p.fundingGoalHalalas),
      releaseThresholdPct: p.releaseThresholdPct,
      durationDays: p.durationDays,
      deadline: p.deadline.toISOString(),
      status: p.status,
      productSpecAr: p.productSpecAr,
      expectedDeliveryDate: p.expectedDeliveryDate?.toISOString() ?? null,
      createdBy: p.createdById,
      raisedHalalas: Number(p.raisedHalalas),
      backersCount: p.backersCount,
      platformPartner: p.platformPartner,
      createdAt: p.createdAt.toISOString(),
      publishedAt: p.publishedAt?.toISOString() ?? null,
      rewardTiers: p.rewardTiers,
    };
  }

  private async requireOwned(creatorId: string, projectId: string): Promise<Project> {
    const proj = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!proj) throw new NotFoundException('project not found');
    if (proj.createdById !== creatorId) throw new ForbiddenException('not your project');
    return proj;
  }
}
