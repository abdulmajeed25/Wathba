import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import {
  NotificationKind,
  Prisma,
  ProjectStatus,
  type Project,
  type UserRole,
} from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
  ) {}

  /** Review queue — projects awaiting admin sign-off. */
  async reviewQueue(): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { status: ProjectStatus.UNDER_REVIEW },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approve(projectId: string, approvedDurationDays?: number): Promise<Project> {
    const proj = await this.requireUnderReview(projectId);
    // Batch PAY (Part 5) — tiered duration at the approval gate:
    //   ≤60d self-serve · 61–120d only with the explicit grant (AuditLogged
    //   upstream) · >120d BLOCKED IN CODE (LONG_DURATION — blocked pending
    //   legal counsel + capture-model decision; owner task).
    if (proj.durationDays > 120) {
      throw new BadRequestException('durations beyond 120 days are blocked (LONG_DURATION register)');
    }
    if (proj.durationDays > 60) {
      const grant = approvedDurationDays ?? proj.approvedDurationDays;
      if (!grant || grant < proj.durationDays) {
        throw new BadRequestException(
          `a ${proj.durationDays}-day campaign needs an explicit approvedDurationDays grant (61–120)`,
        );
      }
    }
    if (approvedDurationDays) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { approvedDurationDays },
      });
    }
    const now = new Date();
    // CC-20 — if the creator set a future launch time, enter SCHEDULED and let
    // the launch scheduler flip it LIVE at that time; otherwise go LIVE now.
    const scheduled = proj.scheduledLaunchAt && proj.scheduledLaunchAt.getTime() > now.getTime();
    const deadline = new Date(now.getTime() + proj.durationDays * 86_400_000);
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      // Clear any prior rejection feedback; stamp the review time (CC-04).
      data: scheduled
        ? { status: ProjectStatus.SCHEDULED, reviewFeedback: null, reviewedAt: now }
        : {
            status: ProjectStatus.LIVE,
            publishedAt: now,
            deadline,
            reviewFeedback: null,
            reviewedAt: now,
          },
    });
    await this.notifyReviewed(updated.createdById, projectId, 'approve', null);
    // STAKES/S-11 F-05 — went LIVE right now → tell the creator's followers.
    // (Scheduled launches fan out from the LaunchScheduler when they flip.)
    if (!scheduled) {
      this.notifications
        .fanOutProjectPublished(projectId)
        .catch((err) => this.logger.warn(`publish fan-out failed project=${projectId}: ${String(err)}`));
    }
    return updated;
  }

  /** Batch PAY — ops tool behind the audited controller route. */
  async overrideDeadline(projectId: string, deadline: Date): Promise<{ ok: true; deadline: string }> {
    await this.prisma.project.update({ where: { id: projectId }, data: { deadline } });
    return { ok: true, deadline: deadline.toISOString() };
  }

  /**
   * CC-04: persist the rejection reason (previously discarded) so the creator
   * can read it in the dashboard, then notify them. Status returns to DRAFT so
   * they can edit and resubmit.
   */
  async reject(projectId: string, reason: string | undefined): Promise<Project> {
    const proj = await this.requireUnderReview(projectId);
    const feedback = reason?.trim() ? reason.trim() : null;
    const updated = await this.prisma.project.update({
      where: { id: proj.id },
      data: {
        status: ProjectStatus.DRAFT,
        reviewFeedback: feedback,
        reviewedAt: new Date(),
      },
    });
    await this.notifyReviewed(updated.createdById, projectId, 'reject', feedback);
    return updated;
  }

  /** DB-backed notification to the creator on approve/reject (CC-04). */
  private async notifyReviewed(
    creatorId: string,
    projectId: string,
    decision: 'approve' | 'reject',
    reviewFeedback: string | null,
  ): Promise<void> {
    try {
      await this.notifications.create({
        userId: creatorId,
        kind: NotificationKind.PROJECT_REVIEWED,
        payload: {
          projectId,
          decision,
          reviewFeedback,
          deepLink: `/projects/dashboard/${projectId}/settings`,
        },
      });
      // STAKES follow-up (A) — email the creator the decision + feedback.
      const [creator, project] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: creatorId }, select: { email: true } }),
        this.prisma.project.findUnique({ where: { id: projectId }, select: { titleAr: true } }),
      ]);
      if (creator?.email && project) {
        await this.email.projectReviewed(creator.email, {
          projectTitle: project.titleAr,
          approved: decision === 'approve',
          feedback: reviewFeedback,
        });
      }
    } catch {
      /* never fail the review on a notification/email glitch */
    }
  }

  /**
   * §7 — set or clear the platform-partner marker. Mandatory disclosureAr
   * required when setting (≥ 20 chars validated by DTO).
   */
  async setPlatformPartner(
    projectId: string,
    value: { stakeType: 'equity' | 'profit-share' | 'co-founder'; disclosureAr: string } | null,
  ): Promise<Project> {
    const proj = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!proj) throw new NotFoundException('project not found');
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        platformPartner:
          value === null
            ? Prisma.JsonNull
            : ({
                isPartnered: true,
                stakeType: value.stakeType,
                disclosureAr: value.disclosureAr,
              } as unknown as Prisma.InputJsonValue),
      },
    });
  }

  /** Batch CAT — toggle the editorial "Projects We Love" flag (مختارات وثبة). */
  async setStaffPick(projectId: string, value: boolean): Promise<Project> {
    const proj = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!proj) throw new NotFoundException('project not found');
    return this.prisma.project.update({
      where: { id: projectId },
      data: { isStaffPick: value },
    });
  }

  async kycQueue(): Promise<Array<Record<string, unknown>>> {
    const users = await this.prisma.user.findMany({
      where: { nafathVerified: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  /** Sprint 3 / P0-302: additive role grant (idempotent). */
  async grantRole(
    userId: string,
    role: 'CREATOR' | 'BACKER' | 'SUPPLIER',
  ): Promise<{ roles: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('user not found');
    const roles = user.roles.includes(role as UserRole)
      ? user.roles
      : [...user.roles, role as UserRole];
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { roles },
    });
    return { roles: updated.roles };
  }

  async forceVerifyKyc(userId: string): Promise<{ verified: true }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { nafathVerified: true, nafathVerifiedAt: new Date() },
    });
    return { verified: true };
  }

  private async requireUnderReview(projectId: string): Promise<Project> {
    const proj = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!proj) throw new NotFoundException('project not found');
    if (proj.status !== ProjectStatus.UNDER_REVIEW) {
      throw new BadRequestException(`project must be UNDER_REVIEW (was ${proj.status})`);
    }
    return proj;
  }

  // ── STAKES/K2 K3 — moderation queue ─────────────────────────────────────

  /** Reported comments (not yet hidden) + open project reports, for the admin tab. */
  async moderationQueue(): Promise<{
    comments: Array<Record<string, unknown>>;
    projects: Array<Record<string, unknown>>;
  }> {
    const [comments, projectGroups] = await Promise.all([
      this.prisma.comment.findMany({
        where: { reportCount: { gt: 0 }, hidden: false },
        orderBy: { reportCount: 'desc' },
        take: 50,
        include: {
          user: { select: { name: true, handle: true } },
          project: { select: { id: true, titleAr: true } },
          reports: { select: { reasonAr: true }, take: 3, orderBy: { createdAt: 'desc' } },
        },
      }),
      this.prisma.projectReport.groupBy({
        by: ['projectId'],
        where: { resolvedAt: null },
        _count: { _all: true },
        orderBy: { _count: { projectId: 'desc' } },
        take: 50,
      }),
    ]);

    const projectRows = await this.prisma.project.findMany({
      where: { id: { in: projectGroups.map((g) => g.projectId) } },
      select: { id: true, titleAr: true, status: true },
    });
    const titleById = new Map(projectRows.map((p) => [p.id, p]));

    return {
      comments: comments.map((c) => ({
        id: c.id,
        projectId: c.projectId,
        projectTitleAr: c.project.titleAr,
        authorName: c.user.name,
        authorHandle: c.user.handle,
        bodyAr: c.bodyAr,
        reportCount: c.reportCount,
        reasons: c.reports.map((r) => r.reasonAr).filter(Boolean),
        date: c.date.toISOString(),
      })),
      projects: projectGroups.map((g) => ({
        projectId: g.projectId,
        titleAr: titleById.get(g.projectId)?.titleAr ?? '—',
        status: titleById.get(g.projectId)?.status ?? null,
        reportCount: g._count._all,
      })),
    };
  }

  /** hide = suppress the body publicly; dismiss = clear the flags, keep the comment. */
  async moderateComment(
    commentId: string,
    action: 'hide' | 'dismiss',
  ): Promise<{ ok: true; action: string }> {
    const c = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('comment not found');
    if (action === 'hide') {
      await this.prisma.comment.update({
        where: { id: commentId },
        data: { hidden: true },
      });
    } else {
      await this.prisma.$transaction([
        this.prisma.commentReport.deleteMany({ where: { commentId } }),
        this.prisma.comment.update({ where: { id: commentId }, data: { reportCount: 0 } }),
      ]);
    }
    return { ok: true, action };
  }

  /** Dismiss all open reports on a project (keeps rows for history via resolvedAt). */
  async dismissProjectReports(projectId: string): Promise<{ ok: true; resolved: number }> {
    const { count } = await this.prisma.projectReport.updateMany({
      where: { projectId, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
    return { ok: true, resolved: count };
  }
}
