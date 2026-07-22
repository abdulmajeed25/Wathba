import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  type LedgerEntryType,
  type MilestoneStatus,
  type PayoutStatus,
  type PledgeStatus,
  type ProjectStatus,
  type RFQStatus,
  type SupportTicketStatus,
  type UserRole,
} from '@prisma/client';

import { commissionBreakdown } from '../../config/fees';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';
import { OpsAuditService } from '../ops-audit.service';
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

/** Trim long free-text to a screen-ready snippet (never leaks full body). */
function snippet(s: string | null | undefined, n = 140): string | null {
  if (!s) return null;
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

/**
 * IBAN is PDPL-relevant financial PII — masked by default like email/phone.
 * Shows the bank prefix + last two so an operator can eyeball-match without
 * the full account being disclosed (unmask is a separate audited op).
 */
function maskIban(iban: string | null | undefined): string | null {
  if (!iban) return null;
  const c = iban.replace(/\s/g, '');
  if (c.length <= 6) return '****';
  return `${c.slice(0, 4)}****${c.slice(-2)}`;
}

/**
 * Reporter/opaque-id masking for the moderation queue: a report's reporter is
 * kept pseudonymous (reporter anonymity) — we surface only a short prefix so
 * duplicate reporters are still visually groupable, never the full identity.
 */
function maskId(id: string | null | undefined): string | null {
  if (!id) return null;
  return `${id.slice(0, 8)}…`;
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
  /** true → only projects carrying at least one OPEN report. */
  reported?: boolean;
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

/* ── Unit-1 read-layer expansion filters ───────────────────────────────── */

export interface CommentListFilter extends CursorFilter {
  projectId?: string;
  hidden?: boolean;
  reported?: boolean;
}
export interface BeneficiaryListFilter extends CursorFilter {
  verified?: boolean;
}
export interface ZatcaListFilter extends CursorFilter {
  /** true → only reported; false → only orphans (reportedAt null). */
  reported?: boolean;
  creatorId?: string;
}
export interface WebhookListFilter extends CursorFilter {
  outcome?: string;
  provider?: string;
}
export interface MilestoneQueueFilter extends CursorFilter {
  status?: string;
  projectId?: string;
}
export interface KycQueueFilter extends CursorFilter {
  /** true → SUPPLIER-role accounts still awaiting suppliers.verify. */
  supplierUnverified?: boolean;
}

/** A live anomaly-center alert — one firing condition, screen-ready. */
export interface OpsAlert {
  key: string;
  severity: 'critical' | 'warn' | 'info';
  titleAr: string;
  count: number;
  detailAr: string;
  href: string;
}

/** actor-kind classification for name resolution (no PII, just a role hint). */
function actorKind(roles: readonly string[]): string {
  if (roles.includes('ADMIN')) return 'operator';
  if (roles.includes('SUPPLIER')) return 'supplier';
  if (roles.includes('CREATOR')) return 'creator';
  return 'user';
}

@Injectable()
export class OpsReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    // OPS-360 Unit-2 — the alerts center reuses the audit chain verifier
    // (READ-ONLY) so the anomaly board and the audit browser can never
    // disagree on whether the log is intact.
    private readonly audit: OpsAuditService,
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

  /**
   * Same keyset pattern as pageArgs but for models whose chronological column
   * is not `createdAt` (Comment/ProjectUpdate use `date`, ZatcaInvoice uses
   * `issuedAt`, Milestone uses `submittedAt`). Cursor stays the row id.
   */
  private pageArgsOn(f: CursorFilter, dateField: string): { take: number; extra: Record<string, unknown> } {
    const take = clampLimit(f.limit);
    return {
      take,
      extra: {
        take: take + 1,
        orderBy: [{ [dateField]: 'desc' }, { id: 'desc' }],
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

    // See the vitals comment below: gross is what the aggregate sums; the
    // truthful liability is the net after the disburser's commission+VAT
    // withholding, computed via the shared commissionBreakdown().
    const pendingPayoutGross = pendingPayoutAgg._sum.amountHalalas ?? 0n;
    const estimatedNetPayoutLiability = commissionBreakdown(pendingPayoutGross).netHalalas;

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
        // BUG FIX (census A4) — PENDING payouts have net=null, so the old
        // `net ?? amount` fell through to the GROSS release and OVERSTATED the
        // liability by the withheld commission+VAT. The money that actually
        // leaves the platform is the NET; we derive the expected net with the
        // SAME commissionBreakdown() the disburser uses (config/fees.ts), so
        // the tile and the disbursement can never disagree on the basis.
        // Applied to the aggregate gross sum → an ESTIMATE (per-row rounding
        // differs by ≤a few halalas across many rows); both legs are exposed
        // so the screen can show gross AND the truthful net side-by-side.
        grossPendingPayoutHalalas: h(pendingPayoutGross) ?? '0',
        estimatedNetPayoutLiabilityHalalas: h(estimatedNetPayoutLiability) ?? '0',
        // Kept for back-compat, now the truthful NET estimate (no longer gross).
        pendingPayoutLiabilityHalalas: h(estimatedNetPayoutLiability) ?? '0',
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
      ...(f.reported === true ? { projectReports: { some: { resolvedAt: null } } } : {}),
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
    // openReportCount per row — one grouped count over the page's ids (never a
    // per-row query). Lets trust/projects lists sort/filter by report volume.
    const openReports = await this.openReportCounts(rows.map((r) => r.id));
    return this.slice(rows, take, (r) => this.projectRow(r, openReports.get(r.id) ?? 0));
  }

  /** Map projectId → count of OPEN (resolvedAt null) reports for a set of ids. */
  private async openReportCounts(projectIds: string[]): Promise<Map<string, number>> {
    if (projectIds.length === 0) return new Map();
    const grouped = await this.prisma.projectReport.groupBy({
      by: ['projectId'],
      where: { projectId: { in: projectIds }, resolvedAt: null },
      _count: { _all: true },
    });
    return new Map(grouped.map((g) => [g.projectId, g._count._all]));
  }

  private projectRow(
    r: Prisma.ProjectGetPayload<{
      include: { createdBy: { select: { handle: true } }; categoryRef: { select: { id: true; nameAr: true } } };
    }>,
    openReportCount = 0,
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
      openReportCount,
      createdAt: iso(r.createdAt),
    };
  }

  /** Cross-page count-by-status so screens stop counting the current page. */
  async projectStats(f: { categoryId?: string } = {}) {
    const where: Prisma.ProjectWhereInput = {
      ...(f.categoryId ? { categoryId: f.categoryId } : {}),
    };
    const grouped = await this.prisma.project.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    const statusCounts: Record<string, number> = {};
    let total = 0;
    for (const g of grouped) {
      statusCounts[g.status] = g._count._all;
      total += g._count._all;
    }
    return { statusCounts, total };
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
    const opsRoles = await this.opsRoleKeysFor(rows.map((r) => r.id));
    return this.slice(rows, take, (r) => this.userRow(r, opsRoles.get(r.id) ?? []));
  }

  /**
   * Read-only OpsRoleGrant→OpsRole join: map userId → their ops-role KEYS
   * (OWNER, FINANCE, …). Ops tables don't fan into the domain graph (no FK to
   * User by design), so this is a manual two-step read: grants for the ids,
   * then their roles. Powers the team screen's "current grants" column.
   */
  private async opsRoleKeysFor(userIds: string[]): Promise<Map<string, string[]>> {
    if (userIds.length === 0) return new Map();
    const grants = await this.prisma.opsRoleGrant.findMany({
      where: { userId: { in: userIds } },
      include: { role: { select: { key: true } } },
    });
    const map = new Map<string, string[]>();
    for (const g of grants) {
      const arr = map.get(g.userId) ?? [];
      arr.push(g.role.key);
      map.set(g.userId, arr);
    }
    return map;
  }

  private userRow(r: Prisma.UserGetPayload<Record<string, never>>, opsRoleKeys: string[] = []) {
    return {
      id: r.id,
      name: r.name,
      email: maskEmail(r.email),
      handle: r.handle,
      roles: r.roles,
      opsRoleKeys,
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
    const [sessionCount, pledgeCount, projectCount, opsRoles] = await Promise.all([
      this.prisma.refreshToken.count({ where: { userId: id, revokedAt: null } }),
      this.prisma.pledge.count({ where: { backerId: id } }),
      this.prisma.project.count({ where: { createdById: id } }),
      this.opsRoleKeysFor([id]),
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
      opsRoleKeys: opsRoles.get(id) ?? [],
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

  /* ── U1.A USERS — stats, KYC queue, sub-resources (users.lifecycle) ────── */

  /** Cross-page user status counts (active/suspended/banned) + verification. */
  async userStats() {
    const [total, suspended, banned, nafathVerified, supplierVerified] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { suspendedKind: 'SUSPENDED' } }),
      this.prisma.user.count({ where: { suspendedKind: 'BANNED' } }),
      this.prisma.user.count({ where: { nafathVerified: true } }),
      this.prisma.user.count({ where: { supplierVerifiedAt: { not: null } } }),
    ]);
    return {
      statusCounts: { active: total - suspended - banned, suspended, banned },
      nafathVerified,
      supplierVerified,
      total,
    };
  }

  /**
   * KYC / Nafath worklist — accounts not yet Nafath-verified. Newest-first to
   * match the read layer's keyset convention. `supplierUnverified` narrows to
   * SUPPLIER-role accounts still awaiting suppliers.verify (the other blind
   * onboarding queue).
   */
  async listKycQueue(f: KycQueueFilter): Promise<Page<ReturnType<OpsReadService['userRow']>>> {
    const where: Prisma.UserWhereInput = f.supplierUnverified
      ? { roles: { has: 'SUPPLIER' }, supplierVerifiedAt: null }
      : { nafathVerified: false };
    const { take, extra } = this.pageArgs(f);
    const rows = await this.prisma.user.findMany({ where, ...extra });
    const opsRoles = await this.opsRoleKeysFor(rows.map((r) => r.id));
    return this.slice(rows, take, (r) => this.userRow(r, opsRoles.get(r.id) ?? []));
  }

  /** A user's pledges — masked backer, string money (replaces a bare count). */
  async listUserPledges(userId: string, f: CursorFilter): Promise<Page<ReturnType<OpsReadService['pledgeRow']>>> {
    return this.listPledges({ ...f, backerId: userId });
  }

  /**
   * A user's sessions — a merged, newest-first view over RefreshToken (auth
   * sessions) + KnownDevice (recognised devices). Neither hash is ever exposed
   * (tokenHash withheld entirely; deviceHash truncated). Keyset on createdAt
   * since the two tables share no id space.
   */
  async listUserSessions(userId: string, f: CursorFilter): Promise<Page<{
    kind: 'token' | 'device';
    id: string;
    active: boolean;
    createdAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
    lastSeenAt: string | null;
    deviceHashMasked: string | null;
  }>> {
    const take = clampLimit(f.limit);
    const before = f.cursor ? new Date(f.cursor) : undefined;
    const dateWhere = before ? { createdAt: { lt: before } } : {};
    const now = new Date();
    const [tokens, devices] = await Promise.all([
      this.prisma.refreshToken.findMany({
        where: { userId, ...dateWhere },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
      }),
      this.prisma.knownDevice.findMany({
        where: { userId, ...dateWhere },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
      }),
    ]);
    const merged = [
      ...tokens.map((t) => ({
        kind: 'token' as const,
        id: t.id,
        active: t.revokedAt === null && t.expiresAt > now,
        createdAt: iso(t.createdAt),
        expiresAt: iso(t.expiresAt),
        revokedAt: iso(t.revokedAt),
        lastSeenAt: null,
        deviceHashMasked: null,
        _sort: t.createdAt.getTime(),
      })),
      ...devices.map((d) => ({
        kind: 'device' as const,
        id: d.id,
        active: true,
        createdAt: iso(d.createdAt),
        expiresAt: null,
        revokedAt: null,
        lastSeenAt: iso(d.lastSeenAt),
        deviceHashMasked: maskId(d.deviceHash),
        _sort: d.createdAt.getTime(),
      })),
    ].sort((a, b) => b._sort - a._sort);
    const hasMore = merged.length > take;
    const page = merged.slice(0, take).map(({ _sort, ...rest }) => rest);
    return { items: page, nextCursor: hasMore ? page[page.length - 1]!.createdAt : null };
  }

  /* ── U1.B MODERATION — unblind the queue (moderation.queue) ─────────────── */

  /**
   * The unified moderation worklist — open ProjectReport (resolvedAt null)
   * MERGED with CommentReport into one queue DTO. Both tables are read
   * newest-first and interleaved; the cursor is the createdAt of the last item
   * (keyset across two id spaces). Reporters stay pseudonymous (maskId).
   */
  async listModerationReports(f: CursorFilter): Promise<Page<{
    kind: 'project' | 'comment';
    id: string;
    subjectId: string;
    subjectTitleAr: string | null;
    subjectSnippet: string | null;
    reporterMasked: string | null;
    reasonAr: string | null;
    subjectHiddenAt: string | null;
    createdAt: string | null;
  }>> {
    const take = clampLimit(f.limit);
    const before = f.cursor ? new Date(f.cursor) : undefined;
    const dateWhere = before ? { createdAt: { lt: before } } : {};
    const [projectReports, commentReports] = await Promise.all([
      this.prisma.projectReport.findMany({
        where: { resolvedAt: null, ...dateWhere },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
        include: { project: { select: { titleAr: true, hiddenAt: true } } },
      }),
      this.prisma.commentReport.findMany({
        where: { ...dateWhere },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
        include: { comment: { select: { projectId: true, bodyAr: true, hidden: true } } },
      }),
    ]);
    const merged = [
      ...projectReports.map((r) => ({
        kind: 'project' as const,
        id: r.id,
        subjectId: r.projectId,
        subjectTitleAr: r.project?.titleAr ?? null,
        subjectSnippet: null,
        reporterMasked: maskId(r.reporterId),
        reasonAr: r.reasonAr,
        subjectHiddenAt: iso(r.project?.hiddenAt),
        createdAt: iso(r.createdAt),
        _sort: r.createdAt.getTime(),
      })),
      ...commentReports.map((r) => ({
        kind: 'comment' as const,
        id: r.id,
        subjectId: r.commentId,
        subjectTitleAr: null,
        subjectSnippet: snippet(r.comment?.bodyAr),
        reporterMasked: maskId(r.reporterId),
        reasonAr: r.reasonAr,
        // Comment has no hidden-timestamp column, only a `hidden` boolean; a
        // hidden subject is surfaced via the snippet being suppressed upstream.
        subjectHiddenAt: null,
        createdAt: iso(r.createdAt),
        _sort: r.createdAt.getTime(),
      })),
    ].sort((a, b) => b._sort - a._sort);
    const hasMore = merged.length > take;
    const page = merged.slice(0, take).map(({ _sort, ...rest }) => rest);
    return { items: page, nextCursor: hasMore ? page[page.length - 1]!.createdAt : null };
  }

  /**
   * Comments browser — the moderation surface that was blind (an operator had
   * to already possess the comment id). Filters projectId / hidden / reported
   * (reportCount > 0). Author email masked; body trimmed to a snippet.
   */
  async listComments(f: CommentListFilter): Promise<Page<ReturnType<OpsReadService['commentRow']>>> {
    const where: Prisma.CommentWhereInput = {
      ...(f.projectId ? { projectId: f.projectId } : {}),
      ...(f.hidden !== undefined ? { hidden: f.hidden } : {}),
      ...(f.reported === true ? { reportCount: { gt: 0 } } : {}),
    };
    const { take, extra } = this.pageArgsOn(f, 'date');
    const rows = await this.prisma.comment.findMany({
      where,
      ...extra,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return this.slice(rows, take, (r) => this.commentRow(r));
  }

  private commentRow(
    r: Prisma.CommentGetPayload<{ include: { user: { select: { id: true; name: true; email: true } } } }>,
  ) {
    return {
      id: r.id,
      projectId: r.projectId,
      author: { id: r.user.id, name: r.user.name, email: maskEmail(r.user.email) },
      bodyAr: snippet(r.bodyAr),
      hidden: r.hidden,
      pinned: r.pinned,
      likeCount: r.likeCount,
      reportCount: r.reportCount,
      parentId: r.parentId,
      createdAt: iso(r.date),
    };
  }

  /* ── U1.C PROJECT SUB-RESOURCES (projects.review) ──────────────────────── */

  async listProjectUpdates(projectId: string, f: CursorFilter) {
    const { take, extra } = this.pageArgsOn(f, 'date');
    const rows = await this.prisma.projectUpdate.findMany({ where: { projectId }, ...extra });
    return this.slice(rows, take, (r) => ({
      id: r.id,
      projectId: r.projectId,
      titleAr: r.titleAr,
      bodyAr: snippet(r.bodyAr),
      orderNum: r.orderNum,
      likeCount: r.likeCount,
      commentCount: r.commentCount,
      pinned: r.pinned,
      visibility: r.visibility,
      publishAt: iso(r.publishAt),
      notifiedAt: iso(r.notifiedAt),
      createdAt: iso(r.date),
    }));
  }

  /** Comments for one project — same masked/snippeted row as the browser. */
  async listProjectComments(projectId: string, f: CursorFilter): Promise<Page<ReturnType<OpsReadService['commentRow']>>> {
    return this.listComments({ ...f, projectId });
  }

  async listRewardTiers(projectId: string, f: CursorFilter) {
    const { take, extra } = this.pageArgs(f);
    const rows = await this.prisma.rewardTier.findMany({ where: { projectId }, ...extra });
    return this.slice(rows, take, (r) => ({
      id: r.id,
      projectId: r.projectId,
      titleAr: r.titleAr,
      amountHalalas: h(r.amountHalalas),
      descAr: snippet(r.descAr),
      includesPhysicalProduct: r.includesPhysicalProduct,
      requiresShipping: r.requiresShipping,
      estDeliveryDate: iso(r.estDeliveryDate),
      limitQty: r.limitQty,
      claimedQty: r.claimedQty,
      isActive: r.isActive,
      earlyBirdAmountHalalas: h(r.earlyBirdAmountHalalas),
      earlyBirdUntil: iso(r.earlyBirdUntil),
      sortOrder: r.sortOrder,
      createdAt: iso(r.createdAt),
    }));
  }

  async listAddOns(projectId: string, f: CursorFilter) {
    const { take, extra } = this.pageArgs(f);
    const rows = await this.prisma.addOn.findMany({ where: { projectId }, ...extra });
    return this.slice(rows, take, (r) => ({
      id: r.id,
      projectId: r.projectId,
      titleAr: r.titleAr,
      amountHalalas: h(r.amountHalalas),
      descAr: snippet(r.descAr),
      limitQty: r.limitQty,
      claimedQty: r.claimedQty,
      sortOrder: r.sortOrder,
      createdAt: iso(r.createdAt),
    }));
  }

  async listSpendLogs(projectId: string, f: CursorFilter) {
    const { take, extra } = this.pageArgs(f);
    const rows = await this.prisma.spendLog.findMany({ where: { projectId }, ...extra });
    return this.slice(rows, take, (r) => ({
      id: r.id,
      projectId: r.projectId,
      milestoneId: r.milestoneId,
      amountHalalas: h(r.amountHalalas),
      descAr: snippet(r.descAr),
      date: iso(r.date),
      proofUrl: r.proofUrl,
      createdAt: iso(r.createdAt),
    }));
  }

  async listCollaborators(projectId: string, f: CursorFilter) {
    const { take, extra } = this.pageArgs(f);
    const rows = await this.prisma.projectCollaborator.findMany({ where: { projectId }, ...extra });
    return this.slice(rows, take, (r) => ({
      id: r.id,
      projectId: r.projectId,
      userId: r.userId,
      role: r.role,
      createdAt: iso(r.createdAt),
    }));
  }

  async listFaqQuestions(projectId: string, f: CursorFilter) {
    const { take, extra } = this.pageArgs(f);
    const rows = await this.prisma.faqQuestion.findMany({
      where: { projectId },
      ...extra,
      include: { asker: { select: { id: true, name: true, email: true } } },
    });
    return this.slice(rows, take, (r) => ({
      id: r.id,
      projectId: r.projectId,
      bodyAr: snippet(r.bodyAr),
      status: r.status,
      answeredFaqItemId: r.answeredFaqItemId,
      asker: r.asker
        ? { id: r.asker.id, name: r.asker.name, email: maskEmail(r.asker.email) }
        : null,
      createdAt: iso(r.createdAt),
    }));
  }

  async listContests(projectId: string, f: CursorFilter) {
    const { take, extra } = this.pageArgs(f);
    const rows = await this.prisma.contest.findMany({ where: { projectId }, ...extra });
    return this.slice(rows, take, (r) => ({
      id: r.id,
      projectId: r.projectId,
      roundNum: r.roundNum,
      promptAr: snippet(r.promptAr),
      prizeRewardTierId: r.prizeRewardTierId,
      prizeAddOnId: r.prizeAddOnId,
      prizeCustomAr: r.prizeCustomAr,
      winnersCount: r.winnersCount,
      status: r.status,
      startsAt: iso(r.startsAt),
      endsAt: iso(r.endsAt),
      announcedAt: iso(r.announcedAt),
      createdAt: iso(r.createdAt),
    }));
  }

  /**
   * Full backer roster with fulfillment status — replaces the "last 20" cap in
   * projectDetail. Masked backer, string money, plus rewardStatus/backerNo for
   * the fulfillment column.
   */
  async listProjectBackers(projectId: string, f: CursorFilter) {
    const { take, extra } = this.pageArgs(f);
    const rows = await this.prisma.pledge.findMany({
      where: { projectId },
      ...extra,
      include: { backer: { select: { id: true, name: true, email: true } } },
    });
    return this.slice(rows, take, (r) => ({
      id: r.id,
      projectId: r.projectId,
      backerNo: r.backerNo,
      backer: { id: r.backer.id, name: r.backer.name, email: maskEmail(r.backer.email) },
      amountHalalas: h(r.amountHalalas),
      addOnsHalalas: h(r.addOnsHalalas),
      status: r.status,
      rewardStatus: r.rewardStatus,
      tierId: r.tierId,
      createdAt: iso(r.createdAt),
    }));
  }

  /* ── U1.D MONEY OBSERVABILITY (money.execute) ──────────────────────────── */

  /** Payout beneficiaries — bank record for disbursement. IBAN + mobile masked. */
  async listBeneficiaries(f: BeneficiaryListFilter) {
    const where: Prisma.PayoutBeneficiaryWhereInput = {
      ...(f.verified === true ? { verifiedAt: { not: null } } : {}),
      ...(f.verified === false ? { verifiedAt: null } : {}),
    };
    const { take, extra } = this.pageArgs(f);
    const rows = await this.prisma.payoutBeneficiary.findMany({
      where,
      ...extra,
      include: { user: { select: { id: true, name: true, handle: true } } },
    });
    return this.slice(rows, take, (r) => this.beneficiaryRow(r));
  }

  private beneficiaryRow(
    r: Prisma.PayoutBeneficiaryGetPayload<{
      include: { user: { select: { id: true; name: true; handle: true } } };
    }>,
  ) {
    return {
      id: r.id,
      userId: r.userId,
      creator: r.user ? { id: r.user.id, name: r.user.name, handle: r.user.handle } : null,
      type: r.type,
      ibanMasked: maskIban(r.iban),
      name: r.name,
      mobileMasked: maskPhone(r.mobile),
      country: r.country,
      city: r.city,
      // Never leak the account id itself; presence is what an operator needs.
      moyasarAccountRegistered: r.moyasarAccountId !== null,
      verifiedAt: iso(r.verifiedAt),
      createdAt: iso(r.createdAt),
    };
  }

  async beneficiaryDetail(userId: string) {
    const r = await this.prisma.payoutBeneficiary.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true, handle: true } } },
    });
    if (!r) throw new NotFoundException('لا يوجد مستفيد دفع لهذا المستخدم');
    return this.beneficiaryRow(r);
  }

  /** ZATCA invoice browser — includes reportedAt-null orphans (unreported). */
  async listZatcaInvoices(f: ZatcaListFilter) {
    const where: Prisma.ZatcaInvoiceWhereInput = {
      ...(f.creatorId ? { creatorId: f.creatorId } : {}),
      ...(f.reported === true ? { reportedAt: { not: null } } : {}),
      ...(f.reported === false ? { reportedAt: null } : {}),
    };
    const { take, extra } = this.pageArgsOn(f, 'issuedAt');
    const rows = await this.prisma.zatcaInvoice.findMany({ where, ...extra });
    return this.slice(rows, take, (r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      payoutId: r.payoutId,
      creatorId: r.creatorId,
      commissionHalalas: h(r.commissionHalalas),
      vatHalalas: h(r.vatHalalas),
      totalHalalas: h(r.totalHalalas),
      issuedAt: iso(r.issuedAt),
      reportedAt: iso(r.reportedAt),
      orphan: r.reportedAt === null,
    }));
  }

  /**
   * Webhook event browser — UNBLOCKS webhooks.replay, which today can't be
   * invoked because nothing lists event ids. Filter by outcome
   * (applied|ignored|duplicate|mismatch) / provider.
   */
  async listWebhookEvents(f: WebhookListFilter) {
    const where: Prisma.WebhookEventWhereInput = {
      ...(f.outcome ? { outcome: f.outcome } : {}),
      ...(f.provider ? { provider: f.provider } : {}),
    };
    const { take, extra } = this.pageArgs(f);
    const rows = await this.prisma.webhookEvent.findMany({ where, ...extra });
    return this.slice(rows, take, (r) => ({
      id: r.id,
      provider: r.provider,
      eventType: r.eventType,
      pspRef: r.pspRef,
      outcome: r.outcome,
      processed: r.processedAt !== null,
      processedAt: iso(r.processedAt),
      createdAt: iso(r.createdAt),
    }));
  }

  /** Dispute queue — pledges in DISPUTED (arrive via the chargeback webhook). */
  async listDisputes(f: CursorFilter): Promise<Page<ReturnType<OpsReadService['pledgeRow']>>> {
    return this.listPledges({ ...f, status: 'DISPUTED' });
  }

  /**
   * Cross-project submitted-milestones queue — unblocks the vault milestones
   * tab (previously reachable only via a 6-hop per-project path). Defaults to
   * SUBMITTED; ordered newest-submitted-first. Project title joined.
   */
  async listMilestoneQueue(f: MilestoneQueueFilter) {
    const where: Prisma.MilestoneWhereInput = {
      status: (f.status as MilestoneStatus | undefined) ?? 'SUBMITTED',
      ...(f.projectId ? { projectId: f.projectId } : {}),
    };
    const { take, extra } = this.pageArgsOn(f, 'submittedAt');
    const rows = await this.prisma.milestone.findMany({
      where,
      ...extra,
      include: { project: { select: { titleAr: true } } },
    });
    return this.slice(rows, take, (r) => ({
      id: r.id,
      projectId: r.projectId,
      projectTitleAr: r.project?.titleAr ?? null,
      order: r.order,
      titleAr: r.titleAr,
      releasePct: r.releasePct,
      status: r.status,
      releasedHalalas: h(r.releasedHalalas),
      evidenceUrl: r.evidenceUrl,
      submittedAt: iso(r.submittedAt),
      approvedAt: iso(r.approvedAt),
      releasedAt: iso(r.releasedAt),
    }));
  }

  /* ── U1.E TICKET STATS (support.tickets) ───────────────────────────────── */

  async ticketStats() {
    const grouped = await this.prisma.supportTicket.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const statusCounts: Record<string, number> = {};
    let total = 0;
    for (const g of grouped) {
      statusCounts[g.status] = g._count._all;
      total += g._count._all;
    }
    return { statusCounts, total };
  }

  /* ── U1.F SUPPLIER PROFILE (projects.review) ───────────────────────────── */

  /**
   * The missing supplier ENTITY profile — the SUPPLIER user + their bids across
   * every RFQ + verification status + won/lost tally. (Today /ops/suppliers/:id
   * is RFQ detail; this is the supplier record itself.) PII masked, money as
   * strings, bids capped to the most recent 50.
   */
  async supplierProfile(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException('المورّد غير موجود');
    const [bidCounts, bids] = await Promise.all([
      this.prisma.supplierBid.groupBy({
        by: ['status'],
        where: { supplierId: userId },
        _count: { _all: true },
      }),
      this.prisma.supplierBid.findMany({
        where: { supplierId: userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { rfq: { select: { id: true, projectId: true, status: true } } },
      }),
    ]);
    const counts: Record<string, number> = {};
    for (const g of bidCounts) counts[g.status] = g._count._all;
    return {
      id: u.id,
      name: u.name,
      // PII masked by default — raw values live behind users.pii.unmask.
      email: maskEmail(u.email),
      phone: maskPhone(u.phone),
      handle: u.handle,
      city: u.city,
      roles: u.roles,
      isSupplier: u.roles.includes('SUPPLIER'),
      verification: {
        verified: u.supplierVerifiedAt !== null,
        verifiedAt: iso(u.supplierVerifiedAt),
        verifiedById: u.supplierVerifiedById,
        note: u.supplierVerifyNote,
      },
      bidCounts: counts,
      wonCount: counts.AWARDED ?? 0,
      lostCount: counts.REJECTED ?? 0,
      bids: bids.map((b) => ({
        id: b.id,
        rfqId: b.rfqId,
        projectId: b.rfq?.projectId ?? null,
        rfqStatus: b.rfq?.status ?? null,
        amountHalalas: h(b.amountHalalas),
        leadTimeDays: b.leadTimeDays,
        status: b.status,
        createdAt: iso(b.createdAt),
      })),
      createdAt: iso(u.createdAt),
    };
  }

  /* ── OPS-360 U2.A ALERTS CENTER (analytics.read) ───────────────────────── */

  /**
   * The global anomaly center — a flat list of LIVE alerts (each condition
   * that is currently firing), sorted critical→warn→info. Every leg is a cheap
   * count/exists over an indexed predicate; the conditions mirror the census
   * A4 anomaly list and the exact detectors in the money code
   * (payout.disburser stuck-SENDING, webhook mismatch, ZATCA orphans, the
   * DISPUTED/PENDING_REAUTH/FAILED_CAPTURE cohorts, the moderation backlog),
   * plus the audit chain verdict. Only firing rows are returned — a quiet
   * platform yields an empty list.
   *
   * DELIBERATELY OMITTED (census A4 "heavier scans"): the journal-gap
   * anti-join (CAPTURED pledges missing a CAPTURE ledger row) and the
   * platform counter-drift recompute. Pledge has no relation to LedgerEntry
   * and no status-only index, so a cheap Prisma `none` filter is unavailable;
   * a raw NOT-EXISTS scan over every CAPTURED pledge is NOT count/exists-cheap
   * and would violate the "keep each query cheap" rule. These belong on the
   * reconciliation cron / a dedicated integrity job, not the live board.
   */
  async alerts(): Promise<{ items: OpsAlert[]; chainOk: boolean; generatedAt: string }> {
    const stuckBefore = new Date(Date.now() - 15 * 60_000);
    const [
      stuckSending,
      webhookMismatch,
      zatcaOrphanPayouts,
      fatooraBackfill,
      disputed,
      pendingReauth,
      failedCapture,
      projectReportsOpen,
      commentReportsOpen,
    ] = await Promise.all([
      this.prisma.payout.count({ where: { status: 'SENDING', claimedAt: { lt: stuckBefore } } }),
      this.prisma.webhookEvent.count({ where: { outcome: 'mismatch' } }),
      this.prisma.payout.count({ where: { status: 'SENT', zatcaInvoiceId: null } }),
      this.prisma.zatcaInvoice.count({ where: { reportedAt: null } }),
      this.prisma.pledge.count({ where: { status: 'DISPUTED' } }),
      this.prisma.pledge.count({ where: { status: 'PENDING_REAUTH' } }),
      this.prisma.pledge.count({ where: { status: 'FAILED_CAPTURE' } }),
      this.prisma.projectReport.count({ where: { resolvedAt: null } }),
      this.prisma.commentReport.count(),
    ]);

    // Chain verdict — a broken/failed verification is itself a critical alert.
    let chainOk = true;
    let chainBrokenAt: string | null = null;
    try {
      const v = await this.audit.verify();
      chainOk = v.ok;
      chainBrokenAt = v.brokenAtSeq;
    } catch {
      chainOk = false;
    }

    const reportsOpen = projectReportsOpen + commentReportsOpen;
    const raw: OpsAlert[] = [
      {
        key: 'payouts.stuck_sending',
        severity: 'critical',
        count: stuckSending,
        titleAr: 'مدفوعات عالقة في الإرسال',
        detailAr: 'دفعات بحالة SENDING منذ أكثر من ١٥ دقيقة — تحتاج تسوية يدوية (خطر ازدواج الدفع).',
        href: '/ops/money?tab=payouts&status=SENDING',
      },
      {
        key: 'webhooks.mismatch',
        severity: 'critical',
        count: webhookMismatch,
        titleAr: 'أحداث ويبهوك غير متطابقة',
        detailAr: 'أحداث ويبهوك بنتيجة mismatch لم تُعالَج — راجعها وأعد تشغيلها.',
        href: '/ops/money/webhook-events',
      },
      {
        key: 'payouts.zatca_orphan',
        severity: 'warn',
        count: zatcaOrphanPayouts,
        titleAr: 'مدفوعات دون فاتورة ZATCA',
        detailAr: 'مدفوعات بحالة SENT دون فاتورة ضريبية مرتبطة (zatcaInvoiceId فارغ).',
        href: '/ops/money?tab=payouts',
      },
      {
        key: 'zatca.fatoora_backfill',
        severity: 'warn',
        count: fatooraBackfill,
        titleAr: 'فواتير بانتظار الإبلاغ لفاتورة',
        detailAr: 'فواتير ZATCA لم تُبلَّغ لهيئة الزكاة والضريبة بعد (reportedAt فارغ).',
        href: '/ops/money/zatca-invoices',
      },
      {
        key: 'pledges.disputed',
        severity: 'warn',
        count: disputed,
        titleAr: 'تعهّدات متنازع عليها',
        detailAr: 'تعهّدات بحالة DISPUTED وصلت عبر اعتراض بنكي — تحتاج قراراً.',
        href: '/ops/money?tab=refunds',
      },
      {
        key: 'pledges.pending_reauth',
        severity: 'warn',
        count: pendingReauth,
        titleAr: 'تعهّدات بانتظار إعادة التفويض',
        detailAr: 'تعهّدات بحالة PENDING_REAUTH بانتظار إعادة تفويض البطاقة.',
        href: '/ops/money?tab=pledges&status=PENDING_REAUTH',
      },
      {
        key: 'pledges.failed_capture',
        severity: 'warn',
        count: failedCapture,
        titleAr: 'تعهّدات فشل تحصيلها',
        detailAr: 'تعهّدات بحالة FAILED_CAPTURE بعد انتهاء مهلة السماح.',
        href: '/ops/money?tab=pledges&status=FAILED_CAPTURE',
      },
      {
        key: 'moderation.reports_open',
        severity: 'info',
        count: reportsOpen,
        titleAr: 'بلاغات مفتوحة',
        detailAr: 'بلاغات مشاريع وتعليقات بانتظار المراجعة في قائمة الإشراف.',
        href: '/ops/moderation/reports',
      },
    ];

    const items = raw.filter((a) => a.count > 0);
    if (!chainOk) {
      items.push({
        key: 'audit.chain_broken',
        severity: 'critical',
        count: 1,
        titleAr: 'سلسلة التدقيق مكسورة',
        detailAr: chainBrokenAt
          ? `أول رابط مكسور عند التسلسل ${chainBrokenAt} — تلاعب محتمل بالسجل أو كتابة تجاوزت المُحفِّز. تحقّق فوراً.`
          : 'تعذّر التحقق من سلامة سلسلة التدقيق — عاملها كحادثة أمنية.',
        href: '/ops/audit',
      });
    }
    const rank: Record<OpsAlert['severity'], number> = { critical: 0, warn: 1, info: 2 };
    items.sort((a, b) => rank[a.severity] - rank[b.severity]);

    return { items, chainOk, generatedAt: new Date().toISOString() };
  }

  /* ── OPS-360 U2.B NAME RESOLUTION (audit.read OR analytics.read) ────────── */

  /**
   * Batch actor/assignee name resolution — turns raw User UUIDs (as they
   * appear in audit rows, ticket assignees, agent proposers) into
   * `{ id: { name, kind } }` so the screens render names, not UUIDs. Returns
   * ONLY name/handle + a role-kind hint — NEVER email/phone (that stays behind
   * users.pii.unmask). Batch is deduped and hard-capped at 100 ids; unknown
   * ids are simply absent from the map.
   */
  async resolveActors(ids: string[]): Promise<Record<string, { name: string | null; kind: string }>> {
    const unique = [...new Set(ids.map((s) => s.trim()).filter(Boolean))].slice(0, 100);
    if (unique.length === 0) return {};
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, handle: true, roles: true },
    });
    const out: Record<string, { name: string | null; kind: string }> = {};
    for (const u of users) {
      out[u.id] = { name: u.name ?? u.handle ?? null, kind: actorKind(u.roles) };
    }
    return out;
  }

  /* ── OPS-360 U2.C VIEW-AS SNAPSHOT (impersonation) ─────────────────────── */

  /**
   * The READ-ONLY "view-as" snapshot the impersonation flow inspects — the
   * product data a support operator needs to see AS the user, WITHOUT a real
   * session swap and WITHOUT any write capability. PII stays masked (an
   * operator inspecting a support case does not need the user's raw
   * email/phone); money is stringified; pledges/projects are capped. This is
   * the truthful minimal impersonation surface — full cookie-level session
   * impersonation is a documented follow-up.
   */
  async viewAsSnapshot(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException('المستخدم غير موجود');
    const [pledges, projects] = await Promise.all([
      this.prisma.pledge.findMany({
        where: { backerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 25,
        include: { project: { select: { id: true, titleAr: true } } },
      }),
      this.prisma.project.findMany({
        where: { createdById: userId },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    ]);
    return {
      readOnly: true as const,
      profile: {
        id: u.id,
        name: u.name,
        handle: u.handle,
        city: u.city,
        // Masked even here: view-as is for support triage, not PII disclosure.
        email: maskEmail(u.email),
        phone: maskPhone(u.phone),
        roles: u.roles,
        reputationTier: u.reputationTier,
        emailVerified: u.emailVerified,
        nafathVerified: u.nafathVerified,
        totalPledgedHalalas: h(u.totalPledgedHalalas),
        memberSince: iso(u.createdAt),
      },
      pledges: pledges.map((p) => ({
        id: p.id,
        projectId: p.projectId,
        projectTitleAr: p.project?.titleAr ?? null,
        amountHalalas: h(p.amountHalalas),
        addOnsHalalas: h(p.addOnsHalalas),
        status: p.status,
        rewardStatus: p.rewardStatus,
        createdAt: iso(p.createdAt),
      })),
      projects: projects.map((p) => ({
        id: p.id,
        titleAr: p.titleAr,
        status: p.status,
        goalHalalas: h(p.fundingGoalHalalas),
        raisedHalalas: h(p.raisedHalalas),
        backersCount: p.backersCount,
        createdAt: iso(p.createdAt),
      })),
    };
  }

  /* ── 8. SETTINGS (settings.write OR analytics.read) ────────────────────── */

  async effectiveSettings() {
    const items = await this.settings.getAll();
    return { items };
  }
}
