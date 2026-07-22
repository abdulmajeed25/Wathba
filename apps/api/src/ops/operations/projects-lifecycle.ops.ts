import { NotificationKind, PledgeStatus, ProjectStatus } from '@prisma/client';
import { z } from 'zod';

import type { OperationDef } from '../operation.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { EscrowService } from '../../escrow-payments/escrow.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { EmailService } from '../../email/email.service';

/**
 * OPS-PRO Phase 1 — project-lifecycle operations that are the ADMIN variants
 * of FundingService's creator paths, minus the creator-ownership check:
 *
 *  · projects.force-close — the operator's cancelCampaign for a LIVE/PAUSED/
 *    UNDER_REVIEW/SCHEDULED campaign: atomic claim → FAILED, then the whole-
 *    project refund sweep (EscrowService.adminRefundProject). A terminal or
 *    FUNDED campaign cannot be force-closed — its money already settled.
 *  · projects.pause.admin / projects.unpause.admin — the operator's pause/
 *    resume. An operator pause is a SAFETY action, so it BYPASSES the creator
 *    7-day cumulative cap (pauseCampaign enforces it; we don't). unpause is
 *    the registered compensator, accruing paused time exactly like the creator
 *    path so the two surfaces never disagree on the accrued total.
 *
 * projects.ops.ts (review/curation) is untouched — this is a NEW file with
 * its own factory so the coordinator wires deps independently.
 */

export interface ProjectsLifecycleOpsDeps {
  prisma: PrismaService;
  escrow: EscrowService;
  notifications: NotificationsService;
  email: EmailService;
}

/** The states a live-or-earlier campaign can be force-closed from. FUNDED /
 *  SUCCESSFUL / IN_PRODUCTION / terminal states have settled money and are
 *  out of reach here. */
const CLOSEABLE: ProjectStatus[] = [
  ProjectStatus.LIVE,
  ProjectStatus.PAUSED,
  ProjectStatus.UNDER_REVIEW,
  ProjectStatus.SCHEDULED,
];

/** Pledge states whose money is still refundable (mirror of the escrow sweep). */
const REFUNDABLE: PledgeStatus[] = [
  PledgeStatus.HELD,
  PledgeStatus.PENDING_REAUTH,
  PledgeStatus.CAPTURED,
];

export function projectsLifecycleOps(
  deps: ProjectsLifecycleOpsDeps,
): Array<OperationDef<never, unknown>> {
  const projectRef = z.object({ projectId: z.string().uuid() });

  /* ── force-close (orchestrated — drives the refund sweep via the PSP) ── */
  const forceClose: OperationDef<
    z.infer<typeof projectRef>,
    { closed: boolean; refunded: number; failed: number; totalHalalas: string }
  > = {
    key: 'projects.force-close',
    titleAr: 'إغلاق قسري لمشروع',
    descriptionAr:
      'النسخة الإدارية من إلغاء الحملة (بلا شرط ملكية المبدع): يطالب بالحالة FAILED ذرّياً ثم يستردّ كل التعهدات المحجوزة/المقطوفة عبر كنس الاسترداد. متاح فقط لحملة قيد النشر أو موقوفة أو قيد المراجعة أو مجدولة — الحملة المموَّلة أو المستقرة ماليّاً لا تُغلق من هنا. غير قابل للعكس.',
    inputSchema: projectRef,
    permission: 'projects.lifecycle',
    riskTier: 'SENSITIVE',
    reversible: false,
    requiresReason: true,
    // EscrowService.adminRefundProject calls the PSP and owns its own txns.
    orchestrated: true,
    preconditions: [
      {
        code: 'project-missing',
        reasonAr: 'المشروع غير موجود',
        check: async (db, input) =>
          !!(await db.project.findUnique({
            where: { id: input.projectId },
            select: { id: true },
          })),
      },
      {
        code: 'not-closeable',
        reasonAr:
          'الإغلاق القسري متاح فقط لحملة بحالة LIVE أو PAUSED أو UNDER_REVIEW أو SCHEDULED — الحملة المموَّلة أو المستقرة ماليّاً لا تُغلق',
        check: async (db, input) => {
          const p = await db.project.findUnique({
            where: { id: input.projectId },
            select: { status: true },
          });
          return !!p && CLOSEABLE.includes(p.status);
        },
      },
    ],
    async dryRun(db, input) {
      const p = await db.project.findUnique({
        where: { id: input.projectId },
        select: { titleAr: true, status: true },
      });
      const [refundable, agg] = await Promise.all([
        db.pledge.count({ where: { projectId: input.projectId, status: { in: REFUNDABLE } } }),
        db.pledge.aggregate({
          where: { projectId: input.projectId, status: { in: REFUNDABLE } },
          _sum: { amountHalalas: true, addOnsHalalas: true },
        }),
      ]);
      const gross = (agg._sum.amountHalalas ?? 0n) + (agg._sum.addOnsHalalas ?? 0n);
      return {
        summaryAr: `سيُغلق «${p?.titleAr ?? input.projectId}» قسريّاً (${p?.status ?? '—'} → FAILED) ويُستردّ ${refundable} تعهداً بإجمالي ${gross.toString()} هللة`,
        before: { status: p?.status ?? null },
        after: { status: 'FAILED' },
        counts: { refundablePledges: refundable },
        monetaryDeltasHalalas: { grossRefund: gross.toString() },
      };
    },
    async execute(tx, input) {
      // Atomic claim: a concurrent deadline-settle (LIVE→FAILED/FUNDED) and a
      // force-close cannot both win — the loser sees count 0 and no-ops.
      const claimed = await tx.project.updateMany({
        where: { id: input.projectId, status: { in: CLOSEABLE } },
        data: { status: ProjectStatus.FAILED },
      });
      if (claimed.count === 0) {
        return { closed: false, refunded: 0, failed: 0, totalHalalas: '0' };
      }
      const refund = await deps.escrow.adminRefundProject(input.projectId);
      return {
        closed: true,
        refunded: refund.refunded,
        failed: refund.failed,
        totalHalalas: refund.totalHalalas.toString(),
      };
    },
    async afterCommit(result, input) {
      if (!result.closed) return;
      const p = await deps.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { createdById: true, titleAr: true },
      });
      if (!p) return;
      // Closest existing kind: the campaign is now FAILED — same signal the
      // creator gets when a campaign fails at settlement.
      await deps.notifications.create({
        userId: p.createdById,
        kind: NotificationKind.PROJECT_FAILED,
        payload: {
          projectId: input.projectId,
          projectTitleAr: p.titleAr,
          reason: 'force-closed-by-ops',
        },
      });
    },
  };

  /* ── pause (admin) ─────────────────────────────────────────────────── */
  const pauseAdmin: OperationDef<z.infer<typeof projectRef>, { paused: boolean; pausedAt: string }> =
    {
      key: 'projects.pause.admin',
      titleAr: 'إيقاف حملة مؤقتاً (إداري)',
      descriptionAr:
        'النسخة الإدارية من الإيقاف المؤقت (بلا شرط ملكية المبدع): يجمّد التعهدات الجديدة دون تمديد الموعد — الساعة تمضي أثناء الإيقاف. إيقاف المشغّل إجراء سلامة، لذا يتجاوز سقف السبعة أيام المفروض على المبدع. العكس التعويضي: projects.unpause.admin.',
      inputSchema: projectRef,
      permission: 'projects.lifecycle',
      riskTier: 'STANDARD',
      reversible: true,
      compensatingKey: 'projects.unpause.admin',
      requiresReason: false,
      preconditions: [
        {
          code: 'not-live',
          reasonAr: 'الإيقاف المؤقت متاح فقط لحملة قيد النشر (LIVE)',
          check: async (db, input) => {
            const p = await db.project.findUnique({
              where: { id: input.projectId },
              select: { status: true },
            });
            return p?.status === ProjectStatus.LIVE;
          },
        },
      ],
      async dryRun(db, input) {
        const p = await db.project.findUnique({
          where: { id: input.projectId },
          select: { titleAr: true, status: true },
        });
        return {
          summaryAr: `ستُوقف حملة «${p?.titleAr ?? input.projectId}» مؤقتاً (LIVE → PAUSED) — الموعد لا يُمدَّد`,
          before: { status: p?.status ?? null },
          after: { status: 'PAUSED' },
        };
      },
      async execute(tx, input) {
        const now = new Date();
        // Atomic claim: a concurrent settle (LIVE→FAILED) must not be lost.
        await tx.project.updateMany({
          where: { id: input.projectId, status: ProjectStatus.LIVE },
          data: { status: ProjectStatus.PAUSED, pausedAt: now },
        });
        return { paused: true, pausedAt: now.toISOString() };
      },
    };

  /* ── unpause (admin) — the pause compensator ───────────────────────── */
  const unpauseAdmin: OperationDef<
    z.infer<typeof projectRef>,
    { resumed: boolean; pausedMsAccrued: string }
  > = {
    key: 'projects.unpause.admin',
    titleAr: 'استئناف حملة موقوفة (إداري)',
    descriptionAr:
      'النسخة الإدارية من الاستئناف (بلا شرط ملكية المبدع): يعيد الحملة إلى LIVE ويراكم مدة الإيقاف المنقضية في العداد التراكمي. إن انقضى الموعد أثناء الإيقاف تسوّيها الدورة التالية (الساعة لم تتوقف). العكس التعويضي: projects.pause.admin.',
    inputSchema: projectRef,
    permission: 'projects.lifecycle',
    riskTier: 'STANDARD',
    reversible: true,
    compensatingKey: 'projects.pause.admin',
    requiresReason: false,
    preconditions: [
      {
        code: 'not-paused',
        reasonAr: 'الاستئناف متاح فقط لحملة موقوفة (PAUSED)',
        check: async (db, input) => {
          const p = await db.project.findUnique({
            where: { id: input.projectId },
            select: { status: true },
          });
          return p?.status === ProjectStatus.PAUSED;
        },
      },
    ],
    async dryRun(db, input) {
      const p = await db.project.findUnique({
        where: { id: input.projectId },
        select: { titleAr: true, status: true, pausedAt: true, pausedMsAccrued: true },
      });
      const pausedFor = p?.pausedAt ? Math.max(0, Date.now() - p.pausedAt.getTime()) : 0;
      const accrued = (p?.pausedMsAccrued ?? 0n) + BigInt(pausedFor);
      return {
        summaryAr: `ستُستأنف حملة «${p?.titleAr ?? input.projectId}» (PAUSED → LIVE) ويُراكم ${accrued.toString()}ms من الإيقاف`,
        before: {
          status: p?.status ?? null,
          pausedMsAccrued: (p?.pausedMsAccrued ?? 0n).toString(),
        },
        after: { status: 'LIVE', pausedMsAccrued: accrued.toString() },
      };
    },
    async execute(tx, input) {
      const p = await tx.project.findUniqueOrThrow({
        where: { id: input.projectId },
        select: { pausedAt: true, pausedMsAccrued: true },
      });
      const pausedFor = p.pausedAt ? BigInt(Math.max(0, Date.now() - p.pausedAt.getTime())) : 0n;
      const accrued = p.pausedMsAccrued + pausedFor;
      await tx.project.updateMany({
        where: { id: input.projectId, status: ProjectStatus.PAUSED },
        data: { status: ProjectStatus.LIVE, pausedAt: null, pausedMsAccrued: accrued },
      });
      return { resumed: true, pausedMsAccrued: accrued.toString() };
    },
  };

  return [forceClose, pauseAdmin, unpauseAdmin] as unknown as Array<OperationDef<never, unknown>>;
}
