import { ForbiddenException, Injectable } from '@nestjs/common';

import { commissionBreakdown } from '../../config/fees';
import { PrismaService } from '../../prisma/prisma.service';
import { permissionMatches } from '../permissions';

/**
 * OPS-360 Phase B · Unit 5 — the ANALYTICS AGGREGATE surface.
 *
 * Census A4 found analytics is a dashboard-snapshot stub: ~13 metrics are
 * computed-but-invisible (commission-earned Σ, VAT-collected Σ) or trivially
 * derivable-but-missing (success/refund/capture-failure rates, per-category
 * performance, KYC conversion, distinct backers, funnels, pledged-vs-realized).
 * This service is the READ-ONLY analytics sibling of the ops read layer: it
 * ONLY groupBy/aggregate/count — never a per-row loop, never a write.
 *
 * Invariants (mirror ops-read.service.ts):
 *  · ZERO writes. This is pinned by the governance spec (RULE 4 carve-out +
 *    RULE 5 `[]` = zero mutating calls).
 *  · Money is always emitted as halalas STRINGS (BigInt is not JSON-safe).
 *  · Every endpoint accepts a ?from&to window with a sane default; the exact
 *    window used is echoed back in the DTO so a screen never guesses.
 *  · HONESTY over fabrication — a metric that cannot be computed from current
 *    data returns `null` + a `note` explaining why (top-of-funnel has no
 *    readable AnalyticsEvent source; CommentReport has no resolution column),
 *    and a percentage over an empty denominator returns null rather than 0/NaN.
 */

/** BigInt (halalas) → JSON-safe string; null/undefined → '0'. */
function h0(v: bigint | number | null | undefined): string {
  return v === null || v === undefined ? '0' : v.toString();
}

function iso(d: Date): string {
  return d.toISOString();
}

/**
 * Percentage with an HONEST empty-denominator path: 0 rows to divide by is
 * "cannot be computed", NOT 0% — so we return null (the screen shows "—"),
 * never a fabricated 0 or a NaN. Rounded to 2 decimals.
 */
function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

const DAY_MS = 24 * 60 * 60_000;

export interface AnalyticsWindow {
  from?: Date;
  to?: Date;
}
export interface ResolvedWindow {
  from: string;
  to: string;
  defaultDays: number;
}

/**
 * Resolve the ?from&to range with a sane default (last N days). Returns both
 * the Date bounds (for the queries) and the ISO window (for the DTO echo).
 */
function resolveWindow(w: AnalyticsWindow, defaultDays: number): { from: Date; to: Date; dto: ResolvedWindow } {
  const to = w.to ?? new Date();
  const from = w.from ?? new Date(to.getTime() - defaultDays * DAY_MS);
  return { from, to, dto: { from: iso(from), to: iso(to), defaultDays } };
}

@Injectable()
export class OpsAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The one permission gate the analytics controller delegates to — pure, no
   * I/O, identical to the ops-read gate. '*' (OWNER) matches everything;
   * refusal is the standard Arabic 403 the whole ops surface speaks.
   */
  assertPermission(principal: { permissions: readonly string[] }, permission: string): void {
    if (!permissionMatches(principal.permissions, permission)) {
      throw new ForbiddenException(`تفتقد الصلاحية المطلوبة: ${permission}`);
    }
  }

  /* ── 1. FINANCIAL (money.execute) ──────────────────────────────────────────
   * The financial report — surfaces the census's "computed-but-invisible"
   * commission (ledger COMMISSION) and VAT (ZatcaInvoice.vatHalalas). Every
   * money leg is date-ranged (default last 30 days) EXCEPT the pending-payout
   * liability, which is by nature a CURRENT snapshot (what the platform still
   * owes right now) — flagged as such in the DTO.
   */
  async financial(w: AnalyticsWindow) {
    const { from, to, dto } = resolveWindow(w, 30);
    const range = { createdAt: { gte: from, lte: to } };
    const [ledgerByType, vatAgg, pledgedAgg, refundAgg, pendingPayoutAgg] = await Promise.all([
      // One grouped pass over the journal → GMV (CAPTURE), commission
      // (COMMISSION) and payout-sent (PAYOUT_SENT) in a single query.
      this.prisma.ledgerEntry.groupBy({
        by: ['entryType'],
        where: range,
        _sum: { amountHalalas: true },
      }),
      // VAT collected — from the ZATCA invoices issued in the window.
      this.prisma.zatcaInvoice.aggregate({
        where: { issuedAt: { gte: from, lte: to } },
        _sum: { vatHalalas: true, commissionHalalas: true },
      }),
      // Gross pledged in the window (what backers committed).
      this.prisma.pledge.aggregate({ where: range, _sum: { amountHalalas: true } }),
      // Refunds actually paid out in the window (refundedAt, not createdAt).
      this.prisma.pledge.aggregate({
        where: { status: 'REFUNDED', refundedAt: { gte: from, lte: to } },
        _sum: { amountHalalas: true },
        _count: { _all: true },
      }),
      // Current pending-payout liability (snapshot, window-independent).
      this.prisma.payout.aggregate({ where: { status: 'PENDING' }, _sum: { amountHalalas: true } }),
    ]);

    const byType = new Map(ledgerByType.map((g) => [g.entryType, g._sum.amountHalalas ?? 0n]));
    const pendingGross = pendingPayoutAgg._sum.amountHalalas ?? 0n;
    const pendingNet = commissionBreakdown(pendingGross).netHalalas;

    return {
      window: dto,
      gmvHalalas: h0(byType.get('CAPTURE')),
      commissionEarnedHalalas: h0(byType.get('COMMISSION')),
      vatCollectedHalalas: h0(vatAgg._sum.vatHalalas),
      grossPledgedHalalas: h0(pledgedAgg._sum.amountHalalas),
      refundTotalHalalas: h0(refundAgg._sum.amountHalalas),
      refundCount: refundAgg._count._all,
      payoutSentHalalas: h0(byType.get('PAYOUT_SENT')),
      // Snapshot (NOT window-scoped) — the truthful NET still owed. Derived
      // with the SAME commissionBreakdown() the disburser uses so the report
      // and the disbursement can never disagree on the basis (census A4 bug:
      // the old tile released GROSS because PENDING net=null).
      pendingPayoutGrossHalalas: h0(pendingGross),
      pendingPayoutLiabilityNetHalalas: h0(pendingNet),
      pendingLiabilityIsSnapshot: true as const,
      generatedAt: new Date().toISOString(),
    };
  }

  /* ── 2. FUNNEL (analytics.read) ────────────────────────────────────────────
   * visit→signup→verify→pledge→repeat, AS FAR AS THE DATA HONESTLY ALLOWS.
   * Top-of-funnel (visits/signups-as-events) is NOT readable: AnalyticsEvent is
   * write-only — collected, never read anywhere (census A2/A4). We DO NOT
   * fabricate a visit count; `visits` and its drop-off are null with a note.
   *
   * The verification legs (signups → emailVerified → nafathVerified) are NESTED
   * over the SAME window cohort (created in range), so their drop-offs are
   * truthful. Pledgers/repeat are ENGAGEMENT — not a strict subset of the
   * verification cohort — so we expose the pledger→repeat drop-off but do NOT
   * invent a nafath→pledger "drop-off" that could exceed 100% or go negative.
   */
  async funnel(w: AnalyticsWindow) {
    const { from, to, dto } = resolveWindow(w, 30);
    const cohort = { createdAt: { gte: from, lte: to } };
    const [signups, emailVerified, nafathVerified, pledgerGroups] = await Promise.all([
      this.prisma.user.count({ where: cohort }),
      this.prisma.user.count({ where: { ...cohort, emailVerified: true } }),
      this.prisma.user.count({ where: { ...cohort, nafathVerified: true } }),
      // Distinct backers who pledged in the window + their in-window pledge
      // count — one grouped pass, no per-row loop.
      this.prisma.pledge.groupBy({
        by: ['backerId'],
        where: cohort,
        _count: { _all: true },
      }),
    ]);

    const pledgers = pledgerGroups.length;
    const repeatPledgers = pledgerGroups.filter((g) => g._count._all > 1).length;

    return {
      window: dto,
      stages: {
        // HONEST NULL — no readable top-of-funnel source.
        visits: null,
        signups,
        emailVerified,
        nafathVerified,
        pledgers,
        repeatPledgers,
      },
      dropOff: {
        // HONEST NULL — cannot be computed without a visit source.
        visitToSignupPct: null,
        signupToEmailVerifiedPct: pct(emailVerified, signups),
        emailVerifiedToNafathVerifiedPct: pct(nafathVerified, emailVerified),
        pledgerToRepeatPct: pct(repeatPledgers, pledgers),
      },
      notes: {
        topOfFunnel:
          'لا يوجد مصدر قابل للقراءة لأعلى القمع (زيارات/تسجيلات كأحداث): جدول AnalyticsEvent يُكتب ولا يُقرأ في أي مكان (تعداد A2/A4). أُعيدت القيمة null بدلاً من تلفيقها.',
        pledgeStage:
          'المتعهّدون/المتعهّدون المتكرّرون مقياس تفاعل ضمن النافذة وليسوا مجموعة فرعية صارمة من المتحقَّقين عبر نفاذ (يمكن التبرّع دون نفاذ)، لذلك لا يُحسب هبوط نفاذ→تعهّد.',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /* ── 3. PROJECTS (analytics.read) ──────────────────────────────────────────
   * Success rate, status distribution, per-category performance, and the
   * pledged-vs-realized platform contrast — over projects CREATED in the window
   * (default last 90 days). Success rate is measured over CONCLUDED projects
   * only (FUNDED+SUCCESSFUL vs FAILED+REFUNDED per census A4); in-flight states
   * (LIVE/DRAFT/…) are neither a win nor a loss and are excluded from the ratio.
   */
  async projects(w: AnalyticsWindow) {
    const { from, to, dto } = resolveWindow(w, 90);
    const range = { createdAt: { gte: from, lte: to } };
    const [byStatus, byCategory, totals] = await Promise.all([
      this.prisma.project.groupBy({ by: ['status'], where: range, _count: { _all: true } }),
      this.prisma.project.groupBy({
        by: ['categoryId'],
        where: range,
        _sum: { raisedHalalas: true },
        _count: { _all: true },
      }),
      this.prisma.project.aggregate({
        where: range,
        _sum: { raisedHalalas: true, realizedHalalas: true },
      }),
    ]);

    const statusDistribution: Record<string, number> = {};
    let totalProjects = 0;
    for (const g of byStatus) {
      statusDistribution[g.status] = g._count._all;
      totalProjects += g._count._all;
    }
    const won = (statusDistribution.FUNDED ?? 0) + (statusDistribution.SUCCESSFUL ?? 0);
    const lost = (statusDistribution.FAILED ?? 0) + (statusDistribution.REFUNDED ?? 0);
    const concluded = won + lost;

    // Join category names for the grouped ids in ONE query (never per-row).
    const categoryIds = byCategory.map((g) => g.categoryId).filter((id): id is string => id !== null);
    const categories = categoryIds.length
      ? await this.prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, nameAr: true },
        })
      : [];
    const nameById = new Map(categories.map((c) => [c.id, c.nameAr]));

    const pledged = totals._sum.raisedHalalas ?? 0n;
    const realized = totals._sum.realizedHalalas ?? 0n;

    return {
      window: dto,
      totalProjects,
      statusDistribution,
      successRatePct: pct(won, concluded),
      concludedCount: concluded,
      wonCount: won,
      lostCount: lost,
      perCategory: byCategory
        .map((g) => ({
          categoryId: g.categoryId,
          categoryNameAr: g.categoryId ? (nameById.get(g.categoryId) ?? null) : null,
          projectCount: g._count._all,
          raisedHalalas: h0(g._sum.raisedHalalas),
        }))
        .sort((a, b) => (BigInt(b.raisedHalalas) > BigInt(a.raisedHalalas) ? 1 : -1)),
      pledgedVsRealized: {
        pledgedHalalas: h0(pledged),
        realizedHalalas: h0(realized),
        // What share of pledged money was actually captured — null if nothing
        // was pledged in the window (honest empty-denominator path).
        realizationRatePct: pct(Number(realized), Number(pledged)),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /* ── 4. USERS (analytics.read) ─────────────────────────────────────────────
   * KYC conversion, distinct backers, reputation-tier distribution, active
   * sessions, suspended/banned. The KYC/tier/session/suspension figures are
   * platform-CURRENT snapshots (flagged); the window scopes new-signups and the
   * in-window distinct-backer count so ?from&to is honoured meaningfully.
   */
  async users(w: AnalyticsWindow) {
    const { from, to, dto } = resolveWindow(w, 30);
    const now = new Date();
    const [
      totalUsers,
      newUsers,
      nafathVerified,
      tierGroups,
      activeSessionCount,
      suspendedCount,
      bannedCount,
      activeBackerGroups,
      windowBackerGroups,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: from, lte: to } } }),
      this.prisma.user.count({ where: { nafathVerified: true } }),
      this.prisma.user.groupBy({ by: ['reputationTier'], _count: { _all: true } }),
      this.prisma.refreshToken.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
      this.prisma.user.count({ where: { suspendedKind: 'SUSPENDED' } }),
      this.prisma.user.count({ where: { suspendedKind: 'BANNED' } }),
      // Distinct backers with an ACTIVE (captured) pledge — snapshot.
      this.prisma.pledge.groupBy({ by: ['backerId'], where: { status: 'CAPTURED' }, _count: { _all: true } }),
      // Distinct backers who pledged within the window.
      this.prisma.pledge.groupBy({
        by: ['backerId'],
        where: { createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
    ]);

    const reputationTiers: Record<string, number> = {};
    for (const g of tierGroups) reputationTiers[g.reputationTier] = g._count._all;

    return {
      window: dto,
      totalUsers,
      newUsersInWindow: newUsers,
      kyc: {
        nafathVerified,
        total: totalUsers,
        conversionPct: pct(nafathVerified, totalUsers),
        isSnapshot: true as const,
      },
      distinctBackers: activeBackerGroups.length,
      distinctBackersInWindow: windowBackerGroups.length,
      reputationTiers,
      activeSessionCount,
      suspendedCount,
      bannedCount,
      snapshotNote:
        'مقاييس KYC/الرتب/الجلسات/الإيقاف لقطة حالية للمنصّة وليست محصورة بالنافذة؛ النافذة تحصر المستخدمين الجدد والمتعهّدين ضمن الفترة فقط.',
      generatedAt: new Date().toISOString(),
    };
  }

  /* ── 5. OPERATIONS (analytics.read) ────────────────────────────────────────
   * Operational health: capture-failure TRUE rate, refund rate, dispute rate,
   * moderation throughput, support-ticket volume by status, payout success.
   * All window-scoped on createdAt (default last 30 days). CommentReport has NO
   * resolution column in the schema, so comment-report "resolved" is an HONEST
   * null with a note — we never fabricate a resolution the data can't back.
   */
  async operations(w: AnalyticsWindow) {
    const { from, to, dto } = resolveWindow(w, 30);
    const range = { createdAt: { gte: from, lte: to } };
    const [
      captureCount,
      failedCaptureCount,
      pledgeStatusGroups,
      totalPledges,
      projectReportsOpened,
      projectReportsResolved,
      commentReportsOpened,
      ticketStatusGroups,
      payoutStatusGroups,
    ] = await Promise.all([
      // Successful captures = CAPTURE ledger rows in the window.
      this.prisma.ledgerEntry.count({ where: { entryType: 'CAPTURE', ...range } }),
      // FAILED_CAPTURE pledges = the "true" failures after grace expiry.
      this.prisma.pledge.count({ where: { status: 'FAILED_CAPTURE', ...range } }),
      this.prisma.pledge.groupBy({ by: ['status'], where: range, _count: { _all: true } }),
      this.prisma.pledge.count({ where: range }),
      this.prisma.projectReport.count({ where: range }),
      // Resolved WITHIN the window (resolvedAt in range), regardless of when opened.
      this.prisma.projectReport.count({ where: { resolvedAt: { gte: from, lte: to } } }),
      this.prisma.commentReport.count({ where: range }),
      this.prisma.supportTicket.groupBy({ by: ['status'], where: range, _count: { _all: true } }),
      this.prisma.payout.groupBy({ by: ['status'], where: range, _count: { _all: true } }),
    ]);

    const pledgeByStatus = new Map(pledgeStatusGroups.map((g) => [g.status, g._count._all]));
    const refundedCount = pledgeByStatus.get('REFUNDED') ?? 0;
    const disputedCount = pledgeByStatus.get('DISPUTED') ?? 0;

    const supportTicketsByStatus: Record<string, number> = {};
    for (const g of ticketStatusGroups) supportTicketsByStatus[g.status] = g._count._all;

    const payoutByStatus = new Map(payoutStatusGroups.map((g) => [g.status, g._count._all]));
    const payoutSent = payoutByStatus.get('SENT') ?? 0;
    const payoutFailed = payoutByStatus.get('FAILED') ?? 0;

    return {
      window: dto,
      captureFailure: {
        successfulCaptureCount: captureCount,
        failedCaptureCount,
        // TRUE rate = failures / (successes + failures) — census A4.
        trueRatePct: pct(failedCaptureCount, captureCount + failedCaptureCount),
      },
      refundRate: {
        refundedCount,
        totalPledges,
        ratePct: pct(refundedCount, totalPledges),
      },
      disputeRate: {
        disputedCount,
        totalPledges,
        ratePct: pct(disputedCount, totalPledges),
      },
      moderation: {
        projectReportsOpened,
        projectReportsResolved,
        projectThroughputPct: pct(projectReportsResolved, projectReportsOpened),
        commentReportsOpened,
        // HONEST NULL — CommentReport has no resolvedAt column in the schema,
        // so comment-report resolution is not computable from current data.
        commentReportsResolved: null,
        note: 'لا يملك CommentReport عموداً لوقت الحل (resolvedAt) في المخطط، لذا يتعذّر حساب معدّل حلّ بلاغات التعليقات — أُعيدت null.',
      },
      supportTicketsByStatus,
      payoutSuccess: {
        sentCount: payoutSent,
        failedCount: payoutFailed,
        successRatePct: pct(payoutSent, payoutSent + payoutFailed),
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
