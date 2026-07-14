import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectStatus, type Project } from '@prisma/client';
import { maskEmail, maskPhone } from '../ops/pii';

/**
 * OPS Part 0 — this service is READ-ONLY now. Every mutation it used to own
 * (approve/reject, deadline override, partner/staff-pick flags, role grant,
 * KYC force-verify, comment/report moderation) moved into the operations
 * registry (src/ops) where preconditions, the transaction, the audit row and
 * idempotency are enforced in one place. Queues + projections stay here.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Review queue — projects awaiting admin sign-off. */
  async reviewQueue(): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { status: ProjectStatus.UNDER_REVIEW },
      orderBy: { createdAt: 'asc' },
    });
  }

  async kycQueue(): Promise<Array<Record<string, unknown>>> {
    const users = await this.prisma.user.findMany({
      where: { nafathVerified: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    // Part 2 — PDPL: PII is masked by default on every admin surface;
    // revealing a value goes through the users.pii.unmask operation.
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: maskEmail(u.email),
      phone: maskPhone(u.phone),
      createdAt: u.createdAt.toISOString(),
    }));
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


}
