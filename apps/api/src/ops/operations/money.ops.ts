import { BadRequestException } from '@nestjs/common';
import { MilestoneStatus, NotificationKind, PayoutStatus, PledgeStatus, ProjectStatus } from '@prisma/client';
import { z } from 'zod';

import { commissionBreakdown } from '../../config/fees';
import { computeCounterDrift, recomputeCounters } from '../counters.recompute';

import type { OperationDef, ReadOnlyDb } from '../operation.types';
import type { FundingService } from '../../funding/funding.service';
import type { PayoutDisburser } from '../../escrow-payments/payout.disburser';
import type { EscrowService } from '../../escrow-payments/escrow.service';
import type { MoyasarAdapter } from '../../escrow-payments/moyasar.adapter';
import type { ZatcaService } from '../../escrow-payments/zatca.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { EmailService } from '../../email/email.service';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * OPS Part 0 — MONEY-tier operations. The registry already forces: written
 * reason ≥10 chars, idempotencyKey, AGENT refusal, step-up (env-gated until
 * Part 1) and four-eyes queueing (Part 2). Settlement + disbursement are
 * `orchestrated` — they call the PSP, so the registry claims idempotency +
 * audit atomically BEFORE they run and records the outcome after.
 *
 * Batch OPS (registry completion) adds the refund/retry/reconcile family:
 * refunds and capture retries delegate to EscrowService (it owns the PSP +
 * counter-compensation transactionality), payout retry only re-queues state
 * (the disburser cron does the PSP work), and reconcile reads PSP truth.
 */

export interface MoneyOpsDeps {
  prisma: PrismaService;
  funding: FundingService;
  disburser: PayoutDisburser;
  escrow: EscrowService;
  moyasar: MoyasarAdapter;
  // Batch OPS-PRO Phase 1 — money.zatca.retry regenerates the orphaned
  // simplified tax invoice for a SENT payout. Wired by the coordinator from
  // EscrowPaymentsModule (see report: the module must export ZatcaService).
  zatca: ZatcaService;
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

  /* ── Batch OPS (registry completion) — refunds ─────────────────────── */

  /** States an admin refund can act on: held money is voided, captured
   *  money is refunded. Everything else is terminal or never-charged. */
  const REFUNDABLE: PledgeStatus[] = [
    PledgeStatus.HELD,
    PledgeStatus.PENDING_REAUTH,
    PledgeStatus.CAPTURED,
  ];

  /** Realized money still on the platform: REALIZED − Σ released milestones.
   *  A refund of captured money may only draw from this — released tranches
   *  already left toward the creator and cannot be clawed back here. */
  const unreleasedRealized = async (db: ReadOnlyDb, projectId: string): Promise<bigint> => {
    const [p, rel] = await Promise.all([
      db.project.findUnique({ where: { id: projectId }, select: { realizedHalalas: true } }),
      db.milestone.aggregate({ where: { projectId }, _sum: { releasedHalalas: true } }),
    ]);
    return (p?.realizedHalalas ?? 0n) - (rel._sum.releasedHalalas ?? 0n);
  };

  const refundPledgeInput = z.object({ pledgeId: z.string().uuid() });

  const refundPledge: OperationDef<
    z.infer<typeof refundPledgeInput>,
    { ok: true; mode: 'void' | 'refund'; amountHalalas: string }
  > = {
    key: 'money.refund.pledge',
    titleAr: 'استرداد تعهد واحد',
    descriptionAr:
      'يعيد مال تعهد واحد إلى الداعم عبر بوابة الدفع: الحجز (HELD/PENDING_REAUTH) يُفكّ (VOID)، والمقطوف (CAPTURED) يُسترد (REFUND) مع خصمه من REALIZED. سياسة: لا استرداد لمقطوف تغطيه مراحل صُرفت للمبدع. غير قابل للعكس.',
    inputSchema: refundPledgeInput,
    permission: 'money.execute',
    riskTier: 'MONEY',
    reversible: false,
    requiresReason: true,
    orchestrated: true,
    preconditions: [
      {
        code: 'pledge-missing',
        reasonAr: 'التعهد غير موجود',
        check: async (db, input) =>
          !!(await db.pledge.findUnique({ where: { id: input.pledgeId }, select: { id: true } })),
      },
      {
        code: 'not-refundable',
        reasonAr: 'التعهد ليس في حالة قابلة للاسترداد — المؤهل: HELD أو PENDING_REAUTH أو CAPTURED',
        check: async (db, input) => {
          const p = await db.pledge.findUnique({
            where: { id: input.pledgeId },
            select: { status: true },
          });
          return !!p && REFUNDABLE.includes(p.status);
        },
      },
      {
        code: 'funds-already-released',
        reasonAr:
          'المبلغ المقطوف لا يغطي الاسترداد — مراحل صُرفت للمبدع بالفعل ولا يمكن استرجاعها من هذا التعهد',
        check: async (db, input) => {
          const p = await db.pledge.findUnique({
            where: { id: input.pledgeId },
            select: { status: true, projectId: true, amountHalalas: true, addOnsHalalas: true },
          });
          if (!p || p.status !== PledgeStatus.CAPTURED) return true; // void path — no realized draw
          return (await unreleasedRealized(db, p.projectId)) >= p.amountHalalas + p.addOnsHalalas;
        },
      },
    ],
    async dryRun(db, input) {
      const p = await db.pledge.findUnique({
        where: { id: input.pledgeId },
        include: { project: { select: { titleAr: true } } },
      });
      if (!p) return { summaryAr: 'التعهد غير موجود', before: null, after: null };
      const captured = p.status === PledgeStatus.CAPTURED;
      const amount = p.amountHalalas + p.addOnsHalalas;
      // Blast radius: backersCount drops only when no OTHER active pledge remains.
      const otherActive = await db.pledge.count({
        where: {
          projectId: p.projectId,
          backerId: p.backerId,
          id: { not: p.id },
          status: { in: [PledgeStatus.HELD, PledgeStatus.PENDING_BNPL, PledgeStatus.CAPTURED] },
        },
      });
      return {
        summaryAr: captured
          ? `سيُسترد ${amount.toString()} هللة مقطوفة من «${p.project.titleAr}» (REFUND) — يُخصم من REALIZED أيضاً`
          : `سيُفكّ حجز ${amount.toString()} هللة في «${p.project.titleAr}» (VOID — لا قطف حدث)`,
        before: { pledgeStatus: p.status, mode: captured ? 'refund' : 'void' },
        after: { pledgeStatus: 'REFUNDED', mode: captured ? 'refund' : 'void' },
        counts: {
          tierStockReleased: p.tierId ? 1 : 0,
          backersCountDecrement: otherActive === 0 ? 1 : 0,
        },
        monetaryDeltasHalalas: {
          refundToBacker: amount.toString(),
          raisedDelta: (-amount).toString(),
          realizedDelta: captured ? (-amount).toString() : '0',
          backerTotalPledgedDelta: (-amount).toString(),
        },
      };
    },
    async execute(_db, input) {
      // Orchestrated: adminRefundPledge owns the PSP call + its own tx.
      const r = await deps.escrow.adminRefundPledge(input.pledgeId);
      if (!r.ok) {
        // Throwing marks the orchestrated claim FAILED — a PSP refusal is a
        // recorded failure, never a silent no-op.
        throw new BadRequestException(
          `تعذّر الاسترداد عبر بوابة الدفع: ${r.failureReason ?? 'رفض المزوّد'}`,
        );
      }
      return { ok: true as const, mode: r.mode, amountHalalas: r.amountHalalas.toString() };
    },
  };

  const refundProjectInput = z.object({ projectId: z.string().uuid() });

  const refundProject: OperationDef<
    z.infer<typeof refundProjectInput>,
    { refunded: number; failed: number; totalHalalas: string }
  > = {
    key: 'money.refund.project',
    titleAr: 'استرداد كل تعهدات مشروع',
    descriptionAr:
      'كنس استرداد شامل: كل تعهد HELD/PENDING_REAUTH/CAPTURED في المشروع يمر بمسار الاسترداد الفردي بعزل الفشل الجزئي (رفض واحد من البوابة لا يوقف البقية). سياسة: لا يتاح إذا كان مجموع المقطوف المسترد يتجاوز REALIZED غير المصروف. غير قابل للعكس.',
    inputSchema: refundProjectInput,
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
      {
        code: 'nothing-to-refund',
        reasonAr: 'لا توجد تعهدات قابلة للاسترداد (HELD/PENDING_REAUTH/CAPTURED) في هذا المشروع',
        check: async (db, input) =>
          (await db.pledge.count({
            where: { projectId: input.projectId, status: { in: REFUNDABLE } },
          })) > 0,
      },
      {
        code: 'funds-already-released',
        reasonAr:
          'مجموع المقطوف المطلوب استرداده يتجاوز المتبقي غير المصروف — مراحل صُرفت للمبدع لا تُسترجع من هذا الكنس',
        check: async (db, input) => {
          const cap = await db.pledge.aggregate({
            where: { projectId: input.projectId, status: PledgeStatus.CAPTURED },
            _sum: { amountHalalas: true, addOnsHalalas: true },
          });
          const capturedTotal =
            (cap._sum.amountHalalas ?? 0n) + (cap._sum.addOnsHalalas ?? 0n);
          if (capturedTotal === 0n) return true; // void-only sweep
          return (await unreleasedRealized(db, input.projectId)) >= capturedTotal;
        },
      },
    ],
    async dryRun(db, input) {
      const p = await db.project.findUnique({
        where: { id: input.projectId },
        select: { titleAr: true },
      });
      const rows = await db.pledge.groupBy({
        by: ['status'],
        where: { projectId: input.projectId, status: { in: REFUNDABLE } },
        _sum: { amountHalalas: true, addOnsHalalas: true },
        _count: true,
      });
      const bucket = (s: PledgeStatus) => {
        const r = rows.find((x) => x.status === s);
        const count = typeof r?._count === 'number' ? r._count : 0;
        return {
          count,
          sum: (r?._sum.amountHalalas ?? 0n) + (r?._sum.addOnsHalalas ?? 0n),
        };
      };
      const held = bucket(PledgeStatus.HELD);
      const reauth = bucket(PledgeStatus.PENDING_REAUTH);
      const cap = bucket(PledgeStatus.CAPTURED);
      const voidTotal = held.sum + reauth.sum;
      const gross = voidTotal + cap.sum;
      return {
        summaryAr: `كنس استرداد «${p?.titleAr ?? '—'}»: فكّ ${held.count + reauth.count} حجزاً (VOID) واسترداد ${cap.count} مقطوفاً (REFUND) — إجمالي ${gross.toString()} هللة`,
        before: {
          held: held.count,
          pendingReauth: reauth.count,
          captured: cap.count,
        },
        after: { refundable: 0 },
        counts: {
          held: held.count,
          pendingReauth: reauth.count,
          captured: cap.count,
          total: held.count + reauth.count + cap.count,
        },
        monetaryDeltasHalalas: {
          grossRefund: gross.toString(),
          voidTotal: voidTotal.toString(),
          refundTotal: cap.sum.toString(),
        },
      };
    },
    async execute(_db, input) {
      const r = await deps.escrow.adminRefundProject(input.projectId);
      return { refunded: r.refunded, failed: r.failed, totalHalalas: r.totalHalalas.toString() };
    },
  };

  /* ── capture retry cohort (orchestrated — PSP capture/reauthorize) ──── */
  const retryCohortInput = z.object({
    projectId: z.string().uuid(),
    includeFailed: z.boolean().default(false),
  });
  type RetryCohortInput = z.infer<typeof retryCohortInput>;

  const captureRetryCohort: OperationDef<
    RetryCohortInput,
    { attempted: number; captured: number; stillFailed: number }
  > = {
    key: 'money.capture.retry-cohort',
    titleAr: 'إعادة محاولة قطف دفعة متعثّرة',
    descriptionAr:
      'يعيد محاولة القطف لكل تعهدات CAPTURE_GRACE في المشروع فوراً (دون انتظار علامات +٦/+٢٤/+٤٨ ساعة). خيار includeFailed يشمل FAILED_CAPTURE: إعادة تفويض ثم قطف، مع إعادة حجز مخزون المكافأة ذرّياً قبل أي نداء للبوابة — نفاد المخزون يتخطّى التعهد بدل تحصيل مال بلا مكافأة.',
    inputSchema: retryCohortInput as unknown as z.ZodType<RetryCohortInput>,
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
      {
        code: 'cohort-empty',
        reasonAr: 'لا توجد تعهدات في النطاق المطلوب — لا CAPTURE_GRACE (ولا FAILED_CAPTURE إن طُلبت)',
        check: async (db, input) =>
          (await db.pledge.count({
            where: {
              projectId: input.projectId,
              status: {
                in: input.includeFailed
                  ? [PledgeStatus.CAPTURE_GRACE, PledgeStatus.FAILED_CAPTURE]
                  : [PledgeStatus.CAPTURE_GRACE],
              },
            },
          })) > 0,
      },
    ],
    async dryRun(db, input) {
      const rows = await db.pledge.groupBy({
        by: ['status'],
        where: {
          projectId: input.projectId,
          status: { in: [PledgeStatus.CAPTURE_GRACE, PledgeStatus.FAILED_CAPTURE] },
        },
        _sum: { amountHalalas: true, addOnsHalalas: true },
        _count: true,
      });
      const bucket = (s: PledgeStatus) => {
        const r = rows.find((x) => x.status === s);
        const count = typeof r?._count === 'number' ? r._count : 0;
        return {
          count,
          sum: (r?._sum.amountHalalas ?? 0n) + (r?._sum.addOnsHalalas ?? 0n),
        };
      };
      const grace = bucket(PledgeStatus.CAPTURE_GRACE);
      const dead = bucket(PledgeStatus.FAILED_CAPTURE);
      const scope = input.includeFailed ? grace.count + dead.count : grace.count;
      return {
        summaryAr: input.includeFailed
          ? `ستُعاد محاولة قطف ${grace.count} تعهد مهلة + ${dead.count} تعهد فاشل (بإعادة تفويض وإعادة حجز مخزون)`
          : `ستُعاد محاولة قطف ${grace.count} تعهد في المهلة — تعهدات FAILED_CAPTURE (${dead.count}) خارج النطاق دون includeFailed`,
        before: { inGrace: grace.count, failed: dead.count },
        after: { attempted: scope },
        counts: { inGrace: grace.count, failed: dead.count },
        monetaryDeltasHalalas: {
          inGraceHalalas: grace.sum.toString(),
          failedHalalas: input.includeFailed ? dead.sum.toString() : '0',
        },
      };
    },
    async execute(_db, input) {
      return deps.escrow.retryCaptureCohort(input.projectId, {
        includeFailed: input.includeFailed,
      });
    },
  };

  /* ── payout retry (transactional — only flips state; cron does PSP) ─── */
  const payoutRetryInput = z.object({ payoutId: z.string().uuid() });

  const payoutRetry: OperationDef<
    z.infer<typeof payoutRetryInput>,
    { id: string; status: string; amountHalalas: string }
  > = {
    key: 'money.payout.retry',
    titleAr: 'إعادة دفعة فاشلة إلى طابور الصرف',
    descriptionAr:
      'يعيد دفعة FAILED إلى PENDING ويمسح سبب الفشل — دورة الصرف (كل ٥ دقائق) تلتقطها وتتولى نداء المزوّد. سياسة: FAILED فقط؛ دفعة عالقة في SENDING تعني انهياراً منتصف الإرسال وتتطلب تحقيقاً يدوياً لا إعادة تلقائية.',
    inputSchema: payoutRetryInput,
    permission: 'money.execute',
    riskTier: 'MONEY',
    reversible: false,
    requiresReason: true,
    preconditions: [
      {
        code: 'payout-missing',
        reasonAr: 'الدفعة غير موجودة',
        check: async (db, input) =>
          !!(await db.payout.findUnique({ where: { id: input.payoutId }, select: { id: true } })),
      },
      {
        code: 'not-failed',
        reasonAr:
          'فقط دفعة FAILED تُعاد إلى الطابور — دفعة عالقة في SENDING تحقيق يدوي (خطر صرف مزدوج)، وPENDING/SENT لا تحتاج إعادة',
        check: async (db, input) => {
          const p = await db.payout.findUnique({
            where: { id: input.payoutId },
            select: { status: true },
          });
          return p?.status === PayoutStatus.FAILED;
        },
      },
    ],
    async dryRun(db, input) {
      const p = await db.payout.findUnique({ where: { id: input.payoutId } });
      return {
        summaryAr: `ستعود الدفعة (${p?.amountHalalas.toString() ?? '0'} هللة إجمالياً) إلى الطابور — دورة الصرف تلتقطها خلال ٥ دقائق`,
        before: { status: p?.status ?? null, failureReason: p?.failureReason ?? null },
        after: { status: 'PENDING', failureReason: null },
        monetaryDeltasHalalas: { payoutRequeuedGross: p?.amountHalalas.toString() ?? '0' },
      };
    },
    async execute(tx, input) {
      const updated = await tx.payout.update({
        where: { id: input.payoutId },
        data: { status: PayoutStatus.PENDING, failureReason: null },
      });
      return {
        id: updated.id,
        status: updated.status,
        amountHalalas: updated.amountHalalas.toString(),
      };
    },
  };

  /* ── reconciliation (SENSITIVE — reads PSP truth, moves no money) ───── */
  const reconcileInput = z.object({
    windowDays: z.number().int().min(1).max(90).default(7),
    limit: z.number().int().min(1).max(1000).default(200),
  });
  type ReconcileInput = z.infer<typeof reconcileInput>;

  /** Pledge FSM state → the PSP statuses that would corroborate it. */
  const PSP_EXPECTED: Partial<Record<PledgeStatus, string[]>> = {
    [PledgeStatus.CAPTURED]: ['paid'],
    [PledgeStatus.REFUNDED]: ['refunded', 'voided'],
    [PledgeStatus.HELD]: ['authorized'],
    [PledgeStatus.PENDING_REAUTH]: ['authorized'],
  };

  /** Pledge has no updatedAt — "touched in window" = any lifecycle timestamp
   *  inside it (created/captured/refunded/reauthorized). */
  const reconcileWhere = (since: Date) => ({
    status: {
      in: [
        PledgeStatus.CAPTURED,
        PledgeStatus.REFUNDED,
        PledgeStatus.HELD,
        PledgeStatus.PENDING_REAUTH,
      ],
    },
    OR: [
      { createdAt: { gte: since } },
      { capturedAt: { gte: since } },
      { refundedAt: { gte: since } },
      { reauthorizedAt: { gte: since } },
    ],
  });

  const reconcileRun: OperationDef<
    ReconcileInput,
    {
      scanned: number;
      matched: number;
      mismatched: number;
      skipped: number;
      runId: string;
      truncated: boolean;
      mismatches: Array<{
        pledgeId: string;
        paymentRef: string;
        ledgerSays: string;
        pspSays: string;
        detailAr: string;
      }>;
    }
  > = {
    key: 'money.reconcile.run',
    titleAr: 'تشغيل مطابقة الدفتر مع بوابة الدفع',
    descriptionAr:
      'يقارن حالة كل تعهد حديث (CAPTURED/REFUNDED/HELD/PENDING_REAUTH خلال النافذة) بحالة الدفع لدى المزوّد: CAPTURED↔paid، REFUNDED↔refunded/voided، الحجز↔authorized. لا يحرّك مالاً — يكتب سجل ReconciliationRun بالحصيلة وعدم التطابق. وضع المحاكاة (بدون مفاتيح) يعيد SKIPPED لا MATCHED.',
    inputSchema: reconcileInput as unknown as z.ZodType<ReconcileInput>,
    permission: 'money.execute',
    riskTier: 'SENSITIVE',
    reversible: true,
    requiresReason: false,
    orchestrated: true,
    preconditions: [],
    async dryRun(db, input) {
      const since = new Date(Date.now() - input.windowDays * DAY_MS);
      const candidates = await db.pledge.count({ where: reconcileWhere(since) });
      const toScan = Math.min(candidates, input.limit);
      return {
        summaryAr: `ستُفحص ${toScan} عملية من آخر ${input.windowDays} يوماً ضد بوابة الدفع (سقف ${input.limit}) — في وضع المحاكاة تُحتسب الصفوف SKIPPED لا MATCHED لأن لا حقيقة PSP تُجلب`,
        before: { candidates },
        after: { toScan },
        counts: { candidates, toScan },
      };
    },
    async execute(_db, input) {
      const since = new Date(Date.now() - input.windowDays * DAY_MS);
      const rows = await deps.prisma.pledge.findMany({
        where: reconcileWhere(since),
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        select: { id: true, status: true, paymentRef: true },
      });
      let matched = 0;
      let skipped = 0;
      const mismatches: Array<{
        pledgeId: string;
        paymentRef: string;
        ledgerSays: string;
        pspSays: string;
        detailAr: string;
      }> = [];
      for (const p of rows) {
        let pspStatus: string | null;
        try {
          pspStatus = (await deps.moyasar.fetchPayment(p.paymentRef)).status;
        } catch {
          skipped++; // PSP unreachable for this ref — unknown, never a match
          continue;
        }
        if (pspStatus === null) {
          skipped++; // stub mode — a stub must not fake a clean reconciliation
          continue;
        }
        const expected = PSP_EXPECTED[p.status] ?? [];
        if (expected.includes(pspStatus)) {
          matched++;
        } else {
          mismatches.push({
            pledgeId: p.id,
            paymentRef: p.paymentRef,
            ledgerSays: p.status,
            pspSays: pspStatus,
            detailAr: `دفتر المنصة يقول ${p.status} (المتوقع لدى البوابة: ${expected.join(' أو ') || '—'}) بينما البوابة تقول ${pspStatus}`,
          });
        }
      }
      // Persist ONE run row; the mismatches JSON is capped at 100 rows with
      // the truncation noted on the last persisted row.
      const truncated = mismatches.length > 100;
      const persisted = mismatches.slice(0, 100);
      if (truncated && persisted.length > 0) {
        const last = persisted[persisted.length - 1]!;
        last.detailAr += ` — اقتُطعت القائمة عند ١٠٠ صفاً (إجمالي عدم التطابق: ${mismatches.length})`;
      }
      const run = await deps.prisma.reconciliationRun.create({
        data: {
          windowDays: input.windowDays,
          scanned: rows.length,
          matched,
          mismatched: mismatches.length,
          skipped,
          mismatches: persisted,
          source: 'moyasar',
        },
      });
      return {
        scanned: rows.length,
        matched,
        mismatched: mismatches.length,
        skipped,
        runId: run.id,
        truncated,
        mismatches: persisted,
      };
    },
  };

  /* ═══ Batch OPS-PRO Phase 1 — MONEY-RESOLUTION group ═══════════════════ */

  /* ── dispute resolution (orchestrated — EscrowService owns the tx) ───── */
  const disputeResolveInput = z.object({
    pledgeId: z.string().uuid(),
    outcome: z.enum(['WON', 'LOST']),
  });
  type DisputeResolveInput = z.infer<typeof disputeResolveInput>;

  const disputeResolve: OperationDef<
    DisputeResolveInput,
    { ok: true; outcome: 'WON' | 'LOST'; status: string; amountHalalas: string }
  > = {
    key: 'money.dispute.resolve',
    titleAr: 'حسم نزاع (استرجاع بنكي)',
    descriptionAr:
      'يحسم تعهداً في حالة DISPUTED (وصلها عبر إشعار الاسترجاع البنكي). WON: يبقى المال — يعود التعهد DISPUTED→CAPTURED دون أي تغيير في العدّادات (لم تُخصم عند فتح النزاع). LOST: الاسترجاع نافذ والمال غادر خارجياً — DISPUTED→REFUNDED مع نفس تعويض المقطوف (خصم raised وrealized وعدد الداعمين ومخزون المكافأة وإجمالي تعهدات الداعم). لا نداء لبوابة الدفع. غير قابل للعكس.',
    inputSchema: disputeResolveInput as unknown as z.ZodType<DisputeResolveInput>,
    permission: 'money.execute',
    riskTier: 'MONEY',
    reversible: false,
    requiresReason: true,
    orchestrated: true,
    preconditions: [
      {
        code: 'pledge-missing',
        reasonAr: 'التعهد غير موجود',
        check: async (db, input) =>
          !!(await db.pledge.findUnique({ where: { id: input.pledgeId }, select: { id: true } })),
      },
      {
        code: 'not-disputed',
        reasonAr: 'التعهد ليس في حالة نزاع (DISPUTED) — الحسم يخصّ استرجاعاً بنكياً مفتوحاً فقط',
        check: async (db, input) => {
          const p = await db.pledge.findUnique({
            where: { id: input.pledgeId },
            select: { status: true },
          });
          return p?.status === PledgeStatus.DISPUTED;
        },
      },
    ],
    async dryRun(db, input) {
      const p = await db.pledge.findUnique({
        where: { id: input.pledgeId },
        include: { project: { select: { titleAr: true } } },
      });
      if (!p) return { summaryAr: 'التعهد غير موجود', before: null, after: null };
      const amount = p.amountHalalas + p.addOnsHalalas;
      const won = input.outcome === 'WON';
      // On LOST the disputed pledge no longer counts itself — backersCount
      // drops only if the backer has no OTHER active pledge.
      const otherActive = await db.pledge.count({
        where: {
          projectId: p.projectId,
          backerId: p.backerId,
          id: { not: p.id },
          status: { in: [PledgeStatus.HELD, PledgeStatus.PENDING_BNPL, PledgeStatus.CAPTURED] },
        },
      });
      return {
        summaryAr: won
          ? `حسم لصالح المنصة: يعود ${amount.toString()} هللة إلى CAPTURED في «${p.project.titleAr}» — لا تتغيّر العدّادات`
          : `حسم ضد المنصة: يُسترد ${amount.toString()} هللة في «${p.project.titleAr}» (REFUNDED) مع خصمه من raised وrealized`,
        before: { status: p.status, outcome: p.disputeOutcome ?? null },
        after: { status: won ? 'CAPTURED' : 'REFUNDED', outcome: input.outcome },
        counts: {
          tierStockReleased: won ? 0 : p.tierId ? 1 : 0,
          backersCountDecrement: won ? 0 : otherActive === 0 ? 1 : 0,
        },
        monetaryDeltasHalalas: {
          refundToBacker: won ? '0' : amount.toString(),
          raisedDelta: won ? '0' : (-amount).toString(),
          realizedDelta: won ? '0' : (-amount).toString(),
          backerTotalPledgedDelta: won ? '0' : (-amount).toString(),
        },
      };
    },
    async execute(_db, input) {
      const r = await deps.escrow.resolveDispute(input.pledgeId, input.outcome);
      return {
        ok: true as const,
        outcome: r.outcome,
        status: r.status,
        amountHalalas: r.amountHalalas.toString(),
      };
    },
  };

  /* ── single-pledge revive (orchestrated — reauthorize + capture) ─────── */
  const pledgeReviveInput = z.object({ pledgeId: z.string().uuid() });

  const pledgeRevive: OperationDef<
    z.infer<typeof pledgeReviveInput>,
    { ok: true; status: string }
  > = {
    key: 'money.pledge.revive',
    titleAr: 'إحياء تعهد فاشل القطف',
    descriptionAr:
      'يعيد إحياء تعهد واحد في FAILED_CAPTURE (انتهت مهلته): إعادة حجز مخزون المكافأة ذرّياً أولاً، ثم إعادة تفويض البطاقة والقطف فوراً. نفاد المخزون يمنع الإحياء (لا تحصيل مقابل مكافأة لا يمكن الوفاء بها)؛ رفض البوابة يعيد المخزون ويُبقي التعهد FAILED_CAPTURE. غير قابل للعكس.',
    inputSchema: pledgeReviveInput,
    permission: 'money.execute',
    riskTier: 'MONEY',
    reversible: false,
    requiresReason: true,
    orchestrated: true,
    preconditions: [
      {
        code: 'pledge-missing',
        reasonAr: 'التعهد غير موجود',
        check: async (db, input) =>
          !!(await db.pledge.findUnique({ where: { id: input.pledgeId }, select: { id: true } })),
      },
      {
        code: 'not-failed-capture',
        reasonAr: 'الإحياء يخصّ تعهداً فشل قطفه نهائياً (FAILED_CAPTURE) فقط',
        check: async (db, input) => {
          const p = await db.pledge.findUnique({
            where: { id: input.pledgeId },
            select: { status: true },
          });
          return p?.status === PledgeStatus.FAILED_CAPTURE;
        },
      },
    ],
    async dryRun(db, input) {
      const p = await db.pledge.findUnique({
        where: { id: input.pledgeId },
        include: {
          project: { select: { titleAr: true } },
          tier: { select: { limitQty: true, claimedQty: true } },
        },
      });
      if (!p) return { summaryAr: 'التعهد غير موجود', before: null, after: null };
      const amount = p.amountHalalas + p.addOnsHalalas;
      const stockAvailable =
        !p.tierId || p.tier?.limitQty == null || p.tier.claimedQty < (p.tier.limitQty ?? 0);
      return {
        summaryAr: stockAvailable
          ? `ستُعاد محاولة قطف ${amount.toString()} هللة في «${p.project.titleAr}» (إعادة تفويض + قطف)`
          : `مخزون المكافأة نافد — الإحياء سيُرفض تشغيلياً لتفادي تحصيل بلا مكافأة`,
        before: { status: p.status },
        after: { status: 'CAPTURED (عند نجاح البوابة)' },
        counts: {
          tierStockAvailable: stockAvailable ? 1 : 0,
          tierLimitQty: p.tier?.limitQty ?? 0,
          tierClaimedQty: p.tier?.claimedQty ?? 0,
        },
        monetaryDeltasHalalas: { toCapture: amount.toString() },
      };
    },
    async execute(_db, input) {
      const r = await deps.escrow.reviveFailedPledge(input.pledgeId);
      if (!r.ok) {
        // A failed revive is a RECORDED failure, never a silent no-op — the
        // orchestrated claim lands FAILED with the Arabic reason.
        throw new BadRequestException(
          r.reason === 'tier-stock-exhausted'
            ? 'تعذّر الإحياء: مخزون المكافأة نافد'
            : `تعذّر الإحياء عبر بوابة الدفع: ${r.reason ?? 'رفض المزوّد'}`,
        );
      }
      return { ok: true as const, status: r.status };
    },
  };

  /* ── residue sweep (orchestrated — FundingService owns capture/refund) ─ */
  const settleResidueInput = z.object({ projectId: z.string().uuid() });

  const settleResidue: OperationDef<
    z.infer<typeof settleResidueInput>,
    { projectId: string; swept: { ok: number; failed: number } }
  > = {
    key: 'money.settle.residue',
    titleAr: 'كنس المتبقّي بعد التسوية',
    descriptionAr:
      'يكنس أي حجوزات HELD/PENDING_REAUTH بقيت عالقة بعد تسوية المشروع (انقطاع مزوّد منتصف التسوية): FUNDED/SUCCESSFUL → قطف، REFUNDED/FAILED → فكّ. متاح بعد التسوية فقط.',
    inputSchema: settleResidueInput,
    permission: 'money.execute',
    riskTier: 'MONEY',
    reversible: false,
    requiresReason: false,
    orchestrated: true,
    preconditions: [
      {
        code: 'project-missing',
        reasonAr: 'المشروع غير موجود',
        check: async (db, input) =>
          !!(await db.project.findUnique({ where: { id: input.projectId }, select: { id: true } })),
      },
      {
        code: 'not-settled',
        reasonAr: 'كنس المتبقّي متاح بعد التسوية فقط (FUNDED/SUCCESSFUL/REFUNDED/FAILED)',
        check: async (db, input) => {
          const p = await db.project.findUnique({
            where: { id: input.projectId },
            select: { status: true },
          });
          return (
            p?.status === ProjectStatus.FUNDED ||
            p?.status === ProjectStatus.SUCCESSFUL ||
            p?.status === ProjectStatus.REFUNDED ||
            p?.status === ProjectStatus.FAILED
          );
        },
      },
    ],
    async dryRun(db, input) {
      const p = await db.project.findUnique({
        where: { id: input.projectId },
        select: { status: true, titleAr: true },
      });
      const residue = await db.pledge.count({
        where: {
          projectId: input.projectId,
          status: { in: [PledgeStatus.HELD, PledgeStatus.PENDING_REAUTH] },
        },
      });
      const capture = p?.status === ProjectStatus.FUNDED || p?.status === ProjectStatus.SUCCESSFUL;
      return {
        summaryAr: `سيُكنس ${residue} حجزاً عالقاً في «${p?.titleAr ?? '—'}» — الاتجاه: ${capture ? 'قطف (المشروع ناجح)' : 'فكّ (المشروع مسترد/فاشل)'}`,
        before: { status: p?.status ?? null, residue },
        after: { residue: 0 },
        counts: { residue, direction: capture ? 1 : 0 },
      };
    },
    async execute(_db, input) {
      return deps.funding.resettleResidue(input.projectId);
    },
  };

  /* ── counter recompute (SENSITIVE — corrects money-derived figures) ──── */
  const recomputeInput = z.object({ projectId: z.string().uuid() });

  const countersRecompute: OperationDef<
    z.infer<typeof recomputeInput>,
    { drift: Array<{ field: string; before: string; after: string }>; corrected: number }
  > = {
    key: 'money.counters.recompute',
    titleAr: 'إعادة حساب عدّادات المشروع',
    descriptionAr:
      'يعيد حساب raisedHalalas وrealizedHalalas وعدد الداعمين ومخزون كل مكافأة/إضافة من صيغها المرجعية على دفتر التعهدات، ويصحّح ما انحرف منها (انهيار منتصف عملية أو تعبئة قديمة). لا يحرّك مالاً — يصحّح أرقاماً مشتقة من المال فقط. المعاينة تُظهر الانحراف دون كتابة.',
    inputSchema: recomputeInput,
    permission: 'money.execute',
    riskTier: 'SENSITIVE',
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
      const drift = await computeCounterDrift(db, input.projectId);
      return {
        summaryAr:
          drift.length === 0
            ? 'العدّادات مطابقة للدفتر — لا انحراف'
            : `انحراف في ${drift.length} عدّاداً — المعاينة تعرض القيم دون تصحيح`,
        before: Object.fromEntries(drift.map((d) => [d.field, d.before])),
        after: Object.fromEntries(drift.map((d) => [d.field, d.after])),
        counts: { driftedFields: drift.length },
      };
    },
    async execute(_db, input) {
      const drift = await recomputeCounters(deps.prisma, input.projectId);
      return { drift, corrected: drift.length };
    },
    // The drift report is derived figures only — no PII — so it persists as-is.
    redactResult: (result) => result,
  };

  /* ── ZATCA invoice retry (SENSITIVE — idempotent regeneration) ───────── */
  const zatcaRetryInput = z.object({ payoutId: z.string().uuid() });

  const zatcaRetry: OperationDef<
    z.infer<typeof zatcaRetryInput>,
    { invoiceNumber: string; totalHalalas: string }
  > = {
    key: 'money.zatca.retry',
    titleAr: 'إعادة توليد فاتورة زاتكا يتيمة',
    descriptionAr:
      'يعيد توليد فاتورة الضريبة المبسّطة لدفعة SENT صُرفت دون ربط فاتورتها (zatcaInvoiceId فارغ). العملية idempotent — وجود فاتورة سابقة يعيدها كما هي. لا يحرّك مالاً.',
    inputSchema: zatcaRetryInput,
    permission: 'money.execute',
    riskTier: 'SENSITIVE',
    reversible: false,
    requiresReason: false,
    orchestrated: true,
    preconditions: [
      {
        code: 'payout-missing',
        reasonAr: 'الدفعة غير موجودة',
        check: async (db, input) =>
          !!(await db.payout.findUnique({ where: { id: input.payoutId }, select: { id: true } })),
      },
      {
        code: 'no-orphan',
        reasonAr: 'إعادة التوليد تخصّ دفعة SENT بلا فاتورة مربوطة فقط',
        check: async (db, input) => {
          const p = await db.payout.findUnique({
            where: { id: input.payoutId },
            select: { status: true, zatcaInvoiceId: true },
          });
          return p?.status === PayoutStatus.SENT && p.zatcaInvoiceId === null;
        },
      },
    ],
    async dryRun(db, input) {
      const p = await db.payout.findUnique({ where: { id: input.payoutId } });
      const gross = p?.amountHalalas ?? 0n;
      const fees = commissionBreakdown(gross);
      return {
        summaryAr: `ستُولّد فاتورة زاتكا مبسّطة لعمولة دفعة (${gross.toString()} هللة إجمالياً) — عمولة ${fees.commissionHalalas.toString()} + ضريبة ${fees.vatHalalas.toString()}`,
        before: { zatcaInvoiceId: p?.zatcaInvoiceId ?? null },
        after: { zatcaInvoiceId: 'WTB-<سنة>-<تسلسل>' },
        monetaryDeltasHalalas: {
          commissionHalalas: fees.commissionHalalas.toString(),
          vatHalalas: fees.vatHalalas.toString(),
          totalHalalas: fees.withheldHalalas.toString(),
        },
      };
    },
    async execute(_db, input) {
      const payout = await deps.prisma.payout.findUniqueOrThrow({ where: { id: input.payoutId } });
      const invoice = await deps.zatca.generateForPayout(payout);
      return {
        invoiceNumber: invoice.invoiceNumber,
        totalHalalas: invoice.totalHalalas.toString(),
      };
    },
  };

  return [
    deadlineOverride,
    milestoneApprove,
    milestoneRelease,
    settleRun,
    payoutDisburse,
    refundPledge,
    refundProject,
    captureRetryCohort,
    payoutRetry,
    reconcileRun,
    disputeResolve,
    pledgeRevive,
    settleResidue,
    countersRecompute,
    zatcaRetry,
  ] as unknown as Array<OperationDef<never, unknown>>;
}
