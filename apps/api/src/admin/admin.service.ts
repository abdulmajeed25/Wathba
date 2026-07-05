import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

  async approve(projectId: string): Promise<Project> {
    const proj = await this.requireUnderReview(projectId);
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
    return updated;
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
}
