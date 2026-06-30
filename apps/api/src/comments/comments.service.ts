import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationKind, PledgeStatus, type Comment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentDto, ListCommentsQueryDto } from './dto/comment.dto';

/**
 * Comments bounded context. Owns comment CRUD on a project (story tab) and the
 * creator-side moderation toggles (pin / hide). Only backers (users with a
 * CAPTURED pledge to the project) may post; the public list is open.
 *
 * Hidden comments are surfaced with a flag so the public render can replace
 * the body with a "removed" placeholder while keeping the thread shape stable.
 */
export interface PublicComment {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  isCreator: boolean;
  pinned: boolean;
  hidden: boolean;
  likeCount: number;
  bodyAr: string | null;
  parentId: string | null;
  date: string;
}

interface CommentWithUser extends Comment {
  user: { id: string; name: string };
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    projectId: string,
    q: ListCommentsQueryDto,
  ): Promise<{ items: PublicComment[]; nextCursor: string | null }> {
    // Ensure project exists (cheap select).
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('project not found');

    const take = Math.min(Math.max(q.take ?? 25, 1), 100);
    const parentId = q.parentId ?? null;

    // Pinned items are returned only on the FIRST page (no cursor) and only
    // for top-level requests. Pinned replies don't really make sense.
    const pinned: CommentWithUser[] =
      !q.cursor && parentId === null
        ? await this.prisma.comment.findMany({
            where: { projectId, parentId: null, pinned: true },
            orderBy: { pinnedAt: 'desc' },
            include: { user: { select: { id: true, name: true } } },
            take: 50,
          })
        : [];
    // Then the chronological feed (newest first), excluding the pinned ones
    // already shown above.
    const rest: CommentWithUser[] = await this.prisma.comment.findMany({
      where: {
        projectId,
        parentId,
        pinned: false,
        ...(q.cursor ? { id: { lt: q.cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: take + 1,
      include: { user: { select: { id: true, name: true } } },
    });

    let nextCursor: string | null = null;
    let page = rest;
    if (rest.length > take) {
      page = rest.slice(0, take);
      const last = page[page.length - 1];
      if (last) nextCursor = last.id;
    }

    const items: PublicComment[] = [...pinned, ...page].map((c) => this.toPublic(c));

    return { items, nextCursor };
  }

  async create(
    userId: string,
    projectId: string,
    dto: CreateCommentDto,
  ): Promise<PublicComment> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, createdById: true },
    });
    if (!project) throw new NotFoundException('project not found');

    // Eligibility: must have a CAPTURED pledge to this project, OR be the
    // creator themselves (so creators can always reply even before any pledge).
    if (userId !== project.createdById) {
      const eligible = await this.prisma.pledge.findFirst({
        where: { backerId: userId, projectId, status: PledgeStatus.CAPTURED },
        select: { id: true },
      });
      if (!eligible) {
        throw new ForbiddenException('فقط الداعمون يمكنهم التعليق');
      }
    }

    // Validate parent (must belong to same project) if reply.
    let parentRow: { id: string; userId: string } | null = null;
    if (dto.parentId) {
      parentRow = await this.prisma.comment.findFirst({
        where: { id: dto.parentId, projectId },
        select: { id: true, userId: true },
      });
      if (!parentRow) throw new NotFoundException('parent comment not found');
    }

    const created = await this.prisma.comment.create({
      data: {
        projectId,
        userId,
        bodyAr: dto.bodyAr,
        parentId: dto.parentId ?? null,
        isCreator: userId === project.createdById,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    // Reply notification — DB-backed outbox, fire-and-forget on failure
    // (we never want a notification glitch to fail the user's post).
    if (parentRow && parentRow.userId !== userId) {
      try {
        await this.notifications.create({
          userId: parentRow.userId,
          kind: NotificationKind.COMMENT_REPLY,
          payload: {
            projectId,
            commentId: created.id,
            parentCommentId: parentRow.id,
            byUserId: userId,
          },
        });
      } catch {
        /* swallow */
      }
    }

    return this.toPublic(created);
  }

  async togglePin(creatorId: string, commentId: string): Promise<PublicComment> {
    const c = await this.requireCreatorComment(creatorId, commentId);
    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        pinned: !c.pinned,
        pinnedAt: !c.pinned ? new Date() : null,
      },
      include: { user: { select: { id: true, name: true } } },
    });
    return this.toPublic(updated);
  }

  async toggleHide(creatorId: string, commentId: string): Promise<PublicComment> {
    const c = await this.requireCreatorComment(creatorId, commentId);
    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { hidden: !c.hidden },
      include: { user: { select: { id: true, name: true } } },
    });
    return this.toPublic(updated);
  }

  async remove(userId: string, commentId: string): Promise<{ ok: true }> {
    const c = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        userId: true,
        projectId: true,
        project: { select: { createdById: true } },
      },
    });
    if (!c) throw new NotFoundException('comment not found');
    if (c.userId !== userId && c.project.createdById !== userId) {
      throw new ForbiddenException('not allowed');
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
    return { ok: true };
  }

  /**
   * Loads the comment + its parent project, and asserts the calling user owns
   * the project (creator-only moderation actions).
   */
  private async requireCreatorComment(
    creatorId: string,
    commentId: string,
  ): Promise<Comment & { project: { createdById: string } }> {
    const c = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { project: { select: { createdById: true } } },
    });
    if (!c) throw new NotFoundException('comment not found');
    if (c.project.createdById !== creatorId) {
      throw new ForbiddenException('not your project');
    }
    return c;
  }

  private toPublic(c: CommentWithUser): PublicComment {
    return {
      id: c.id,
      projectId: c.projectId,
      userId: c.userId,
      userName: c.user.name,
      isCreator: c.isCreator,
      pinned: c.pinned,
      hidden: c.hidden,
      likeCount: c.likeCount,
      bodyAr: c.hidden ? null : c.bodyAr,
      parentId: c.parentId,
      date: c.date.toISOString(),
    };
  }
}
