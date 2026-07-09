import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationKind, PledgeStatus, Prisma, type Comment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentDto, ListCommentsQueryDto } from './dto/comment.dto';

/**
 * Comments bounded context. Owns comment CRUD on a project (story tab) and the
 * creator-side moderation toggles (pin / hide). Only backers (users with a
 * HELD/CAPTURED pledge to the project) may post; the public list is open.
 *
 * Hidden comments are surfaced with a flag so the public render can replace
 * the body with a "removed" placeholder while keeping the thread shape stable.
 */
export interface PublicComment {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  /** STAKES/C10 — lets the web link the author to /u/[handle] + show the avatar. */
  userHandle: string | null;
  userAvatarUrl: string | null;
  isCreator: boolean;
  pinned: boolean;
  hidden: boolean;
  likeCount: number;
  reportCount: number;
  bodyAr: string | null;
  parentId: string | null;
  /** STAKES/K1 — non-null once the author edited within the window. */
  editedAt: string | null;
  date: string;
}

interface CommentWithUser extends Comment {
  user: { id: string; name: string; handle: string | null; avatarUrl: string | null };
}

/** STAKES/K1 — the author may edit their comment for this long after posting. */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

/** STAKES/K5 — per-user posting budget (in-memory, same v1 posture as the
 *  auth lockout: one API instance handles all traffic today). */
const SPAM_MAX_PER_WINDOW = 5;
const SPAM_WINDOW_MS = 60 * 1000;
/** Seed wordlist; extend via BLOCKED_WORDS (comma-separated) without a deploy. */
const BLOCKED_WORDS = ['viagra', 'casino', 'porn', 'xxx']
  .concat((process.env.BLOCKED_WORDS ?? '').split(',').map((w) => w.trim().toLowerCase()))
  .filter(Boolean);

@Injectable()
export class CommentsService {
  /** STAKES/K5 — sliding-window post timestamps per user. */
  private readonly recentPosts = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** STAKES/K5 — profanity/spam + rate-limit guard, run before any DB write. */
  private assertNotSpam(userId: string, bodyAr: string): void {
    const lower = bodyAr.toLowerCase();
    if (BLOCKED_WORDS.some((w) => lower.includes(w))) {
      throw new BadRequestException('التعليق يخالف إرشادات المجتمع — عدّل النص وحاول مجدداً');
    }
    const now = Date.now();
    const stamps = (this.recentPosts.get(userId) ?? []).filter(
      (t) => now - t < SPAM_WINDOW_MS,
    );
    if (stamps.length >= SPAM_MAX_PER_WINDOW) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'تعليقات كثيرة خلال دقيقة — انتظر قليلاً ثم حاول مجدداً',
          retryAfter: Math.ceil((SPAM_WINDOW_MS - (now - stamps[0]!)) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    stamps.push(now);
    this.recentPosts.set(userId, stamps);
  }

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
            include: { user: { select: { id: true, name: true, handle: true, avatarUrl: true } } },
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
      include: { user: { select: { id: true, name: true, handle: true, avatarUrl: true } } },
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
    // STAKES/K5 — wordlist + per-user rate guard before any DB work.
    this.assertNotSpam(userId, dto.bodyAr);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, createdById: true },
    });
    if (!project) throw new NotFoundException('project not found');

    // STAKES/S-12 F-11 — the BASELINE identity tier: commenting requires a
    // verified email (existing accounts were grandfathered by migration 0035).
    const commenter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true },
    });
    if (!commenter?.emailVerified) {
      throw new ForbiddenException('فعّل بريدك الإلكتروني أولاً لتتمكن من التعليق');
    }

    // Eligibility: a backer (HELD or CAPTURED pledge) OR the creator.
    // STAKES/S-11 — was CAPTURED-only, but capture happens at campaign
    // SUCCESS, so during a live campaign nobody but the creator could
    // comment at all. HELD money is a real commitment (same rule the
    // update fan-out uses for who counts as a backer).
    if (userId !== project.createdById) {
      const eligible = await this.prisma.pledge.findFirst({
        where: {
          backerId: userId,
          projectId,
          status: { in: [PledgeStatus.HELD, PledgeStatus.CAPTURED] },
        },
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
      include: { user: { select: { id: true, name: true, handle: true, avatarUrl: true } } },
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
            // STAKES/S-11 F-18 (C10) — actor identity so the notification
            // can link the replier's name to their public profile.
            byName: created.user.name,
            byHandle: created.user.handle,
          },
        });
      } catch {
        /* swallow */
      }
    }

    return this.toPublic(created);
  }

  /**
   * STAKES/K1 — the author edits their own comment within EDIT_WINDOW_MS.
   * Sets editedAt so the UI can show "(معدّل)". Hidden comments can't be
   * edited (moderation wins); replies and top-level behave the same.
   */
  async edit(
    userId: string,
    commentId: string,
    bodyAr: string,
  ): Promise<PublicComment> {
    this.assertNotSpam(userId, bodyAr);
    const c = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, hidden: true, date: true },
    });
    if (!c) throw new NotFoundException('comment not found');
    if (c.userId !== userId) throw new ForbiddenException('not your comment');
    if (c.hidden) throw new ForbiddenException('comment is hidden');
    if (Date.now() - c.date.getTime() > EDIT_WINDOW_MS) {
      throw new ForbiddenException('انتهت مهلة التعديل (١٥ دقيقة من النشر)');
    }
    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { bodyAr, editedAt: new Date() },
      include: { user: { select: { id: true, name: true, handle: true, avatarUrl: true } } },
    });
    return this.toPublic(updated);
  }

  /**
   * CC-23 — a user flags a comment. Unique per (comment, reporter) so the count
   * can't be inflated; the materialised reportCount surfaces flagged comments to
   * the creator's moderation queue. Idempotent (re-report is a no-op).
   */
  async report(
    userId: string,
    commentId: string,
    reasonAr?: string,
  ): Promise<{ reported: true; alreadyReported?: boolean }> {
    const c = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('comment not found');
    try {
      await this.prisma.$transaction([
        this.prisma.commentReport.create({
          data: { commentId, reporterId: userId, reasonAr: reasonAr ?? null },
        }),
        this.prisma.comment.update({
          where: { id: commentId },
          data: { reportCount: { increment: 1 } },
        }),
      ]);
      return { reported: true };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { reported: true, alreadyReported: true };
      }
      throw e;
    }
  }

  async togglePin(creatorId: string, commentId: string): Promise<PublicComment> {
    const c = await this.requireCreatorComment(creatorId, commentId);
    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        pinned: !c.pinned,
        pinnedAt: !c.pinned ? new Date() : null,
      },
      include: { user: { select: { id: true, name: true, handle: true, avatarUrl: true } } },
    });
    return this.toPublic(updated);
  }

  async toggleHide(creatorId: string, commentId: string): Promise<PublicComment> {
    const c = await this.requireCreatorComment(creatorId, commentId);
    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { hidden: !c.hidden },
      include: { user: { select: { id: true, name: true, handle: true, avatarUrl: true } } },
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
      userHandle: c.user.handle,
      userAvatarUrl: c.user.avatarUrl,
      isCreator: c.isCreator,
      pinned: c.pinned,
      hidden: c.hidden,
      likeCount: c.likeCount,
      reportCount: c.reportCount,
      bodyAr: c.hidden ? null : c.bodyAr,
      parentId: c.parentId,
      editedAt: c.editedAt ? c.editedAt.toISOString() : null,
      date: c.date.toISOString(),
    };
  }
}
