import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PledgeStatus, ProjectStatus } from '@prisma/client';

/**
 * PDPL data-subject rights (Sprint 2 / P0-702).
 *
 * - `exportData`: right of access — every row we hold about the user,
 *   serialized to a single JSON document.
 * - `eraseAccount`: right of erasure — ANONYMIZES the user row (PII nulled,
 *   login disabled) while retaining financial records (pledges, payouts,
 *   ledger) which KSA commercial/AML retention rules require us to keep.
 *   Refused while the user still has money in flight (HELD pledges) or is
 *   running an active campaign.
 */
@Injectable()
export class PdplService {
  private readonly logger = new Logger(PdplService.name);

  constructor(private readonly prisma: PrismaService) {}

  async exportData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        addresses: true,
        creatorProfile: true,
      },
    });
    if (!user) throw new NotFoundException('user not found');

    const [pledges, projects, comments, notifications, payouts, bids, follows, faqQuestions] =
      await Promise.all([
        this.prisma.pledge.findMany({ where: { backerId: userId } }),
        this.prisma.project.findMany({ where: { createdById: userId } }),
        this.prisma.comment.findMany({ where: { userId } }),
        this.prisma.notification.findMany({ where: { userId } }),
        this.prisma.payout.findMany({ where: { creatorId: userId } }),
        this.prisma.supplierBid.findMany({ where: { supplierId: userId } }),
        this.prisma.creatorFollow.findMany({ where: { followerId: userId } }),
        this.prisma.faqQuestion.findMany({ where: { askerId: userId } }),
      ]);

    const { passwordHash: _drop, ...profile } = user;
    return serializeBigints({
      exportedAt: new Date().toISOString(),
      pdplNote:
        'هذه نسخة كاملة من بياناتك المخزنة لدى وثبة وفق نظام حماية البيانات الشخصية (PDPL).',
      profile,
      pledges,
      projects,
      comments,
      notifications,
      payouts,
      supplierBids: bids,
      follows,
      faqQuestions,
    });
  }

  async eraseAccount(userId: string): Promise<{ erased: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('user not found');

    const heldPledges = await this.prisma.pledge.count({
      where: { backerId: userId, status: PledgeStatus.HELD },
    });
    if (heldPledges > 0) {
      throw new ConflictException(
        `${heldPledges} pledge(s) still in escrow — erasure is available after the campaigns settle`,
      );
    }
    const activeProjects = await this.prisma.project.count({
      where: {
        createdById: userId,
        status: {
          in: [
            ProjectStatus.UNDER_REVIEW,
            ProjectStatus.LIVE,
            ProjectStatus.SUCCESSFUL,
            ProjectStatus.FUNDED,
            ProjectStatus.IN_PRODUCTION,
          ],
        },
      },
    });
    if (activeProjects > 0) {
      throw new ConflictException(
        `${activeProjects} active campaign(s) — hand over or complete them before erasure`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Anonymize the identity row; financial rows keep their FK to the
      // now-anonymous shell (AML/commercial retention).
      await tx.user.update({
        where: { id: userId },
        data: {
          name: 'مستخدم محذوف',
          email: `erased-${userId}@erased.wathba.sa`,
          phone: null,
          passwordHash: null, // disables sign-in permanently
          nafathVerified: false,
          nafathVerifiedAt: null,
          consentVersion: null,
          consentAt: null,
        },
      });
      // Drop PII satellites outright.
      await tx.address.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.creatorFollow.deleteMany({ where: { followerId: userId } });
    });

    this.logger.log(`PDPL erasure completed user=${userId} (anonymized, financial rows retained)`);
    return { erased: true };
  }
}

/** JSON.stringify chokes on BigInt — stringify money fields recursively. */
function serializeBigints<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)),
  ) as T;
}
