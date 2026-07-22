import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  type LedgerEntryType,
  type PayoutStatus,
  type PledgeStatus,
  type ProjectStatus,
  type RFQStatus,
  type SupportTicketStatus,
  type UserRole,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';
import { permissionMatches } from '../permissions';
import { maskEmail, maskPhone } from '../pii';

/**
 * Batch OPS-PRO Phase 2 — the OPS READ surface. The registry owns every
 * MUTATION; this service is its READ-ONLY sibling: the server-side list/detail
 * endpoints the 16 operator screens consume. RULE (mirrors the audit browser):
 * ZERO writes here — findMany/count/aggregate only.
 *
 * Invariants every method upholds:
 *  · PII is masked by DEFAULT — email/phone are the governed unmaskable fields
 *    (users.pii.unmask is a separate audited op); a list NEVER reveals them.
 *  · Money is always emitted as halalas STRINGS (BigInt is not JSON-safe and
 *    the screens format halalas → SAR themselves).
 *  · Lists are server-paginated: opaque `cursor` (the last row id) + `limit`
 *    (default 50, hard max 100), newest-first by (createdAt, id).
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export function clampLimit(limit?: number): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

/** BigInt (halalas) → JSON-safe string; null/undefined → null. */
function h(v: bigint | number | null | undefined): string | null {
  return v === null || v === undefined ? null : v.toString();
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/* ── filter inputs ─────────────────────────────────────────────────────── */

export interface CursorFilter {
  cursor?: string;
  limit?: number;
}
export interface ProjectListFilter extends CursorFilter {
  status?: string;
  categoryId?: string;
  q?: string;
  hidden?: boolean;
}
export interface UserListFilter extends CursorFilter {
  role?: string;
  status?: 'active' | 'suspended' | 'banned';
  q?: string;
}
export interface PledgeListFilter extends CursorFilter {
  projectId?: string;
  status?: string;
  backerId?: string;
}
export interface PayoutListFilter extends CursorFilter {
  status?: string;
}
export interface LedgerListFilter extends CursorFilter {
  entryType?: string;
  projectId?: string;
  pledgeId?: string;
  from?: Date;
  to?: Date;
}
export interface TicketListFilter extends CursorFilter {
  status?: string;
  assignedToId?: string;
  q?: string;
}
export interface RfqListFilter extends CursorFilter {
  status?: string;
  projectId?: string;
}

@Injectable()
export class OpsReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * The one permission gate the read controller delegates to. Pure — no I/O,
   * no legacy fallback: an ops principal always arrives with resolved
   * permissions. '*' (OWNER) matches everything. Refusal is the standard
   * Arabic 403 the whole ops surface speaks.
   */
  assertPermission(principal: { permissions: readonly string[] }, permission: string): void {
    if (!permissionMatches(principal.permissions, permission)) {
      throw new ForbiddenException(`تفتقد الصلاحية المطلوبة: ${permission}`);
    }
  }

  /** newest-first cursor args + slicing. Fetch take+1 to know hasMore. */
  private pageArgs(f: CursorFilter): { take: number; extra: Record<string, unknown> } {
    const take = clampLimit(f.limit);
    return {
      take,
      extra: {
        take: take + 1,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
      },
    };
  }

  private slice<T extends { id: string }, D>(rows: T[], take: number, map: (r: T) => D): Page<D> {
    const hasMore = rows.length > take;
    const page = rows.slice(0, take);
    return {
      items: page.map(map),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    };
  }

  /* ── 1. DASHBOARD — the command-center morning board (analytics.read) ──── */

  async dashboard() {
    const [
      projectsUnderReview,
      milestonesSubmitted,
      payoutsPending,
      payoutsFailed,
      projectReportsOpen,
      commentReportsOpen,
      pledgesCaptureGrace,
      pledgesFailedCapture,
      ticketsOpen,
      liveAgg,
      liveCount,
      usersCount,
      gmvAgg,
      pendingPayoutAgg,
      refundCount,
    ] = await Promise.all([
      this.prisma.project.count({ where: { status: 'UNDER_REVIEW' } }),
      this.prisma.milestone.count({ where: { status: 'SUBMITTED' } }),
      this.prisma.payout.count({ where: { status: 'PENDING' } }),
      this.prisma.payout.count({ where: { status: 'FAILED' } }),
      this.prisma.projectReport.count({ where: { resolvedAt: null } }),
      this.prisma.commentReport.count(),
      this.prisma.pledge.count({ where: { status: 'CAPTURE_GRACE' } }),
      this.prisma.pledge.count({ where: { status: 'FAILED_CAPTURE' } }),
      this.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      this.prisma.project.aggregate({ where: { status: 'LIVE' }, _sum: { raisedHalalas: true } }),
      this.prisma.project.count({ where: { status: 'LIVE' } }),
      this.prisma.user.count(),
      this.prisma.project.aggregate({ _sum: { realizedHalalas: true } }),
      this.prisma.payout.aggregate({ where: { status: 'PENDING' }, _sum: { amountHalalas: true, netHalalas: true } }),
      this.prisma.pledge.count({ where: { status: 'REFUNDED' } }),
    ]);

    return {
      workQueue: {
        projectsUnderReview,
        milestonesSubmitted,
        payoutsPending,
        payoutsFailed,
        reportsOpen: projectReportsOpen + commentReportsOpen,
        projectReportsOpen,
        commentReportsOpen,
        pledgesCaptureGrace,
        pledgesFailedCapture,
        ticketsOpen,
      },
      vitals: {
        liveRaisedHalalas: h(liveAgg._sum.raisedHalalas) ?? '0',
        liveCount,
        usersCount,
        gmvHalalas: h(gmvAgg._sum.realizedHalalas) ?? '0',
        // For PENDING payouts net is not yet computed (it is set at
        // disbursement), so the outstanding liability is the GROSS release.
        pendingPayoutLiabilityHalalas:
          h(pendingPayoutAgg._sum.netHalalas) ?? h(pendingPayoutAgg._sum.amountHalalas) ?? '0',
        refundCount,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /* ── 2. PROJECTS (projects.review) ─────────────────────────────────────── */

  async listProjects(f: ProjectListFilter): Promise<Page<ReturnType<OpsReadService['projectRow']>>> {
    const where: Prisma.ProjectWhereInput = {
      ...(f.status ? { status: f.status as ProjectStatus } : {}),
      ...(f.categoryId ? { categoryId: f.categoryId } : {}),
      ...(f.q ? { titleAr: { contains: f.q, mode: 'insensitive' } } : {}),
      ...(f.hidden === true ? { hiddenAt: { not: null } } : {}),
      ...(f.hidden === false ? { hiddenAt: null } : {}),
    };
    const { take, extra } = this.pageArgs(f);
    const rows = await this.prisma.project.findMany({
      where,
      ...extra,
      include: {
        createdBy: { select: { handle: true } },
        categoryRef: { select: { id: true, nameAr: true } },
      },
    });
    return this.slice(rows, take, (r) => this.projectRow(r));
  }

  private projectRow(
    r: Prisma.ProjectGetPayload<{
      include: { createdBy: { select: { handle: true } }; categoryRef: { select: { id: true; nameAr: true } } };
    }>,
  ) {
    return {
      id: r.id,
      titleAr: r.titleAr,
      status: r.status,
      categoryId: r.categoryId,
      categoryNameAr: r.categoryRef?.nameAr ?? null,
      goalHalalas: h(r.fundingGoalHalalas),
      raisedHalalas: h(r.raisedHalalas),
      realizedHalalas: h(r.realizedHalalas),
      backersCount: r.backersCount,
      createdBy: r.createdBy?.handle ?? null,
      createdById: r.createdById,
      hiddenAt: iso(r.hiddenAt),
      createdAt: iso(r.createdAt),
    };
  }

  async projectDetail(id: string) {
    const p = await this.prisma.project.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, handle: true, name: true } },
        categoryRef: { select: { id: true, nameAr: true } },
        milestones: { orderBy: { order: 'asc' } },
      },
    });
    if (!p) throw new NotFoundException('المشروع غير موجود');

    const [payoutAgg, recentPledges, reportCount] = await Promise.all([
      this.prisma.payout.groupBy({
        by: ['status'],
        where: { projectId: id },
        _sum: { amountHalalas: true, netHalalas: true },
        _count: { _all: true },
      }),
      this.prisma.pledge.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { backer: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.projectReport.count({ where: { projectId: id, resolvedAt: null } }),
    ]);

    return {
      id: p.id,
      titleAr: p.titleAr,
      shortDescAr: p.shortDescAr,
      status: p.status,
      categoryId: p.categoryId,
      categoryNameAr: p.categoryRef?.nameAr ?? null,
      region: p.region,
      goalHalalas: h(p.fundingGoalHalalas),
      raisedHalalas: h(p.raisedHalalas),
      realizedHalalas: h(p.realizedHalalas),
      backersCount: p.backersCount,
      releaseThresholdPct: p.releaseThresholdPct,
      deadline: iso(p.deadline),
      publishedAt: iso(p.publishedAt),
      reviewedAt: iso(p.reviewedAt),
      reviewFeedback: p.reviewFeedback,
      hiddenAt: iso(p.hiddenAt),
      hiddenReasonAr: p.hiddenReasonAr,
      isStaffPick: p.isStaffPick,
      createdAt: iso(p.createdAt),
      createdBy: {
        id: p.createdBy.id,
        handle: p.createdBy.handle,
        name: p.createdBy.name,
      },
      milestones: p.milestones.map((m) => ({
        id: m.id,
        order: m.order,
        titleAr: m.titleAr,
        releasePct: m.releasePct,
        status: m.status,
        releasedHalalas: h(m.releasedHalalas),
        submittedAt: iso(m.submittedAt),
        approvedAt: iso(m.approvedAt),
        releasedAt: iso(m.releasedAt),
      })),
      payoutSummary: payoutAgg.map((g) => ({
        status: g.status,
        count: g._count._all,
        grossHalalas: h(g._sum.amountHalalas) ?? '0',
        netHalalas: h(g._sum.netHalalas) ?? '0',
      })),
      recentPledges: recentPledges.map((pl) => ({
        id: pl.id,
        backer: {
          id: pl.backer.id,
          name: pl.backer.name,
          email: maskEmail(pl.backer.email),
        },
        amountHalalas: h(pl.amountHalalas),
        addOnsHalalas: h(pl.addOnsHalalas),
        status: pl.status,
        createdAt: iso(pl.createdAt),
      })),
      openReportCount: reportCount,
    };
  }

  /* ── 3. USERS (users.lifecycle) — masked directory ─────────────────────── */

  async listUsers(f: UserListFilter): Promise<Page<ReturnType<OpsReadService['userRow']>>> {
    const statusWhere: Prisma.UserWhereInput =
      f.status === 'active'
        ? { suspendedAt: null }
        : f.status === 'suspended'
          ? { suspendedKind: 'SUSPENDED' }
          : f.status === 'banned'
            ? { suspendedKind: 'BANNED' }
            : {};
    const where: Prisma.UserWhereInput = {
      ...statusWhere,
      ...(f.role ? { roles: { has: f.role as UserRole } } : {}),
      ...(f.q
        ? {
            OR: [
              { name: { contains: f.q, mode: 'insensitive' } },
              { email: { contains: f.q, mode: 'insensitive' } },
              { handle: { contains: f.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const { take, extra } = this.pageArgs(f);
    const rows = await this.prisma.user.findMany({ where, ...extra });
    return this.slice(rows, take, (r) => this.userRow(r));
  }

  private userRow(r: Prisma.UserGetPayload<Record<string, never>>) {
    return {
      id: r.id,
      name: r.name,
      email: maskEmail(r.email),
      handle: r.handle,
      roles: r.roles,
      suspendedAt: iso(r.suspendedAt),
      suspendedKind: r.suspendedKind,
      nafathVerified: r.nafathVerified,
      supplierVerifiedAt: iso(r.supplierVerifiedAt),
      totalPledgedHalalas: h(r.totalPledgedHalalas),
      createdAt: iso(r.createdAt),
    };
  }

  async userDetail(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('المستخدم غير موجود');
    const [sessionCount, pledgeCount, projectCount] = await Promise.all([
      this.prisma.refreshToken.count({ where: { userId: id, revokedAt: null } }),
      this.prisma.pledge.count({ where: { backerId: id } }),
      this.prisma.project.count({ where: { createdById: id } }),
    ]);
    return {
      id: u.id,
      name: u.name,
      // PII stays masked — raw values live behind the users.pii.unmask op.
      email: maskEmail(u.email),
      phone: maskPhone(u.phone),
      handle: u.handle,
      city: u.city,
      roles: u.roles,
      reputationTier: u.reputationTier,
      emailVerified: u.emailVerified,
      nafathVerified: u.nafathVerified,
      nafathVerifiedAt: iso(u.nafathVerifiedAt),
      supplierVerifiedAt: iso(u.supplierVerifiedAt),
      totalPledgedHalalas: h(u.totalPledgedHalalas),
      suspension: {
        suspendedAt: iso(u.suspendedAt),
        suspendedKind: u.suspendedKind,
        suspendedReasonAr: u.suspendedReasonAr,
      },
      activeSessionCount: sessionCount,
      pledgeCount,
      projectCount,
      createdAt: iso(u.createdAt),
    };
  }

  /* ── 4. MONEY — pledges + payouts (money.execute) ──────────────────────── */

  async listPledges(f: PledgeListFilter): Promise<Page<ReturnType<OpsReadService['pledgeRow']>>> {
    const where: Prisma.PledgeWhereInput = {
      ...(f.projectId ? { projectId: f.projectId } : {}),
      ...(f.backerId ? { backerId: f.backerId } : {}),
      ...(f.status ? { status: f.status as PledgeStatus } : {}),
    };
    const { take, extra } = this.pageArgs(f);
    const rows = await this.prisma.pledge.findMany({
      where,
      ...extra,
      include: { backer: { select: { id: true, name: true, email: true } } },
    });
    return this.slice(rows, take, (r) => this.pledgeRow(r));
  }

  private pledgeRow(
    r: Prisma.PledgeGetPayload<{ include: { backer: { select: { id: true; name: true; email: true } } } }>,
  ) {
    return {
      id: r.id,
      projectId: r.projectId,
      backer: { id: r.backer.id, name: r.backer.name, email: maskEmail(r.backer.email) },
      amountHalalas: h(r.amountHalalas),
      addOnsHalalas: h(r.addOnsHalalas),
      status: r.status,
      paymentMethod: r.paymentMethod,
      contractType: r.contractType,
      graceStartedAt: iso(r.graceStartedAt),
      graceExpiresAt: iso(r.graceExpiresAt),
      captureAttempts: r.captureAttempts,
      capturedAt: iso(r.capturedAt),
      refundedAt: iso(r.refundedAt),
      reauthorizedAt: iso(r.reauthorizedAt),
      disputeOutcome: r.disputeOutcome,
      createdAt: iso(r.createdAt),
    };
  }

  async listPayouts(f: PayoutListFilter): Promise<Page<ReturnType<OpsReadService['payoutRow']>>> {
    const where: Prisma.PayoutWhereInput = {
      ...(f.status ? { status: f.status as PayoutStatus } : {}),
    };
    const { take, extra } = this.pageArgs(f);
    const rows = await this.prisma.payout.findMany({
      where,
      ...extra,
      include: { creator: { select: { id: true, name: true, handle: true } } },
    });
    return this.slice(rows, take, (r) => this.payoutRow(r));
  }

  private payoutRow(
    r: Prisma.PayoutGetPayload<{ include: { creator: { select: { id: true; name: true; handle: true } } } }>,
  ) {
    return {
      id: r.id,
      projectId: r.projectId,
      milestoneId: r.milestoneId,
      creator: { id: r.creator.id, name: r.creator.name, handle: r.creator.handle },
      grossHalalas: h(r.amountHalalas),
      netHalalas: h(r.netHalalas),
      feeWithheldHalalas: h(r.feeWithheldHalalas),
      status: r.status,
      failureReason: r.failureReason,
      zatcaInvoiceId: r.zatcaInvoiceId,
      sentAt: iso(r.sentAt),
      createdAt: iso(r.createdAt),
    };
  }

  /* ── 5. MONEY — ledger + reconciliation (money.execute) ────────────────── */

  async listLedger(f: LedgerListFilter): Promise<Page<ReturnType<OpsReadService['ledgerRow']>>> {
    const where: Prisma.LedgerEntryWhereInput = {
      ...(f.entryType ? { entryType: f.entryType as LedgerEntryType } : {}),
      ...(f.projectId ? { projectId: f.projectId } : {}),
      ...(f.pledgeId ? { pledgeId: f.pledgeId } : {}),
      ...(f.from || f.to
        ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } }
        : {}),
    };
    const { take, extra } = this.pageArgs(f);
    const rows = await this.prisma.ledgerEntry.findMany({ where, ...extra });
    return this.slice(rows, take, (r) => this.ledgerRow(r));
  }

  private ledgerRow(r: Prisma.LedgerEntryGetPayload<Record<string, never>>) {
    return {
      id: r.id,
      entryType: r.entryType,
      amountHalalas: h(r.amountHalalas),
      pspRef: r.pspRef,
      pledgeId: r.pledgeId,
      payoutId: r.payoutId,
      projectId: r.projectId,
      source: r.source,
      createdAt: iso(r.createdAt),
    };
  }

  async listReconciliation(f: CursorFilter): Promise<Page<ReturnType<OpsReadService['reconciliationRow']>>> {
    const { take, extra } = this.pageArgs(f);
    const rows = await this.prisma.reconciliationRun.findMany({ where: {}, ...extra });
    return this.slice(rows, take, (r) => this.reconciliationRow(r));
  }

  private reconciliationRow(r: Prisma.ReconciliationRunGetPayload<Record<string, never>>) {
    const mismatches = Array.isArray(r.mismatches) ? r.mismatches : [];
    return {
      id: r.id,
      windowDays: r.windowDays,
      scanned: r.scanned,
      matched: r.matched,
      mismatched: r.mismatched,
      skipped: r.skipped,
      source: r.source,
      clean: r.mismatched === 0,
      mismatches,
      createdAt: iso(r.createdAt),
    };
  }

  /* ── 6. TICKETS (support.tickets) ──────────────────────────────────────── */

  async listTickets(f: TicketListFilter): Promise<Page<ReturnType<OpsReadService['ticketRow']>>> {
    const where: Prisma.SupportTicketWhereInput = {
      ...(f.status ? { status: f.status as SupportTicketStatus } : {}),
      ...(f.assignedToId ? { assignedToId: f.assignedToId } : {}),
      ...(f.q
        ? {
            OR: [
              { name: { contains: f.q, mode: 'insensitive' } },
              { email: { contains: f.q, mode: 'insensitive' } },
              { topic: { contains: f.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const { take, extra } = this.pageArgs(f);
    const rows = await this.prisma.supportTicket.findMany({ where, ...extra });
    return this.slice(rows, take, (r) => this.ticketRow(r));
  }

  private ticketRow(r: Prisma.SupportTicketGetPayload<Record<string, never>>) {
    return {
      id: r.id,
      userId: r.userId,
      name: r.name,
      email: maskEmail(r.email),
      topic: r.topic,
      status: r.status,
      assignedToId: r.assignedToId,
      resolvedAt: iso(r.resolvedAt),
      createdAt: iso(r.createdAt),
    };
  }

  async ticketDetail(id: string) {
    const t = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: { notes: { orderBy: { createdAt: 'asc' } } },
    });
    if (!t) throw new NotFoundException('التذكرة غير موجودة');
    return {
      id: t.id,
      userId: t.userId,
      name: t.name,
      email: maskEmail(t.email),
      topic: t.topic,
      messageAr: t.messageAr,
      status: t.status,
      assignedToId: t.assignedToId,
      resolvedAt: iso(t.resolvedAt),
      createdAt: iso(t.createdAt),
      updatedAt: iso(t.updatedAt),
      notes: t.notes.map((n) => ({
        id: n.id,
        authorId: n.authorId,
        noteAr: n.noteAr,
        createdAt: iso(n.createdAt),
      })),
    };
  }

  /* ── 7. PROCUREMENT — RFQs + bids (projects.review) ────────────────────── */

  async listRfqs(f: RfqListFilter): Promise<Page<ReturnType<OpsReadService['rfqRow']>>> {
    const where: Prisma.RFQWhereInput = {
      ...(f.status ? { status: f.status as RFQStatus } : {}),
      ...(f.projectId ? { projectId: f.projectId } : {}),
    };
    const { take, extra } = this.pageArgs(f);
    const rows = await this.prisma.rFQ.findMany({
      where,
      ...extra,
      include: {
        project: { select: { id: true, titleAr: true } },
        _count: { select: { bids: true } },
      },
    });
    return this.slice(rows, take, (r) => this.rfqRow(r));
  }

  private rfqRow(
    r: Prisma.RFQGetPayload<{
      include: { project: { select: { id: true; titleAr: true } }; _count: { select: { bids: true } } };
    }>,
  ) {
    return {
      id: r.id,
      projectId: r.projectId,
      projectTitleAr: r.project?.titleAr ?? null,
      status: r.status,
      dueDate: iso(r.dueDate),
      awardedBidId: r.awardedBidId,
      bidCount: r._count.bids,
      createdAt: iso(r.createdAt),
    };
  }

  async rfqDetail(id: string) {
    const r = await this.prisma.rFQ.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, titleAr: true } },
        bids: {
          orderBy: [{ status: 'asc' }, { amountHalalas: 'asc' }],
          include: { supplier: { select: { id: true, name: true, email: true, supplierVerifiedAt: true } } },
        },
      },
    });
    if (!r) throw new NotFoundException('طلب عرض الأسعار غير موجود');
    return {
      id: r.id,
      projectId: r.projectId,
      projectTitleAr: r.project?.titleAr ?? null,
      specsAr: r.specsAr,
      status: r.status,
      dueDate: iso(r.dueDate),
      awardedBidId: r.awardedBidId,
      createdAt: iso(r.createdAt),
      bids: r.bids.map((b) => ({
        id: b.id,
        supplier: {
          id: b.supplier.id,
          name: b.supplier.name,
          email: maskEmail(b.supplier.email),
          verified: b.supplier.supplierVerifiedAt !== null,
        },
        amountHalalas: h(b.amountHalalas),
        leadTimeDays: b.leadTimeDays,
        specComplianceNote: b.specComplianceNote,
        status: b.status,
        createdAt: iso(b.createdAt),
      })),
    };
  }

  /* ── 8. SETTINGS (settings.write OR analytics.read) ────────────────────── */

  async effectiveSettings() {
    const items = await this.settings.getAll();
    return { items };
  }
}
