import { NotificationKind, Prisma, ProjectStatus } from '@prisma/client';
import { z } from 'zod';

import type { OperationDef } from '../operation.types';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { EmailService } from '../../email/email.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SettingsService } from '../../settings/settings.service';

/**
 * OPS Part 0 — project review + curation operations (STANDARD tier).
 * Logic lifted 1:1 from the pre-ops AdminService mutation methods; the
 * mutations now run inside the registry's transaction with the audit row.
 */

export interface ProjectsOpsDeps {
  prisma: PrismaService;
  notifications: NotificationsService;
  email: EmailService;
  /// CLOSEOUT C1 — review duration limits are settings-driven, not hardcoded.
  settings: SettingsService;
}

const DAY_MS = 86_400_000;

async function notifyReviewed(
  deps: ProjectsOpsDeps,
  creatorId: string,
  projectId: string,
  decision: 'approve' | 'reject',
  reviewFeedback: string | null,
): Promise<void> {
  await deps.notifications.create({
    userId: creatorId,
    kind: NotificationKind.PROJECT_REVIEWED,
    payload: {
      projectId,
      decision,
      reviewFeedback,
      deepLink: `/projects/dashboard/${projectId}/settings`,
    },
  });
  const [creator, project] = await Promise.all([
    deps.prisma.user.findUnique({ where: { id: creatorId }, select: { email: true } }),
    deps.prisma.project.findUnique({ where: { id: projectId }, select: { titleAr: true } }),
  ]);
  if (creator?.email && project) {
    await deps.email.projectReviewed(creator.email, {
      projectTitle: project.titleAr,
      approved: decision === 'approve',
      feedback: reviewFeedback,
    });
  }
}

export function projectsOps(deps: ProjectsOpsDeps): Array<OperationDef<never, unknown>> {
  const approveInput = z.object({
    projectId: z.string().uuid(),
    approvedDurationDays: z.number().int().min(61).max(120).optional(),
  });

  const approve: OperationDef<z.infer<typeof approveInput>, { id: string; status: string }> = {
    key: 'projects.review.approve',
    titleAr: 'اعتماد مشروع',
    descriptionAr:
      'ينقل مشروعاً من المراجعة إلى النشر (LIVE فوراً أو SCHEDULED لموعد الإطلاق المحدد). يمسح ملاحظات الرفض السابقة ويُخطر المبدع.',
    inputSchema: approveInput,
    permission: 'projects.review',
    riskTier: 'STANDARD',
    reversible: true,
    compensatingKey: 'projects.review.reject',
    requiresReason: false,
    preconditions: [
      {
        code: 'not-under-review',
        reasonAr: 'المشروع ليس في حالة المراجعة (UNDER_REVIEW)',
        check: async (db, input) => {
          const p = await db.project.findUnique({ where: { id: input.projectId } });
          return p?.status === ProjectStatus.UNDER_REVIEW;
        },
      },
      // CLOSEOUT C1 — both duration limits were HARDCODED (120 / 60) while the
      // settings catalog exposed projects.durationHardMaxDays and
      // projects.durationSelfServeMaxDays as tunable but unread (census: the
      // self-serve key was catalog-only). They are now read from settings, so
      // changing the setting actually changes review behaviour.
      {
        code: 'long-duration-blocked',
        reasonAr:
          'المدة تتجاوز الحد الأقصى الصلب المسموح (projects.durationHardMaxDays) — محظورة بانتظار الرأي القانوني',
        check: async (db, input) => {
          const p = await db.project.findUnique({ where: { id: input.projectId } });
          if (!p) return true;
          return p.durationDays <= (await deps.settings.get('projects.durationHardMaxDays'));
        },
      },
      {
        code: 'duration-grant-required',
        reasonAr:
          'حملة أطول من حد الخدمة الذاتية (projects.durationSelfServeMaxDays) تتطلب منح approvedDurationDays صريحاً لا يقل عن مدة الحملة',
        check: async (db, input) => {
          const p = await db.project.findUnique({ where: { id: input.projectId } });
          if (!p) return true;
          const selfServeMax = await deps.settings.get('projects.durationSelfServeMaxDays');
          if (p.durationDays <= selfServeMax) return true;
          const grant = input.approvedDurationDays ?? p.approvedDurationDays;
          return !!grant && grant >= p.durationDays;
        },
      },
    ],
    async dryRun(db, input) {
      const p = await db.project.findUnique({ where: { id: input.projectId } });
      if (!p) return { summaryAr: 'المشروع غير موجود', before: null, after: null };
      const now = Date.now();
      const scheduled = !!p.scheduledLaunchAt && p.scheduledLaunchAt.getTime() > now;
      const to = scheduled ? 'SCHEDULED' : 'LIVE';
      return {
        summaryAr: `سيُعتمد «${p.titleAr}» وينتقل إلى ${to}${scheduled ? '' : ` بموعد إغلاق بعد ${p.durationDays} يوماً`}`,
        before: { status: p.status, reviewFeedback: p.reviewFeedback },
        after: {
          status: to,
          reviewFeedback: null,
          ...(scheduled ? {} : { deadline: new Date(now + p.durationDays * DAY_MS).toISOString() }),
        },
      };
    },
    async execute(tx, input) {
      const p = await tx.project.findUniqueOrThrow({ where: { id: input.projectId } });
      const now = new Date();
      const scheduled = !!p.scheduledLaunchAt && p.scheduledLaunchAt.getTime() > now.getTime();
      const updated = await tx.project.update({
        where: { id: input.projectId },
        data: {
          ...(input.approvedDurationDays ? { approvedDurationDays: input.approvedDurationDays } : {}),
          ...(scheduled
            ? { status: ProjectStatus.SCHEDULED, reviewFeedback: null, reviewedAt: now }
            : {
                status: ProjectStatus.LIVE,
                publishedAt: now,
                deadline: new Date(now.getTime() + p.durationDays * DAY_MS),
                reviewFeedback: null,
                reviewedAt: now,
              }),
        },
      });
      return { id: updated.id, status: updated.status, createdById: updated.createdById } as {
        id: string;
        status: string;
      };
    },
    async afterCommit(result, input) {
      const r = result as { id: string; status: string; createdById?: string };
      const creatorId =
        r.createdById ??
        (await deps.prisma.project.findUniqueOrThrow({
          where: { id: input.projectId },
          select: { createdById: true },
        })).createdById;
      await notifyReviewed(deps, creatorId, input.projectId, 'approve', null);
      if (r.status === 'LIVE') {
        // Went LIVE right now → tell the creator's followers (scheduled
        // launches fan out from the LaunchScheduler when they flip).
        await deps.notifications.fanOutProjectPublished(input.projectId);
      }
    },
  };

  const rejectInput = z.object({
    projectId: z.string().uuid(),
    feedbackAr: z.string().trim().min(1).max(2000).optional(),
  });

  const reject: OperationDef<z.infer<typeof rejectInput>, { id: string; status: string }> = {
    key: 'projects.review.reject',
    titleAr: 'رفض مشروع (مع ملاحظات للمبدع)',
    descriptionAr:
      'يعيد المشروع إلى المسودة مع حفظ ملاحظات الرفض ليقرأها المبدع في لوحته ويعدّل ويعيد التقديم.',
    inputSchema: rejectInput,
    permission: 'projects.review',
    riskTier: 'STANDARD',
    reversible: true,
    compensatingKey: 'projects.review.approve',
    // Rejection always carries a written reason — delivered to the creator.
    requiresReason: true,
    preconditions: [
      {
        code: 'not-under-review',
        reasonAr: 'المشروع ليس في حالة المراجعة (UNDER_REVIEW)',
        check: async (db, input) => {
          const p = await db.project.findUnique({ where: { id: input.projectId } });
          return p?.status === ProjectStatus.UNDER_REVIEW;
        },
      },
    ],
    async dryRun(db, input, ctx) {
      const p = await db.project.findUnique({ where: { id: input.projectId } });
      if (!p) return { summaryAr: 'المشروع غير موجود', before: null, after: null };
      return {
        summaryAr: `سيُرفض «${p.titleAr}» ويعود إلى المسودة مع الملاحظات المكتوبة`,
        before: { status: p.status, reviewFeedback: p.reviewFeedback },
        after: { status: 'DRAFT', reviewFeedback: input.feedbackAr ?? ctx.reason ?? null },
      };
    },
    async execute(tx, input, ctx) {
      const feedback = (input.feedbackAr ?? ctx.reason ?? '').trim() || null;
      const updated = await tx.project.update({
        where: { id: input.projectId },
        // Batch ACCOUNT — rejectedAt is written HERE because rejection is not a
        // status: the project goes back to DRAFT carrying reviewFeedback, so
        // without this column the only record of WHEN it was rejected is an
        // AuditLog row, and a cooldown cannot be counted from a log entry.
        // reviewedAt is not a substitute — it also moves on approval.
        data: {
          status: ProjectStatus.DRAFT,
          reviewFeedback: feedback,
          reviewedAt: new Date(),
          rejectedAt: new Date(),
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        createdById: updated.createdById,
        feedback,
      } as { id: string; status: string };
    },
    async afterCommit(result, input) {
      const r = result as { createdById?: string; feedback?: string | null };
      const creatorId =
        r.createdById ??
        (await deps.prisma.project.findUniqueOrThrow({
          where: { id: input.projectId },
          select: { createdById: true },
        })).createdById;
      await notifyReviewed(deps, creatorId, input.projectId, 'reject', r.feedback ?? null);
    },
  };

  const staffPickInput = z.object({ projectId: z.string().uuid(), value: z.boolean() });
  const staffPick: OperationDef<z.infer<typeof staffPickInput>, { id: string; isStaffPick: boolean }> = {
    key: 'projects.staff-pick.set',
    titleAr: 'تمييز «مختارات وثبة»',
    descriptionAr: 'يضبط أو يزيل شارة مختارات وثبة (تغذي الاكتشاف والرئيسية).',
    inputSchema: staffPickInput,
    permission: 'projects.feature',
    riskTier: 'STANDARD',
    reversible: true,
    compensatingKey: 'projects.staff-pick.set',
    requiresReason: false,
    preconditions: [
      {
        code: 'project-missing',
        reasonAr: 'المشروع غير موجود',
        check: async (db, input) =>
          !!(await db.project.findUnique({ where: { id: input.projectId }, select: { id: true } })),
      },
    ],
    async dryRun(db, input) {
      const p = await db.project.findUnique({ where: { id: input.projectId } });
      return {
        summaryAr: input.value
          ? `سيُميَّز «${p?.titleAr ?? input.projectId}» ضمن مختارات وثبة`
          : `سيُزال «${p?.titleAr ?? input.projectId}» من مختارات وثبة`,
        before: { isStaffPick: p?.isStaffPick ?? null },
        after: { isStaffPick: input.value },
      };
    },
    async execute(tx, input) {
      const updated = await tx.project.update({
        where: { id: input.projectId },
        data: { isStaffPick: input.value },
      });
      return { id: updated.id, isStaffPick: updated.isStaffPick };
    },
  };

  const partnerInput = z.object({
    projectId: z.string().uuid(),
    value: z
      .object({
        stakeType: z.enum(['equity', 'profit-share', 'co-founder']),
        disclosureAr: z.string().trim().min(20),
      })
      .nullable(),
  });
  const platformPartner: OperationDef<z.infer<typeof partnerInput>, { id: string }> = {
    key: 'projects.platform-partner.set',
    titleAr: 'وسم شراكة وثبة (§7)',
    descriptionAr:
      'يضبط أو يزيل وسم الشراكة مع نص الإفصاح الإلزامي (٢٠ حرفاً على الأقل عند الضبط).',
    inputSchema: partnerInput,
    permission: 'projects.feature',
    riskTier: 'STANDARD',
    reversible: true,
    compensatingKey: 'projects.platform-partner.set',
    requiresReason: false,
    preconditions: [
      {
        code: 'project-missing',
        reasonAr: 'المشروع غير موجود',
        check: async (db, input) =>
          !!(await db.project.findUnique({ where: { id: input.projectId }, select: { id: true } })),
      },
    ],
    async dryRun(db, input) {
      const p = await db.project.findUnique({ where: { id: input.projectId } });
      return {
        summaryAr: input.value
          ? `سيُوسم «${p?.titleAr}» بشراكة وثبة (${input.value.stakeType}) مع الإفصاح`
          : `سيُزال وسم الشراكة عن «${p?.titleAr}»`,
        before: { platformPartner: (p?.platformPartner as unknown) ?? null },
        after: { platformPartner: input.value },
      };
    },
    async execute(tx, input) {
      const updated = await tx.project.update({
        where: { id: input.projectId },
        data: {
          platformPartner:
            input.value === null
              ? Prisma.JsonNull
              : ({
                  isPartnered: true,
                  stakeType: input.value.stakeType,
                  disclosureAr: input.value.disclosureAr,
                } as unknown as Prisma.InputJsonValue),
        },
      });
      return { id: updated.id };
    },
  };

  return [approve, reject, staffPick, platformPartner] as unknown as Array<
    OperationDef<never, unknown>
  >;
}
