import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationKind, PledgeStatus, UpdateVisibility, type ProjectUpdate } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateUpdateDto,
  ListUpdatesQueryDto,
  UpdateUpdateDto,
} from './dto/update.dto';

/**
 * Project Updates — numbered creator broadcasts (#1, #2…) that backers see in
 * the "التحديثات" tab. orderNum is auto-assigned (max+1) on create.
 *
 * CC-12 adds: pinned (floats to top), visibility (PUBLIC | BACKERS_ONLY —
 * CAPTURED backers only, policy §9), and scheduling (publishAt; the public list
 * hides updates until due and the fan-out fires when they go live).
 */
export interface PublicUpdate {
  id: string;
  projectId: string;
  orderNum: number;
  titleAr: string;
  bodyAr: string | null;
  likeCount: number;
  commentCount: number;
  date: string;
  pinned: boolean;
  visibility: UpdateVisibility;
  publishAt: string;
  /** true when publishAt is in the future (visible only to the owner). */
  scheduled: boolean;
  /** true when this is a backer-only update the viewer may not read. */
  locked: boolean;
}

@Injectable()
export class UpdatesService {
  private readonly logger = new Logger(UpdatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Is the viewer allowed to read backer-only content on this project? */
  private async isBacker(projectId: string, viewerId: string | undefined, ownerId: string): Promise<boolean> {
    if (!viewerId) return false;
    if (viewerId === ownerId) return true;
    const pledge = await this.prisma.pledge.findFirst({
      where: { projectId, backerId: viewerId, status: PledgeStatus.CAPTURED },
      select: { id: true },
    });
    return pledge !== null;
  }

  async list(
    projectId: string,
    q: ListUpdatesQueryDto,
    viewerId?: string,
  ): Promise<{ items: PublicUpdate[] }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, createdById: true },
    });
    if (!project) throw new NotFoundException('project not found');

    const isOwner = viewerId === project.createdById;
    const canSeeBackerOnly = await this.isBacker(projectId, viewerId, project.createdById);
    const take = Math.min(Math.max(q.take ?? 20, 1), 100);

    const items = await this.prisma.projectUpdate.findMany({
      where: {
        projectId,
        // Non-owners only see already-published updates; the owner sees drafts/
        // scheduled ones too (to manage them).
        ...(isOwner ? {} : { publishAt: { lte: new Date() } }),
      },
      orderBy: [{ pinned: 'desc' }, { orderNum: 'desc' }],
      take,
    });
    return { items: items.map((u) => this.toPublic(u, { isOwner, canSeeBackerOnly })) };
  }

  async getOne(projectId: string, updateId: string, viewerId?: string): Promise<PublicUpdate> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { createdById: true },
    });
    if (!project) throw new NotFoundException('project not found');
    const u = await this.prisma.projectUpdate.findFirst({ where: { id: updateId, projectId } });
    if (!u) throw new NotFoundException('update not found');

    const isOwner = viewerId === project.createdById;
    // A scheduled (not-yet-due) update is invisible to non-owners.
    if (!isOwner && u.publishAt.getTime() > Date.now()) throw new NotFoundException('update not found');
    const canSeeBackerOnly = await this.isBacker(projectId, viewerId, project.createdById);
    return this.toPublic(u, { isOwner, canSeeBackerOnly });
  }

  async create(
    creatorId: string,
    projectId: string,
    dto: CreateUpdateDto,
  ): Promise<PublicUpdate> {
    await this.requireCreator(creatorId, projectId);

    const top = await this.prisma.projectUpdate.findFirst({
      where: { projectId },
      orderBy: { orderNum: 'desc' },
      select: { orderNum: true },
    });
    const orderNum = (top?.orderNum ?? 0) + 1;
    const publishAt = dto.publishAt ? new Date(dto.publishAt) : new Date();
    const immediate = publishAt.getTime() <= Date.now();

    const created = await this.prisma.projectUpdate.create({
      data: {
        projectId,
        titleAr: dto.titleAr,
        bodyAr: dto.bodyAr,
        orderNum,
        visibility: dto.visibility ?? UpdateVisibility.PUBLIC,
        publishAt,
        // Immediate updates are notified now; scheduled ones by the tick.
        notifiedAt: immediate ? new Date() : null,
      },
    });

    // CC-01/CC-12 — fan out only when the update is actually live. Scheduled
    // updates fan out from the scheduler tick when they become due.
    if (immediate) {
      this.fanOutUpdatePosted(projectId, created).catch((err) =>
        this.logger.warn(`update fan-out failed for update=${created.id}: ${String(err)}`),
      );
    }

    return this.toPublic(created, { isOwner: true, canSeeBackerOnly: true });
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
        ...(dto.visibility !== undefined && { visibility: dto.visibility }),
      },
    });
    return this.toPublic(updated, { isOwner: true, canSeeBackerOnly: true });
  }

  /** CC-12 — toggle the pinned flag (only one meaningfully floats to top). */
  async togglePin(creatorId: string, projectId: string, updateId: string): Promise<PublicUpdate> {
    await this.requireCreator(creatorId, projectId);
    const existing = await this.prisma.projectUpdate.findFirst({
      where: { id: updateId, projectId },
      select: { id: true, pinned: true },
    });
    if (!existing) throw new NotFoundException('update not found');
    const updated = await this.prisma.projectUpdate.update({
      where: { id: updateId },
      data: { pinned: !existing.pinned, pinnedAt: !existing.pinned ? new Date() : null },
    });
    return this.toPublic(updated, { isOwner: true, canSeeBackerOnly: true });
  }

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
    return { ...this.toPublic(row, { isOwner: true, canSeeBackerOnly: true }), liked };
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

  /**
   * CC-01/CC-12 — fan out an UPDATE_POSTED notification. Recipients depend on
   * visibility: a PUBLIC update reaches CAPTURED/HELD backers ∪ creator
   * followers; a BACKERS_ONLY update reaches only CAPTURED backers (who alone
   * can read it). Deduped, creator excluded, idempotent per (updateId,userId)
   * via the dedupKey unique index; one batched createMany.
   */
  async fanOutUpdatePosted(
    projectId: string,
    update: Pick<ProjectUpdate, 'id' | 'titleAr' | 'visibility'>,
  ): Promise<{ notified: number }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { titleAr: true, createdById: true },
    });
    if (!project) return { notified: 0 };

    const backerStatuses =
      update.visibility === UpdateVisibility.BACKERS_ONLY
        ? [PledgeStatus.CAPTURED]
        : [PledgeStatus.CAPTURED, PledgeStatus.HELD];

    const backers = await this.prisma.pledge.findMany({
      where: { projectId, status: { in: backerStatuses } },
      select: { backerId: true },
      distinct: ['backerId'],
    });
    const followers =
      update.visibility === UpdateVisibility.BACKERS_ONLY
        ? []
        : await this.prisma.creatorFollow.findMany({
            where: { creatorProfile: { userId: project.createdById } },
            select: { followerId: true },
          });

    const recipients = new Set<string>();
    for (const b of backers) recipients.add(b.backerId);
    for (const f of followers) recipients.add(f.followerId);
    recipients.delete(project.createdById);
    if (recipients.size === 0) return { notified: 0 };

    // STAKES/E2 — drop recipients who opted out of project-update notifications.
    const allowed = await this.notifications.filterAllowed(
      [...recipients],
      'projectUpdates',
    );
    if (allowed.length === 0) return { notified: 0 };

    const deepLink = `/projects/${projectId}/updates/${update.id}`;
    const data = allowed.map((userId) => ({
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
    this.logger.log(`update=${update.id} fan-out notified=${count} recipients=${recipients.size} optedIn=${allowed.length}`);
    return { notified: count };
  }

  /**
   * CC-12 — publish scheduled updates whose time has come: fire the deferred
   * fan-out and stamp notifiedAt. Called by the scheduler tick. Idempotent
   * (notifiedAt guard + dedupKey).
   */
  async publishDueUpdates(): Promise<{ published: number }> {
    const due = await this.prisma.projectUpdate.findMany({
      where: { notifiedAt: null, publishAt: { lte: new Date() } },
      select: { id: true, projectId: true, titleAr: true, visibility: true },
      take: 100,
    });
    let published = 0;
    for (const u of due) {
      try {
        await this.fanOutUpdatePosted(u.projectId, u);
        await this.prisma.projectUpdate.update({
          where: { id: u.id },
          data: { notifiedAt: new Date() },
        });
        published++;
      } catch (err) {
        this.logger.warn(`scheduled fan-out failed for update=${u.id}: ${String(err)}`);
      }
    }
    return { published };
  }

  private async requireCreator(creatorId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { createdById: true },
    });
    if (!project) throw new NotFoundException('project not found');
    if (project.createdById === creatorId) return;
    // CC-24 — a project collaborator also gets content access to updates.
    const collab = await this.prisma.projectCollaborator.findUnique({
      where: { projectId_userId: { projectId, userId: creatorId } },
      select: { id: true },
    });
    if (!collab) throw new ForbiddenException('not your project');
  }

  private toPublic(
    u: ProjectUpdate,
    ctx: { isOwner: boolean; canSeeBackerOnly: boolean },
  ): PublicUpdate {
    const locked = u.visibility === UpdateVisibility.BACKERS_ONLY && !ctx.canSeeBackerOnly;
    return {
      id: u.id,
      projectId: u.projectId,
      orderNum: u.orderNum,
      titleAr: u.titleAr,
      // Backer-only body is withheld from non-backers; title stays visible.
      bodyAr: locked ? null : u.bodyAr,
      likeCount: u.likeCount,
      commentCount: u.commentCount,
      date: u.date.toISOString(),
      pinned: u.pinned,
      visibility: u.visibility,
      publishAt: u.publishAt.toISOString(),
      scheduled: u.publishAt.getTime() > Date.now(),
      locked,
    };
  }
}
