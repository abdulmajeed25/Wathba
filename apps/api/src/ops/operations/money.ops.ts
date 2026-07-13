import { MilestoneStatus, NotificationKind, PayoutStatus, ProjectStatus } from '@prisma/client';
import { z } from 'zod';

import { commissionBreakdown } from '../../config/fees';

import type { OperationDef } from '../operation.types';
import type { FundingService } from '../../funding/funding.service';
import type { PayoutDisburser } from '../../escrow-payments/payout.disburser';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { EmailService } from '../../email/email.service';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * OPS Part 0 — MONEY-tier operations. The registry already forces: written
 * reason ≥10 chars, idempotencyKey, AGENT refusal, step-up (env-gated until
 * Part 1) and four-eyes queueing (Part 2). Settlement + disbursement are
 * `orchestrated` — they call the PSP, so the registry claims idempotency +
 * audit atomically BEFORE they run and records the outcome after.
 */

export interface MoneyOpsDeps {
  prisma: PrismaService;
  funding: FundingService;
  disburser: PayoutDisburser;
  notifications: NotificationsService;
  email: EmailService;
}

const DAY_MS = 86_400_000;
/** LONG_DURATION register — >120d capture model is blocked pending legal. */
const MAX_CAMPAIGN_DAYS = 120;

export function moneyOps(deps: MoneyOpsDeps): Array<OperationDef<never, unknown>> {
  /* ── deadline override ─────────────────────────────────────────────── */
  const deadlineInput = z.object({
    projectId: z.string().uuid(),
    deadline: z.coerce.date(),
  });

  const deadlineOverride: OperationDef<
    z.infer<typeof deadlineInput>,
    { ok: true; deadline: string }
  > = {
    key: 'money.deadline.override',
    titleAr: 'تعديل الموعد النهائي لحملة',
    descriptionAr:
      'أداة تشغيلية تُغيّر موعد إغلاق الحملة. سياسة: لا يتجاوز الموعد الجديد سقف الـ١٢٠ يوماً من النشر. تقديم الموعد إلى الماضي مسموح (مقعد تسوية تشغيلي) — التسوية نفسها تبقى عملية مستقلة.',
    inputSchema: deadlineInput,
    permission: 'money.execute',
    riskTier: 'MONEY',
    reversible: true,
    compensatingKey: 'money.deadline.override',
    requiresReason: true,
    preconditions: [
      {
        code: 'project-missing',
        reasonAr: 'المشروع غير موجود',
        check: async (db, input) =>
          !!(await db.project.findUnique({ where: { id: input.projectId }, select: { id: true } })),
      },
      {
        code: 'not-settleable-status',
        reasonAr: 'تعديل الموعد متاح فقط لحملة LIVE أو PAUSED أو SCHEDULED',
        check: async (db, input) => {
          const p = await db.project.findUnique({
            where: { id: input.projectId },
            select: { status: true },
          });
          return (
            p?.status === ProjectStatus.LIVE ||
            p?.status === ProjectStatus.PAUSED ||
            p?.status === ProjectStatus.SCHEDULED
          );
        },
      },
      {
        code: 'beyond-duration-cap',
        reasonAr: 'الموعد الجديد يتجاوز سقف ١٢٠ يوماً من تاريخ النشر (سجل LONG_DURATION)',
        check: async (db, input) => {
          const p = await db.project.findUnique({
            where: { id: input.projectId },
            select: { publishedAt: true },
          });
          if (!p?.publishedAt) return true; // SCHEDULED — cap applies from launch
          return input.deadline.getTime() <= p.publishedAt.getTime() + MAX_CAMPAIGN_DAYS * DAY_MS;
        },
      },
    ],
    async dryRun(db, input) {
      const p = await db.project.findUnique({
        where: { id: input.projectId },
        select: { titleAr: true, deadline: true, status: true },
      });
      return {
        summaryAr: `سيتغيّر موعد إغلاق «${p?.titleAr}» — التسوية لا تعمل تلقائياً من هذه العملية`,
        before: { deadline: p?.deadline?.toISOString() ?? null, status: p?.status ?? null },
        after: { deadline: input.deadline.toISOString(), status: p?.status ?? null },
      };
    },
    async execute(tx, input) {
      await tx.project.update({
        where: { id: input.projectId },
        data: { deadline: input.deadline },
      });
      return { ok: true as const, deadline: input.deadline.toISOString() };
    },
  };

  /* ── milestone approve ─────────────────────────────────────────────── */
  const milestoneRef = z.object({
    projectId: z.string().uuid(),
    milestoneId: z.string().uuid(),
  });

  const milestoneApprove: OperationDef<z.infer<typeof milestoneRef>, { id: string; status: string }> = {
    key: 'money.milestone.approve',
    titleAr: 'اعتماد مرحلة (مع الدليل)',
    descriptionAr:
      'يعتمد مرحلة قدّم المبدع دليلها (SUBMITTED→APPROVED). الاعتماد لا يصرف مالاً — الصرف عملية مستقلة.',
    inputSchema: milestoneRef,
    permission: 'money.execute',
    riskTier: 'MONEY',
    reversible: true,
    requiresReason: true,
    preconditions: [
      {
        code: 'not-submitted',
        reasonAr: 'المرحلة ليست بانتظار الاعتماد (SUBMITTED)',
        check: async (db, input) => {
          const m = await db.milestone.findFirst({
            where: { id: input.milestoneId, projectId: input.projectId },
            select: { status: true },
          });
          return m?.status === MilestoneStatus.SUBMITTED;
        },
      },
      {
        code: 'evidence-missing',
        reasonAr: 'لا دليل مرفق على المرحلة — الاعتماد يتطلب evidenceUrl',
        check: async (db, input) => {
          const m = await db.milestone.findFirst({
            where: { id: input.milestoneId, projectId: input.projectId },
            select: { evidenceUrl: true },
          });
          return !!m?.evidenceUrl;
        },
      },
    ],
    async dryRun(db, input) {
      const m = await db.milestone.findFirst({
        where: { id: input.milestoneId, projectId: input.projectId },
      });
      return {
        summaryAr: `ستُعتمد المرحلة «${m?.titleAr}» (الدليل: ${m?.evidenceUrl ?? '—'})`,
        before: { status: m?.status ?? null },
        after: { status: 'APPROVED' },
      };
    },
    async execute(tx, input) {
      const updated = await tx.milestone.update({
        where: { id: input.milestoneId },
        data: { status: MilestoneStatus.APPROVED, approvedAt: new Date() },
      });
      return { id: updated.id, status: updated.status };
    },
  };

  /* ── milestone release (the payable event) ─────────────────────────── */
  const milestoneRelease: OperationDef<
    z.infer<typeof milestoneRef>,
    { id: string; amountHalalas: string }
  > = {
    key: 'money.milestone.release',
    titleAr: 'صرف مرحلة (يُنشئ دفعة معلّقة)',
    descriptionAr:
      'الحدث المالي: يحسب المبلغ من REALIZED فقط (المقطوف فعلياً)، ينشئ Payout معلّقاً للصرف، وينقل المشروع إلى IN_PRODUCTION عند أول صرف.',
    inputSchema: milestoneRef,
    permission: 'money.execute',
    riskTier: 'MONEY',
    reversible: false,
    requiresReason: true,
    preconditions: [
      {
        code: 'project-not-funded',
        reasonAr: 'الصرف متاح فقط لمشروع FUNDED أو IN_PRODUCTION',
        check: async (db, input) => {
          const p = await db.project.findUnique({
            where: { id: input.projectId },
            select: { status: true },
          });
          return p?.status === ProjectStatus.FUNDED || p?.status === ProjectStatus.IN_PRODUCTION;
        },
      },
      {
        code: 'not-approved',
        reasonAr: 'المرحلة ليست معتمدة (APPROVED) — اعتمدها أولاً',
        check: async (db, input) => {
          const m = await db.milestone.findFirst({
            where: { id: input.milestoneId, projectId: input.projectId },
            select: { status: true },
          });
          return m?.status === MilestoneStatus.APPROVED;
        },
      },
      {
        code: 'nothing-realized',
        reasonAr: 'لا مال مقطوف (REALIZED=0) — لا يمكن صرف مرحلة من تعهدات غير مقطوفة',
        check: async (db, input) => {
          const p = await db.project.findUnique({
            where: { id: input.projectId },
            select: { realizedHalalas: true },
          });
          return (p?.realizedHalalas ?? 0n) > 0n;
        },
      },
    ],
    async dryRun(db, input) {
      const [p, m] = await Promise.all([
        db.project.findUnique({ where: { id: input.projectId } }),
        db.milestone.findFirst({ where: { id: input.milestoneId, projectId: input.projectId } }),
      ]);
      const amount = p && m ? (p.realizedHalalas * BigInt(m.releasePct)) / 100n : 0n;
      return {
        summaryAr: `سيُصرف ${m?.releasePct ?? 0}٪ من المقطوف فعلياً — دفعة معلّقة للمبدع تُرسل في دورة الصرف`,
        before: {
          milestoneStatus: m?.status ?? null,
          projectStatus: p?.status ?? null,
          releasedHalalas: m?.releasedHalalas?.toString() ?? '0',
        },
        after: {
          milestoneStatus: 'RELEASED',
          projectStatus: p?.status === ProjectStatus.FUNDED ? 'IN_PRODUCTION' : p?.status,
          releasedHalalas: amount.toString(),
          payout: 'PENDING',
        },
        monetaryDeltasHalalas: {
          payoutCreated: amount.toString(),
          basisRealized: p?.realizedHalalas.toString() ?? '0',
        },
      };
    },
    async execute(tx, input) {
      const project = await tx.project.findUniqueOrThrow({ where: { id: input.projectId } });
      const m = await tx.milestone.findFirstOrThrow({
        where: { id: input.milestoneId, projectId: input.projectId },
      });
      // Batch PAY (Part 2) — payouts compute from REALIZED only.
      const amountHalalas = (project.realizedHalalas * BigInt(m.releasePct)) / 100n;
      const updated = await tx.milestone.update({
        where: { id: input.milestoneId },
        data: {
          status: MilestoneStatus.RELEASED,
          releasedAt: new Date(),
          releasedHalalas: amountHalalas,
        },
      });
      await tx.payout.create({
        data: {
          projectId: input.projectId,
          creatorId: project.createdById,
          milestoneId: input.milestoneId,
          amountHalalas,
          status: PayoutStatus.PENDING,
        },
      });
      if (project.status === ProjectStatus.FUNDED) {
        await tx.project.update({
          where: { id: input.projectId },
          data: { status: ProjectStatus.IN_PRODUCTION },
        });
      }
      return {
        id: updated.id,
        amountHalalas: amountHalalas.toString(),
        creatorId: project.createdById,
        projectTitleAr: project.titleAr,
        milestoneTitleAr: updated.titleAr,
      } as { id: string; amountHalalas: string };
    },
    async afterCommit(result, input) {
      const r = result as {
        amountHalalas: string;
        creatorId?: string;
        projectTitleAr?: string;
        milestoneTitleAr?: string;
      };
      if (!r.creatorId) return;
      await deps.notifications.create({
        userId: r.creatorId,
        kind: NotificationKind.MILESTONE_APPROVED,
        payload: {
          projectId: input.projectId,
          projectTitleAr: r.projectTitleAr,
          milestoneTitleAr: r.milestoneTitleAr,
          amountHalalas: Number(r.amountHalalas),
        },
      });
      const creator = await deps.prisma.user.findUnique({
        where: { id: r.creatorId },
        select: { email: true },
      });
      if (creator) {
        await deps.email.milestoneReleased(creator.email, {
          projectTitle: r.projectTitleAr ?? '',
          milestoneTitle: r.milestoneTitleAr ?? '',
          amountHalalas: Number(r.amountHalalas),
        });
      }
    },
  };

  /* ── settlement (orchestrated — drives capture/void via the PSP) ───── */
  const settleInput = z.object({ projectId: z.string().uuid() });

  const settleRun: OperationDef<z.infer<typeof settleInput>, { status: string; residue: unknown }> = {
    key: 'money.settle.run',
    titleAr: 'تشغيل تسوية حملة',
    descriptionAr:
      'يشغّل آلة التسوية (§5): عند الموعد النهائي فقط — بلوغ العتبة يقطف كل الحجوزات، والفشل يفكّها. يعيد أيضاً كنس أي متبقٍ محجوز. Idempotent عبر ادعاء الحالة الذرّي.',
    inputSchema: settleInput,
    permission: 'money.execute',
    riskTier: 'MONEY',
    reversible: false,
    requiresReason: true,
    orchestrated: true,
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
      if (!p) return { summaryAr: 'المشروع غير موجود', before: null, after: null };
      const pastDeadline = p.deadline.getTime() <= Date.now();
      const pct =
        p.fundingGoalHalalas > 0n ? Number((p.raisedHalalas * 100n) / p.fundingGoalHalalas) : 0;
      const threshold = p.releaseThresholdPct ?? 80;
      const wouldSucceed = pct >= threshold;
      const held = await db.pledge.count({
        where: { projectId: input.projectId, status: { in: ['HELD', 'PENDING_REAUTH'] } },
      });
      const bnpl = await db.pledge.count({
        where: { projectId: input.projectId, status: 'PENDING_BNPL' },
      });
      const deltas: Record<string, string> = wouldSucceed
        ? { toCapture: p.raisedHalalas.toString() }
        : { toVoid: p.raisedHalalas.toString() };
      return {
        summaryAr: !pastDeadline
          ? `الموعد لم يحل بعد — التسوية سترفض التنفيذ (القاعدة: تقييم عند الموعد فقط)`
          : wouldSucceed
            ? `الحملة عند ${pct}٪ ≥ العتبة ${threshold}٪ → قطف ${held} حجزاً + مهلة ٧٢س لـ${bnpl} تعهد تقسيط`
            : `الحملة عند ${pct}٪ < العتبة ${threshold}٪ → فكّ ${held} حجزاً (VOID — لا قطف ثم استرداد) وإلغاء ${bnpl} تعهد تقسيط`,
        before: { status: p.status, pct, held, bnpl },
        after: {
          status: !pastDeadline ? p.status : wouldSucceed ? 'FUNDED' : 'REFUNDED',
        },
        counts: { heldPledges: held, bnplPledges: bnpl },
        monetaryDeltasHalalas: deltas,
      };
    },
    async execute(_db, input) {
      // Orchestrated: settleProject owns its atomic status-claim + PSP calls.
      const settle = await deps.funding.settleProject(input.projectId);
      // Residue sweep is best-effort: it throws when there is nothing to do
      // (e.g. still LIVE before deadline) — that is not a failure of settle.
      let residue: unknown = null;
      try {
        residue = await deps.funding.resettleResidue(input.projectId);
      } catch {
        residue = null;
      }
      const p = await deps.prisma.project.findUniqueOrThrow({
        where: { id: input.projectId },
        select: { status: true },
      });
      return { status: p.status, settle, residue };
    },
  };

  /* ── payout disbursement tick (orchestrated — provider transfer) ───── */
  const disburseInput = z.object({});

  const payoutDisburse: OperationDef<Record<string, never>, unknown> = {
    key: 'money.payout.disburse',
    titleAr: 'تشغيل دورة صرف الدفعات',
    descriptionAr:
      'يدفع كل الدفعات المعلّقة عبر مزوّد الصرف (وضع المحاكاة بدون مفاتيح): ادعاء ذرّي PENDING→SENDING→SENT، تحويل الصافي بعد خصم عمولة المنصة ٥٪ + ضريبتها (تسوية فاتورة زاتكا بالمقاصة)، قيدا دفتر (صافي + عمولة)، إشعار المبدع. الرفض النهائي من المزوّد → FAILED مع السبب.',
    inputSchema: disburseInput as z.ZodType<Record<string, never>>,
    permission: 'money.execute',
    riskTier: 'MONEY',
    reversible: false,
    requiresReason: true,
    orchestrated: true,
    preconditions: [],
    async dryRun(db) {
      const pending = await db.payout.findMany({
        where: { status: PayoutStatus.PENDING },
        select: { id: true, amountHalalas: true, creatorId: true },
        take: 100,
      });
      const total = pending.reduce((acc, p) => acc + p.amountHalalas, 0n);
      // OPS-0 correction #2 — the preview shows exactly what the disburser
      // will do: net transfer + withheld commission per the single fee SoT.
      const totals = pending.reduce(
        (acc, p) => {
          const f = commissionBreakdown(p.amountHalalas);
          return { net: acc.net + f.netHalalas, withheld: acc.withheld + f.withheldHalalas };
        },
        { net: 0n, withheld: 0n },
      );
      return {
        summaryAr: `ستُرسل ${pending.length} دفعة معلّقة — الإجمالي ${total.toString()} هللة، صافي التحويل ${totals.net.toString()} بعد خصم عمولة ${totals.withheld.toString()}`,
        before: { pendingPayouts: pending.length },
        after: { pendingPayouts: 0 },
        counts: { payouts: pending.length },
        monetaryDeltasHalalas: {
          grossPending: total.toString(),
          netToDisburse: totals.net.toString(),
          commissionWithheld: totals.withheld.toString(),
        },
      };
    },
    async execute() {
      return deps.disburser.disbursePending();
    },
  };

  return [
    deadlineOverride,
    milestoneApprove,
    milestoneRelease,
    settleRun,
    payoutDisburse,
  ] as unknown as Array<OperationDef<never, unknown>>;
}
