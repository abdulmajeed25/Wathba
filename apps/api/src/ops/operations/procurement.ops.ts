import { BidStatus, NotificationKind, RFQStatus } from '@prisma/client';
import { z } from 'zod';
import type { UserRole } from '@prisma/client';

import type { OperationDef } from '../operation.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { EmailService } from '../../email/email.service';

/**
 * Batch OPS-PRO Phase 1 — procurement oversight (STANDARD tier). The
 * reverse-auction domain (RFQ → SupplierBid → award) was creator-driven and
 * had no operator seat: an RFQ could only ever be AWARDED, never wound down,
 * and the SHORTLISTED bid state existed in the enum with nothing to set it.
 * These four operations give ops the missing verbs — supplier trust
 * (suppliers.verify), RFQ teardown that mirrors the award transaction's
 * bid-rejection (rfq.close / rfq.cancel), and the first writer of
 * SHORTLISTED (bids.shortlist).
 *
 * Policy: close = "no award, procurement ended normally"; cancel = "RFQ
 * withdrawn / abused" (heavier, carries a written reason). Both reject every
 * still-live bid so no supplier is left believing they are in contention.
 */

export interface ProcurementOpsDeps {
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
      throw new Error(`procurementOps deps not wired yet (accessed .${String(prop)})`);
    },
  },
) as ProcurementOpsDeps;

/** Live bids the way award() sees them — anyone still believing they might
 *  win. Closing/cancelling an RFQ rejects exactly this set. */
const LIVE_BID_STATUSES: BidStatus[] = [BidStatus.SUBMITTED, BidStatus.SHORTLISTED];

export function procurementOps(
  deps: ProcurementOpsDeps = UNWIRED_DEPS,
): Array<OperationDef<never, unknown>> {
  /* ── suppliers.verify ──────────────────────────────────────────────── */
  const verifyInput = z.object({
    userId: z.string().uuid(),
    note: z.string().max(500).optional(),
  });

  const suppliersVerify: OperationDef<
    z.infer<typeof verifyInput>,
    { verifiedAt: string }
  > = {
    key: 'suppliers.verify',
    titleAr: 'توثيق مورّد',
    descriptionAr:
      'يوثّق حساباً يحمل دور المورّد (SUPPLIER) بعد مراجعة تشغيلية — التوثيق شرط ثقة قبل قبول عروضه. يُسجَّل الفاعل والملاحظة، والتاريخ يُختم بوقت العملية. التراجع (إلغاء التوثيق) قرار مستقبلي منفصل.',
    inputSchema: verifyInput,
    // OPS-360 A6 — off SUPPORT's users.lifecycle onto projects.lifecycle,
    // consistent with the rfq.* procurement ops (OWNER + OPS_MANAGER).
    permission: 'projects.lifecycle',
    riskTier: 'STANDARD',
    reversible: true,
    requiresReason: false,
    preconditions: [
      {
        code: 'user-missing',
        reasonAr: 'المستخدم غير موجود',
        check: async (db, input) =>
          !!(await db.user.findUnique({ where: { id: input.userId }, select: { id: true } })),
      },
      {
        code: 'not-a-supplier',
        reasonAr: 'لا يُوثَّق إلا حسابٌ يحمل دور المورّد (SUPPLIER)',
        check: async (db, input) => {
          const u = await db.user.findUnique({
            where: { id: input.userId },
            select: { roles: true },
          });
          return u?.roles.includes('SUPPLIER' as UserRole) ?? false;
        },
      },
      {
        code: 'already-verified',
        reasonAr: 'المورّد موثّق أصلاً',
        check: async (db, input) => {
          const u = await db.user.findUnique({
            where: { id: input.userId },
            select: { supplierVerifiedAt: true },
          });
          return u?.supplierVerifiedAt == null;
        },
      },
    ],
    async dryRun(db, input) {
      const u = await db.user.findUnique({
        where: { id: input.userId },
        select: { name: true, supplierVerifiedAt: true },
      });
      return {
        summaryAr: `سيُوثَّق المورّد «${u?.name ?? input.userId}» ويُفتح قبول عروضه`,
        before: { supplierVerifiedAt: u?.supplierVerifiedAt?.toISOString() ?? null },
        after: { supplierVerifiedAt: 'now', note: input.note ?? null },
      };
    },
    async execute(tx, input, ctx) {
      const now = new Date();
      await tx.user.update({
        where: { id: input.userId },
        data: {
          supplierVerifiedAt: now,
          // ctx.actor.id may be a non-uuid system id; the column is @db.Uuid,
          // so store it only when it is a real uuid (audit row is the authority).
          supplierVerifiedById: /^[0-9a-f-]{36}$/i.test(ctx.actor.id) ? ctx.actor.id : null,
          supplierVerifyNote: input.note ?? null,
        },
      });
      return { verifiedAt: now.toISOString(), userId: input.userId } as { verifiedAt: string };
    },
    async afterCommit(_result, input) {
      // Trust event — the supplier is told their account is now verified; no
      // dedicated email template exists, so notification only.
      await deps.notifications.create({
        userId: input.userId,
        kind: NotificationKind.SUPPLIER_VERIFIED,
        payload: {},
      });
    },
  };

  /* ── rfq.close ─────────────────────────────────────────────────────── */
  const rfqRef = z.object({ rfqId: z.string().uuid() });

  const rfqClose: OperationDef<
    z.infer<typeof rfqRef>,
    { status: string; bidsRejected: number }
  > = {
    key: 'rfq.close',
    titleAr: 'إغلاق طلب توريد (دون ترسية)',
    descriptionAr:
      'ينهي طلب توريد مفتوحاً دون ترسية على أي مورّد (OPEN→CLOSED): التوريد انتهى طبيعياً بلا اختيار. كل عرض ما زال حياً (SUBMITTED/SHORTLISTED) يُرفَض كما في معاملة الترسية، فلا يبقى مورّد يظن نفسه في المنافسة.',
    inputSchema: rfqRef,
    permission: 'projects.lifecycle',
    riskTier: 'STANDARD',
    reversible: false,
    requiresReason: false,
    preconditions: [
      {
        code: 'rfq-missing',
        reasonAr: 'طلب التوريد غير موجود',
        check: async (db, input) =>
          !!(await db.rFQ.findUnique({ where: { id: input.rfqId }, select: { id: true } })),
      },
      {
        code: 'not-open',
        reasonAr: 'طلب التوريد ليس مفتوحاً (OPEN) — لا يُغلق إلا المفتوح',
        check: async (db, input) => {
          const r = await db.rFQ.findUnique({
            where: { id: input.rfqId },
            select: { status: true },
          });
          return r?.status === RFQStatus.OPEN;
        },
      },
    ],
    async dryRun(db, input) {
      const openBids = await db.supplierBid.count({
        where: { rfqId: input.rfqId, status: { in: LIVE_BID_STATUSES } },
      });
      return {
        summaryAr: `سيُغلق طلب التوريد دون ترسية ويُرفَض ${openBids} عرضاً حياً`,
        before: { status: RFQStatus.OPEN, liveBids: openBids },
        after: { status: RFQStatus.CLOSED, liveBids: 0 },
        counts: { bidsToReject: openBids },
      };
    },
    async execute(tx, input) {
      await tx.rFQ.update({
        where: { id: input.rfqId },
        data: { status: RFQStatus.CLOSED },
      });
      const { count } = await tx.supplierBid.updateMany({
        where: { rfqId: input.rfqId, status: { in: LIVE_BID_STATUSES } },
        data: { status: BidStatus.REJECTED },
      });
      return { status: RFQStatus.CLOSED, bidsRejected: count };
    },
  };

  /* ── rfq.cancel ────────────────────────────────────────────────────── */
  const rfqCancel: OperationDef<
    z.infer<typeof rfqRef>,
    { status: string; bidsRejected: number }
  > = {
    key: 'rfq.cancel',
    titleAr: 'إلغاء طلب توريد',
    descriptionAr:
      'يلغي طلب توريد مفتوحاً (OPEN→CANCELLED): الإلغاء أثقل من الإغلاق — يعني سحب الطلب أو إساءة استخدامه، لا انتهاءً طبيعياً، ويتطلب سبباً مكتوباً. كل عرض حيّ (SUBMITTED/SHORTLISTED) يُرفَض.',
    inputSchema: rfqRef,
    permission: 'projects.lifecycle',
    riskTier: 'STANDARD',
    reversible: false,
    requiresReason: true,
    preconditions: [
      {
        code: 'rfq-missing',
        reasonAr: 'طلب التوريد غير موجود',
        check: async (db, input) =>
          !!(await db.rFQ.findUnique({ where: { id: input.rfqId }, select: { id: true } })),
      },
      {
        code: 'not-cancellable',
        reasonAr: 'طلب التوريد ليس مفتوحاً (OPEN) — لا يُلغى إلا المفتوح',
        check: async (db, input) => {
          const r = await db.rFQ.findUnique({
            where: { id: input.rfqId },
            select: { status: true },
          });
          return r?.status === RFQStatus.OPEN;
        },
      },
    ],
    async dryRun(db, input) {
      const openBids = await db.supplierBid.count({
        where: { rfqId: input.rfqId, status: { in: LIVE_BID_STATUSES } },
      });
      return {
        summaryAr: `سيُلغى طلب التوريد ويُرفَض ${openBids} عرضاً حياً`,
        before: { status: RFQStatus.OPEN, liveBids: openBids },
        after: { status: RFQStatus.CANCELLED, liveBids: 0 },
        counts: { bidsToReject: openBids },
      };
    },
    async execute(tx, input) {
      await tx.rFQ.update({
        where: { id: input.rfqId },
        data: { status: RFQStatus.CANCELLED },
      });
      const { count } = await tx.supplierBid.updateMany({
        where: { rfqId: input.rfqId, status: { in: LIVE_BID_STATUSES } },
        data: { status: BidStatus.REJECTED },
      });
      return { status: RFQStatus.CANCELLED, bidsRejected: count };
    },
  };

  /* ── bids.shortlist ────────────────────────────────────────────────── */
  const bidRef = z.object({ bidId: z.string().uuid() });

  const bidsShortlist: OperationDef<
    z.infer<typeof bidRef>,
    { id: string; status: string }
  > = {
    key: 'bids.shortlist',
    titleAr: 'ترشيح عرض مورّد',
    descriptionAr:
      'يرشّح عرضاً مقدَّماً (SUBMITTED→SHORTLISTED) ضمن طلب توريد ما زال مفتوحاً — تمييز قبل الترسية دون إقصاء البقية. أول كاتب لهذه الحالة في مسار الشراء.',
    inputSchema: bidRef,
    permission: 'projects.lifecycle',
    riskTier: 'STANDARD',
    reversible: true,
    requiresReason: false,
    preconditions: [
      {
        code: 'bid-missing',
        reasonAr: 'العرض غير موجود',
        check: async (db, input) =>
          !!(await db.supplierBid.findUnique({ where: { id: input.bidId }, select: { id: true } })),
      },
      {
        code: 'rfq-not-open',
        reasonAr: 'طلب التوريد المرتبط بالعرض ليس مفتوحاً — لا ترشيح بعد الإغلاق أو الترسية',
        check: async (db, input) => {
          const bid = await db.supplierBid.findUnique({
            where: { id: input.bidId },
            select: { rfq: { select: { status: true } } },
          });
          return bid?.rfq.status === RFQStatus.OPEN;
        },
      },
      {
        code: 'not-submitted',
        reasonAr: 'العرض ليس في حالة تقديم (SUBMITTED) — لا يُرشَّح إلا المقدَّم',
        check: async (db, input) => {
          const bid = await db.supplierBid.findUnique({
            where: { id: input.bidId },
            select: { status: true },
          });
          return bid?.status === BidStatus.SUBMITTED;
        },
      },
    ],
    async dryRun(db, input) {
      const bid = await db.supplierBid.findUnique({
        where: { id: input.bidId },
        select: { status: true, amountHalalas: true },
      });
      return {
        summaryAr: `سيُرشَّح العرض (${bid?.amountHalalas?.toString() ?? '—'} هللة) ضمن الطلب المفتوح`,
        before: { status: bid?.status ?? null },
        after: { status: BidStatus.SHORTLISTED },
      };
    },
    async execute(tx, input) {
      const updated = await tx.supplierBid.update({
        where: { id: input.bidId },
        data: { status: BidStatus.SHORTLISTED },
      });
      return { id: updated.id, status: updated.status };
    },
  };

  /* ── rfq.award (OPS-360 Unit 6 — the award-override) ───────────────── */
  // Census A7 workflow drop-out: RFQ award was creator-only
  // (procurement.service.ts:award requires rfq.project.createdById === actor),
  // so an operator could never award a stuck/abandoned RFQ from the dashboard.
  // This is the missing operator seat — same transaction as the creator path,
  // now governed (reason + audit + dry-run blast radius).
  const awardInput = z.object({
    rfqId: z.string().uuid(),
    bidId: z.string().uuid(),
  });

  const rfqAward: OperationDef<
    z.infer<typeof awardInput>,
    { status: string; awardedBidId: string; bidsRejected: number }
  > = {
    key: 'rfq.award',
    titleAr: 'ترسية طلب توريد (تجاوز إشرافي)',
    descriptionAr:
      'المقعد التشغيلي المفقود للترسية: كانت الترسية حكراً على صاحب المشروع، فلا يستطيع مشغّل مركز العمليات ترسية طلب عالق. يُرسي هذا العرض الفائز على طلب مفتوح (OPEN→AWARDED) بنفس معاملة الترسية تماماً: العرض الفائز→AWARDED، وكل عرض آخر في الطلب→REJECTED، ويُختم awardedBidId. غير قابل للعكس ويتطلب سبباً مكتوباً.',
    inputSchema: awardInput,
    // Same permission as the other rfq.* ops (OWNER + OPS_MANAGER).
    permission: 'projects.lifecycle',
    riskTier: 'STANDARD',
    reversible: false,
    requiresReason: true,
    preconditions: [
      {
        code: 'rfq-not-open',
        reasonAr: 'طلب التوريد غير موجود أو ليس مفتوحاً (OPEN) — لا تُرسى إلا الطلبات المفتوحة',
        check: async (db, input) => {
          const r = await db.rFQ.findUnique({
            where: { id: input.rfqId },
            select: { status: true },
          });
          return r?.status === RFQStatus.OPEN;
        },
      },
      {
        code: 'bid-not-eligible',
        reasonAr:
          'العرض غير موجود أو لا يتبع هذا الطلب أو ليس مؤهلاً للترسية (المؤهل: SUBMITTED أو SHORTLISTED)',
        check: async (db, input) => {
          const bid = await db.supplierBid.findUnique({
            where: { id: input.bidId },
            select: { rfqId: true, status: true },
          });
          return !!bid && bid.rfqId === input.rfqId && LIVE_BID_STATUSES.includes(bid.status);
        },
      },
    ],
    async dryRun(db, input) {
      const [bid, others] = await Promise.all([
        db.supplierBid.findUnique({
          where: { id: input.bidId },
          select: { amountHalalas: true },
        }),
        // Mirrors execute: every OTHER bid on the RFQ is rejected, whatever its
        // current status (exactly as the creator-path award transaction does).
        db.supplierBid.count({ where: { rfqId: input.rfqId, id: { not: input.bidId } } }),
      ]);
      return {
        summaryAr: `سيُرسى العرض (${bid?.amountHalalas?.toString() ?? '—'} هللة) — الطلب OPEN→AWARDED ويُرفَض ${others} عرضاً آخر`,
        before: { status: RFQStatus.OPEN, awardedBidId: null },
        after: { status: RFQStatus.AWARDED, awardedBidId: input.bidId },
        counts: { winningBid: 1, bidsToReject: others },
      };
    },
    async execute(tx, input) {
      // Byte-for-byte the procurement.service.ts:award transaction — RFQ head,
      // winning bid, then reject-the-rest — so the operator override and the
      // creator path leave identical state.
      await tx.rFQ.update({
        where: { id: input.rfqId },
        data: { status: RFQStatus.AWARDED, awardedBidId: input.bidId },
      });
      await tx.supplierBid.update({
        where: { id: input.bidId },
        data: { status: BidStatus.AWARDED },
      });
      const { count } = await tx.supplierBid.updateMany({
        where: { rfqId: input.rfqId, id: { not: input.bidId } },
        data: { status: BidStatus.REJECTED },
      });
      return { status: RFQStatus.AWARDED, awardedBidId: input.bidId, bidsRejected: count };
    },
    // OPS-GAPS R2 — notify the winning supplier (in-app + email). Parity with
    // the creator path (procurement.service.notifyAwardWinner); same dedupKey
    // so a bid can't be double-notified across the two award paths.
    async afterCommit(_result, input) {
      try {
        const bid = await deps.prisma.supplierBid.findUnique({
          where: { id: input.bidId },
          select: { supplierId: true },
        });
        if (!bid) return;
        const rfq = await deps.prisma.rFQ.findUnique({
          where: { id: input.rfqId },
          select: { project: { select: { titleAr: true } } },
        });
        const projectTitleAr = rfq?.project?.titleAr ?? 'مشروع';
        await deps.notifications.create({
          userId: bid.supplierId,
          kind: NotificationKind.RFQ_AWARDED,
          payload: { projectTitleAr, rfqId: input.rfqId },
        });
        const supplier = await deps.prisma.user.findUnique({
          where: { id: bid.supplierId },
          select: { email: true },
        });
        if (supplier?.email) {
          await deps.email.rfqAwarded(supplier.email, { projectTitle: projectTitleAr });
        }
      } catch {
        /* best-effort — the award already committed */
      }
    },
  };

  return [suppliersVerify, rfqClose, rfqCancel, bidsShortlist, rfqAward] as unknown as Array<
    OperationDef<never, unknown>
  >;
}
