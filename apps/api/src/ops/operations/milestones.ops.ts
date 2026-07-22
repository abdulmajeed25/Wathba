import { MilestoneStatus, NotificationKind } from '@prisma/client';
import { z } from 'zod';

import type { OperationDef } from '../operation.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { EmailService } from '../../email/email.service';

/**
 * Batch OPS-PRO Phase 1 — the reject half of milestone review (STANDARD).
 * money.milestone.approve moves SUBMITTED→APPROVED; there was no governed way
 * to bounce weak evidence back to the creator. This op is money-adjacent (it
 * mirrors the approve op's permission, money.execute) but moves no money — it
 * returns the milestone to PENDING, records the operator's feedback (which IS
 * the written reason), and clears the stale evidence so the creator must
 * resubmit fresh. Not reversible: the creator re-uploads and re-submits.
 */

export interface MilestonesOpsDeps {
  prisma: PrismaService;
  notifications: NotificationsService;
  email: EmailService;
}

/** ops.module.ts wires the real deps at boot; a bare call (or an afterCommit
 *  reached before wiring) fails loudly instead of silently no-oping. */
const UNWIRED_DEPS = new Proxy(
  {},
  {
    get(_t, prop) {
      throw new Error(`milestonesOps deps not wired yet (accessed .${String(prop)})`);
    },
  },
) as MilestonesOpsDeps;

export function milestonesOps(
  deps: MilestonesOpsDeps = UNWIRED_DEPS,
): Array<OperationDef<never, unknown>> {
  const rejectInput = z.object({
    projectId: z.string().uuid(),
    milestoneId: z.string().uuid(),
  });

  const evidenceReject: OperationDef<
    z.infer<typeof rejectInput>,
    { id: string; status: string }
  > = {
    key: 'milestones.evidence.reject',
    titleAr: 'رفض دليل مرحلة',
    descriptionAr:
      'يرفض دليل مرحلة قُدِّم (SUBMITTED→PENDING) دون صرف مال: يكتب ملاحظة المراجعة (وهي السبب المكتوب نفسه) للمبدع، ويمسح رابط الدليل وتاريخ التقديم كي يعيد المبدع الرفع والتقديم من جديد. غير قابل للعكس — المبدع يقدّم دليلاً جديداً.',
    inputSchema: rejectInput,
    permission: 'money.execute',
    riskTier: 'STANDARD',
    reversible: false,
    // The feedback shown to the creator IS the reason (min 10 chars, forced
    // by requiresReason — the registry enforces the length on execute).
    requiresReason: true,
    preconditions: [
      {
        code: 'project-missing',
        reasonAr: 'المشروع غير موجود',
        check: async (db, input) =>
          !!(await db.project.findUnique({ where: { id: input.projectId }, select: { id: true } })),
      },
      {
        code: 'milestone-missing',
        reasonAr: 'المرحلة غير موجودة على هذا المشروع',
        check: async (db, input) =>
          !!(await db.milestone.findFirst({
            where: { id: input.milestoneId, projectId: input.projectId },
            select: { id: true },
          })),
      },
      {
        code: 'not-submitted',
        reasonAr: 'المرحلة ليست بانتظار المراجعة (SUBMITTED) — لا يُرفض إلا دليلٌ مقدَّم',
        check: async (db, input) => {
          const m = await db.milestone.findFirst({
            where: { id: input.milestoneId, projectId: input.projectId },
            select: { status: true },
          });
          return m?.status === MilestoneStatus.SUBMITTED;
        },
      },
    ],
    async dryRun(db, input) {
      const m = await db.milestone.findFirst({
        where: { id: input.milestoneId, projectId: input.projectId },
        select: { titleAr: true, status: true, evidenceUrl: true },
      });
      return {
        summaryAr: `سيُرفض دليل المرحلة «${m?.titleAr ?? input.milestoneId}» ويعود إلى PENDING — يُطلب من المبدع إعادة التقديم`,
        before: { status: m?.status ?? null, evidenceUrl: m?.evidenceUrl ?? null },
        after: { status: MilestoneStatus.PENDING, evidenceUrl: null, submittedAt: null },
      };
    },
    async execute(tx, input, ctx) {
      const updated = await tx.milestone.update({
        where: { id: input.milestoneId },
        data: {
          status: MilestoneStatus.PENDING,
          reviewFeedbackAr: ctx.reason ?? null,
          evidenceUrl: null,
          submittedAt: null,
        },
      });
      const project = await tx.project.findUniqueOrThrow({
        where: { id: input.projectId },
        select: { createdById: true, titleAr: true },
      });
      return {
        id: updated.id,
        status: updated.status,
        creatorId: project.createdById,
        projectTitleAr: project.titleAr,
        milestoneTitleAr: updated.titleAr,
      } as { id: string; status: string };
    },
    async afterCommit(result, input, ctx) {
      const r = result as {
        creatorId?: string;
        projectTitleAr?: string;
        milestoneTitleAr?: string;
      };
      if (!r.creatorId) return;
      // No dedicated milestone-reject email template exists — notification
      // only (the feedback rides in the payload; reported as such).
      await deps.notifications.create({
        userId: r.creatorId,
        kind: NotificationKind.MILESTONE_REJECTED,
        payload: {
          projectId: input.projectId,
          projectTitleAr: r.projectTitleAr ?? null,
          milestoneTitleAr: r.milestoneTitleAr ?? null,
          feedbackAr: ctx.reason ?? null,
        },
      });
    },
  };

  return [evidenceReject] as unknown as Array<OperationDef<never, unknown>>;
}
