import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppealKind,
  AppealStatus,
  NotificationKind,
  ProjectStatus,
  SuspensionKind,
  type Appeal,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import type { CreateAppealDto } from './dto/create-appeal.dto';

/**
 * Batch OPS-GAPS R1 — the PUBLIC appeal submission surface.
 *
 * This is the ONLY door a suspended/banned account (or a rejected-project
 * creator) may still open. It does no adjudication — that is the governed
 * appeals.claim / appeals.decide ops. Here we only:
 *   1. verify the appellant actually OWNS the decision being appealed,
 *   2. enforce ONE live appeal per decision (no re-litigation), and
 *   3. record the appeal + notify the appellant it was received.
 *
 * The row itself is the alert-worthy signal: the ops alerts center queries
 * open appeals (status SUBMITTED) — creating this row IS raising the flag.
 */

/** Arabic label for an existing appeal's status (refusal messages). */
const STATUS_AR: Record<AppealStatus, string> = {
  SUBMITTED: 'مُقدَّم',
  UNDER_REVIEW: 'قيد المراجعة',
  UPHELD: 'مرفوض (تم تأييد القرار الأصلي)',
  OVERTURNED: 'مقبول (نُقض القرار الأصلي)',
  PARTIALLY_GRANTED: 'مقبول جزئياً',
};

const KIND_AR: Record<AppealKind, string> = {
  ACCOUNT_BAN: 'حظر الحساب',
  PROJECT_REJECTION: 'رفض المشروع',
};

/** A prior appeal in one of these states blocks a new one: two are still
 *  open, and UPHELD means the decision was already re-examined and stands. */
const BLOCKING_STATUSES: AppealStatus[] = [
  AppealStatus.SUBMITTED,
  AppealStatus.UNDER_REVIEW,
  AppealStatus.UPHELD,
];

export interface MyAppealView {
  id: string;
  kind: AppealKind;
  status: AppealStatus;
  reasonAr: string;
  decisionReason: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}

@Injectable()
export class AppealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
  ) {}

  async submit(appellantId: string, dto: CreateAppealDto): Promise<Appeal> {
    const kind = dto.kind as AppealKind;

    // 1) Ownership — the appellant must own the decision being contested.
    await this.assertOwnership(appellantId, kind, dto.subjectId);

    // 2) One appeal per decision — refuse if an open or already-upheld appeal
    //    exists for this exact (kind, subject).
    const blocker = await this.prisma.appeal.findFirst({
      where: { kind, subjectId: dto.subjectId, status: { in: BLOCKING_STATUSES } },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });
    if (blocker) {
      throw new ConflictException(
        `لديك تظلّم سابق على هذا القرار حالته «${STATUS_AR[blocker.status]}» — لا يمكن تقديم تظلّم جديد`,
      );
    }

    // 3) Record + notify.
    const appeal = await this.prisma.appeal.create({
      data: {
        kind,
        subjectId: dto.subjectId,
        submittedById: appellantId,
        reasonAr: dto.reasonAr,
        status: AppealStatus.SUBMITTED,
      },
    });

    await this.notifications.create({
      userId: appellantId,
      kind: NotificationKind.APPEAL_RECEIVED,
      payload: { appealId: appeal.id, kind, deepLink: '/appeals/mine' },
    });
    const u = await this.prisma.user.findUnique({
      where: { id: appellantId },
      select: { email: true },
    });
    if (u?.email) {
      await this.email.appealReceived(u.email, { kindAr: KIND_AR[kind] });
    }

    return appeal;
  }

  async mine(appellantId: string): Promise<MyAppealView[]> {
    const rows = await this.prisma.appeal.findMany({
      where: { submittedById: appellantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        kind: true,
        status: true,
        reasonAr: true,
        decisionReason: true,
        createdAt: true,
        decidedAt: true,
      },
    });
    return rows;
  }

  /** The appellant must be the target of the ban / the creator of the rejected
   *  project, and the decision must actually be in force. */
  private async assertOwnership(
    appellantId: string,
    kind: AppealKind,
    subjectId: string,
  ): Promise<void> {
    if (kind === AppealKind.ACCOUNT_BAN) {
      if (subjectId !== appellantId) {
        throw new ForbiddenException('لا يمكنك التظلّم إلا عن حسابك أنت');
      }
      const user = await this.prisma.user.findUnique({
        where: { id: appellantId },
        select: { suspendedKind: true },
      });
      if (user?.suspendedKind !== SuspensionKind.BANNED) {
        throw new ForbiddenException('حسابك ليس محظوراً — لا يوجد قرار حظر للتظلّم عنه');
      }
      return;
    }

    // PROJECT_REJECTION — a rejected project sits in DRAFT with reviewFeedback
    // set (exactly how projects.review.reject leaves it), owned by the creator.
    const project = await this.prisma.project.findUnique({
      where: { id: subjectId },
      select: { createdById: true, status: true, reviewFeedback: true },
    });
    if (!project) {
      throw new NotFoundException('المشروع غير موجود');
    }
    if (project.createdById !== appellantId) {
      throw new ForbiddenException('لا يمكنك التظلّم إلا عن مشروعك أنت');
    }
    if (project.status !== ProjectStatus.DRAFT || !project.reviewFeedback) {
      throw new ForbiddenException('لا يوجد قرار رفض ساري على هذا المشروع للتظلّم عنه');
    }
  }
}
