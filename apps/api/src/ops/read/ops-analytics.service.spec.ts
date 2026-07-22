import { ForbiddenException } from '@nestjs/common';

import { OpsAnalyticsService } from './ops-analytics.service';
import { OpsAnalyticsController } from './ops-analytics.controller';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * OPS-360 Phase B · Unit 5 — the analytics aggregate surface. These prove, on
 * a fully mocked Prisma (groupBy/aggregate/count returns only):
 *   · each endpoint's computation (rates, sums, distributions, joins),
 *   · money is ALWAYS a halalas STRING (never BigInt / number),
 *   · the HONEST-NULL paths — top-of-funnel (no readable AnalyticsEvent),
 *     comment-report resolution (no schema column), and empty-denominator
 *     percentages,
 *   · the permission gate (analytics.read dashboards; money.execute financial).
 */

type Mock = jest.Mock;
interface MockModel {
  findMany: Mock;
  count: Mock;
  aggregate: Mock;
  groupBy: Mock;
}
function model(): MockModel {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: {}, _count: { _all: 0 } }),
    groupBy: jest.fn().mockResolvedValue([]),
  };
}

interface MockDb {
  ledgerEntry: MockModel;
  zatcaInvoice: MockModel;
  pledge: MockModel;
  payout: MockModel;
  user: MockModel;
  project: MockModel;
  category: MockModel;
  refreshToken: MockModel;
  projectReport: MockModel;
  commentReport: MockModel;
  supportTicket: MockModel;
}
function buildPrisma(): MockDb {
  return {
    ledgerEntry: model(),
    zatcaInvoice: model(),
    pledge: model(),
    payout: model(),
    user: model(),
    project: model(),
    category: model(),
    refreshToken: model(),
    projectReport: model(),
    commentReport: model(),
    supportTicket: model(),
  };
}

function svc(db: MockDb): OpsAnalyticsService {
  return new OpsAnalyticsService(db as unknown as PrismaService);
}

describe('OpsAnalyticsService', () => {
  /* ── permission gate ─────────────────────────────────────────────────── */

  describe('assertPermission', () => {
    it('throws the Arabic Forbidden when the permission is absent', () => {
      const s = svc(buildPrisma());
      expect(() => s.assertPermission({ permissions: ['support.tickets'] }, 'analytics.read')).toThrow(
        ForbiddenException,
      );
      try {
        s.assertPermission({ permissions: [] }, 'money.execute');
        fail('expected throw');
      } catch (e) {
        expect((e as ForbiddenException).message).toBe('تفتقد الصلاحية المطلوبة: money.execute');
      }
    });

    it('allows the exact permission and the OWNER wildcard', () => {
      const s = svc(buildPrisma());
      expect(() => s.assertPermission({ permissions: ['analytics.read'] }, 'analytics.read')).not.toThrow();
      expect(() => s.assertPermission({ permissions: ['*'] }, 'money.execute')).not.toThrow();
    });
  });

  /* ── controller-level gate: financial is money.execute, dashboards analytics.read ── */

  describe('controller permission gates', () => {
    const ctrl = () => new OpsAnalyticsController(svc(buildPrisma()));
    const req = (perms: string[]) => ({ opsPrincipal: { permissions: perms } }) as never;

    it('financial requires money.execute (analytics.read alone is refused)', () => {
      expect(() => ctrl().financial(req(['analytics.read']))).toThrow(ForbiddenException);
      expect(() => ctrl().financial(req(['money.execute']))).not.toThrow();
    });

    it('dashboards require analytics.read and refuse a principal without it', () => {
      const c = ctrl();
      expect(() => c.funnel(req(['support.tickets']))).toThrow(ForbiddenException);
      expect(() => c.projects(req(['support.tickets']))).toThrow(ForbiddenException);
      expect(() => c.users(req(['support.tickets']))).toThrow(ForbiddenException);
      expect(() => c.operations(req(['support.tickets']))).toThrow(ForbiddenException);
      // money.execute (FINANCE) also holds analytics.read in the matrix, but the
      // gate here is the literal permission — a pure analyst passes.
      expect(() => c.funnel(req(['analytics.read']))).not.toThrow();
    });
  });

  /* ── 1. financial ────────────────────────────────────────────────────── */

  describe('financial', () => {
    function seed(db: MockDb): void {
      db.ledgerEntry.groupBy.mockResolvedValue([
        { entryType: 'CAPTURE', _sum: { amountHalalas: 1_000_000n } },
        { entryType: 'COMMISSION', _sum: { amountHalalas: 50_000n } },
        { entryType: 'PAYOUT_SENT', _sum: { amountHalalas: 800_000n } },
      ]);
      db.zatcaInvoice.aggregate.mockResolvedValue({ _sum: { vatHalalas: 7_500n, commissionHalalas: 50_000n } });
      db.pledge.aggregate.mockImplementation((arg: { where: { status?: string } }) => {
        if (arg.where.status === 'REFUNDED') {
          return Promise.resolve({ _sum: { amountHalalas: 30_000n }, _count: { _all: 3 } });
        }
        return Promise.resolve({ _sum: { amountHalalas: 1_200_000n } });
      });
      db.payout.aggregate.mockResolvedValue({ _sum: { amountHalalas: 100_000n } });
    }

    it('computes GMV/commission/VAT/pledged/refunds/payouts and the net liability, all as strings', async () => {
      const db = buildPrisma();
      seed(db);
      const out = await svc(db).financial({});
      expect(out.gmvHalalas).toBe('1000000');
      expect(out.commissionEarnedHalalas).toBe('50000');
      expect(out.vatCollectedHalalas).toBe('7500');
      expect(out.grossPledgedHalalas).toBe('1200000');
      expect(out.refundTotalHalalas).toBe('30000');
      expect(out.refundCount).toBe(3);
      expect(out.payoutSentHalalas).toBe('800000');
      expect(out.pendingPayoutGrossHalalas).toBe('100000');
      // commissionBreakdown(100000): commission 5000, vat 750, withheld 5750 → net 94250.
      expect(out.pendingPayoutLiabilityNetHalalas).toBe('94250');
      expect(out.pendingLiabilityIsSnapshot).toBe(true);
      // every money field is a string.
      for (const k of [
        'gmvHalalas',
        'commissionEarnedHalalas',
        'vatCollectedHalalas',
        'grossPledgedHalalas',
        'refundTotalHalalas',
        'payoutSentHalalas',
        'pendingPayoutGrossHalalas',
        'pendingPayoutLiabilityNetHalalas',
      ] as const) {
        expect(typeof out[k]).toBe('string');
      }
    });

    it('echoes the resolved window (default 30 days) and honours ?from&to', async () => {
      const db = buildPrisma();
      seed(db);
      const def = await svc(db).financial({});
      expect(def.window.defaultDays).toBe(30);
      const from = new Date('2026-01-01T00:00:00Z');
      const to = new Date('2026-02-01T00:00:00Z');
      const out = await svc(db).financial({ from, to });
      expect(out.window.from).toBe(from.toISOString());
      expect(out.window.to).toBe(to.toISOString());
      // the window was threaded into the ledger query.
      const where = db.ledgerEntry.groupBy.mock.calls.at(-1)![0].where;
      expect(where.createdAt).toEqual({ gte: from, lte: to });
    });

    it('missing ledger types and empty aggregates fall back to "0", never null-crash', async () => {
      const db = buildPrisma(); // all defaults: empty groupBy, empty _sum
      db.payout.aggregate.mockResolvedValue({ _sum: {} });
      const out = await svc(db).financial({});
      expect(out.gmvHalalas).toBe('0');
      expect(out.commissionEarnedHalalas).toBe('0');
      expect(out.vatCollectedHalalas).toBe('0');
      expect(out.pendingPayoutLiabilityNetHalalas).toBe('0');
    });
  });

  /* ── 2. funnel — honest top-of-funnel null ───────────────────────────── */

  describe('funnel', () => {
    it('computes verification drop-offs + repeat pledgers, and returns null for the untracked top-of-funnel', async () => {
      const db = buildPrisma();
      db.user.count.mockImplementation((arg?: { where?: { emailVerified?: boolean; nafathVerified?: boolean } }) => {
        const where = arg?.where ?? {};
        if (where.nafathVerified === true) return Promise.resolve(30);
        if (where.emailVerified === true) return Promise.resolve(60);
        return Promise.resolve(100); // signups (cohort createdAt only)
      });
      db.pledge.groupBy.mockResolvedValue([
        { backerId: 'b1', _count: { _all: 3 } },
        { backerId: 'b2', _count: { _all: 1 } },
        { backerId: 'b3', _count: { _all: 2 } },
      ]);
      const out = await svc(db).funnel({});
      expect(out.stages.visits).toBeNull();
      expect(out.stages.signups).toBe(100);
      expect(out.stages.emailVerified).toBe(60);
      expect(out.stages.nafathVerified).toBe(30);
      expect(out.stages.pledgers).toBe(3);
      expect(out.stages.repeatPledgers).toBe(2); // b1(3) and b3(2) pledged >1
      expect(out.dropOff.visitToSignupPct).toBeNull();
      expect(out.dropOff.signupToEmailVerifiedPct).toBe(60); // 60/100
      expect(out.dropOff.emailVerifiedToNafathVerifiedPct).toBe(50); // 30/60
      expect(out.dropOff.pledgerToRepeatPct).toBeCloseTo(66.67, 1); // 2/3
      expect(out.notes.topOfFunnel).toContain('AnalyticsEvent');
    });

    it('returns null drop-offs on an empty cohort (no fabricated 0%)', async () => {
      const out = await svc(buildPrisma()).funnel({});
      expect(out.stages.signups).toBe(0);
      expect(out.dropOff.signupToEmailVerifiedPct).toBeNull();
      expect(out.dropOff.pledgerToRepeatPct).toBeNull();
    });
  });

  /* ── 3. projects ─────────────────────────────────────────────────────── */

  describe('projects', () => {
    it('computes success rate over concluded projects, per-category (name-joined), pledged-vs-realized', async () => {
      const db = buildPrisma();
      db.project.groupBy.mockImplementation((arg: { by: string[] }) => {
        if (arg.by[0] === 'status') {
          return Promise.resolve([
            { status: 'SUCCESSFUL', _count: { _all: 6 } },
            { status: 'FUNDED', _count: { _all: 2 } },
            { status: 'FAILED', _count: { _all: 2 } },
            { status: 'LIVE', _count: { _all: 5 } },
          ]);
        }
        return Promise.resolve([
          { categoryId: 'c1', _sum: { raisedHalalas: 500_000n }, _count: { _all: 4 } },
          { categoryId: 'c2', _sum: { raisedHalalas: 300_000n }, _count: { _all: 3 } },
          { categoryId: null, _sum: { raisedHalalas: 10_000n }, _count: { _all: 1 } },
        ]);
      });
      db.project.aggregate.mockResolvedValue({ _sum: { raisedHalalas: 800_000n, realizedHalalas: 600_000n } });
      db.category.findMany.mockResolvedValue([
        { id: 'c1', nameAr: 'تقنية' },
        { id: 'c2', nameAr: 'فنون' },
      ]);
      const out = await svc(db).projects({});
      // won = SUCCESSFUL(6)+FUNDED(2)=8; lost = FAILED(2)+REFUNDED(0)=2; concluded 10 → 80%.
      expect(out.successRatePct).toBe(80);
      expect(out.concludedCount).toBe(10);
      expect(out.totalProjects).toBe(15);
      expect(out.statusDistribution.LIVE).toBe(5);
      // per-category sorted by raised desc, names joined, money as strings.
      expect(out.perCategory[0]).toMatchObject({ categoryId: 'c1', categoryNameAr: 'تقنية', raisedHalalas: '500000' });
      expect(out.perCategory[2]).toMatchObject({ categoryId: null, categoryNameAr: null });
      expect(typeof out.perCategory[0]!.raisedHalalas).toBe('string');
      // pledged-vs-realized contrast.
      expect(out.pledgedVsRealized.pledgedHalalas).toBe('800000');
      expect(out.pledgedVsRealized.realizedHalalas).toBe('600000');
      expect(out.pledgedVsRealized.realizationRatePct).toBe(75); // 600k/800k
    });

    it('null success rate when nothing has concluded yet', async () => {
      const db = buildPrisma();
      db.project.groupBy.mockImplementation((arg: { by: string[] }) =>
        arg.by[0] === 'status'
          ? Promise.resolve([{ status: 'LIVE', _count: { _all: 4 } }])
          : Promise.resolve([]),
      );
      db.project.aggregate.mockResolvedValue({ _sum: {} });
      const out = await svc(db).projects({});
      expect(out.successRatePct).toBeNull();
      expect(out.pledgedVsRealized.realizationRatePct).toBeNull();
    });
  });

  /* ── 4. users ────────────────────────────────────────────────────────── */

  describe('users', () => {
    it('computes KYC conversion, distinct backers, tiers, sessions, suspended/banned', async () => {
      const db = buildPrisma();
      db.user.count.mockImplementation((arg?: { where?: Record<string, unknown> }) => {
        const where = arg?.where ?? {};
        if (where.nafathVerified === true) return Promise.resolve(40);
        if (where.suspendedKind === 'SUSPENDED') return Promise.resolve(3);
        if (where.suspendedKind === 'BANNED') return Promise.resolve(2);
        if (where.createdAt) return Promise.resolve(10); // new users in window
        return Promise.resolve(100); // total
      });
      db.user.groupBy.mockResolvedValue([
        { reputationTier: 'NEWCOMER', _count: { _all: 80 } },
        { reputationTier: 'ADVOCATE', _count: { _all: 20 } },
      ]);
      db.refreshToken.count.mockResolvedValue(15);
      db.pledge.groupBy.mockImplementation((arg: { where: { status?: string } }) =>
        arg.where.status === 'CAPTURED'
          ? Promise.resolve([{ backerId: 'b1' }, { backerId: 'b2' }, { backerId: 'b3' }])
          : Promise.resolve([{ backerId: 'b1' }, { backerId: 'b2' }]),
      );
      const out = await svc(db).users({});
      expect(out.totalUsers).toBe(100);
      expect(out.newUsersInWindow).toBe(10);
      expect(out.kyc).toMatchObject({ nafathVerified: 40, total: 100, conversionPct: 40, isSnapshot: true });
      expect(out.distinctBackers).toBe(3);
      expect(out.distinctBackersInWindow).toBe(2);
      expect(out.reputationTiers).toEqual({ NEWCOMER: 80, ADVOCATE: 20 });
      expect(out.activeSessionCount).toBe(15);
      expect(out.suspendedCount).toBe(3);
      expect(out.bannedCount).toBe(2);
    });
  });

  /* ── 5. operations ───────────────────────────────────────────────────── */

  describe('operations', () => {
    function seed(db: MockDb): void {
      db.ledgerEntry.count.mockResolvedValue(200); // successful captures
      db.pledge.count.mockImplementation((arg?: { where?: { status?: string } }) => {
        const where = arg?.where ?? {};
        if (where.status === 'FAILED_CAPTURE') return Promise.resolve(10);
        return Promise.resolve(500); // total pledges
      });
      db.pledge.groupBy.mockResolvedValue([
        { status: 'REFUNDED', _count: { _all: 25 } },
        { status: 'DISPUTED', _count: { _all: 5 } },
        { status: 'CAPTURED', _count: { _all: 470 } },
      ]);
      db.projectReport.count.mockImplementation((arg?: { where?: { resolvedAt?: unknown } }) =>
        arg?.where?.resolvedAt ? Promise.resolve(8) : Promise.resolve(10),
      );
      db.commentReport.count.mockResolvedValue(4);
      db.supportTicket.groupBy.mockResolvedValue([
        { status: 'OPEN', _count: { _all: 12 } },
        { status: 'RESOLVED', _count: { _all: 30 } },
      ]);
      db.payout.groupBy.mockResolvedValue([
        { status: 'SENT', _count: { _all: 45 } },
        { status: 'FAILED', _count: { _all: 5 } },
      ]);
    }

    it('computes capture-failure TRUE rate, refund/dispute rates, moderation, tickets, payout success', async () => {
      const db = buildPrisma();
      seed(db);
      const out = await svc(db).operations({});
      // 10 / (200 + 10) = 4.76%
      expect(out.captureFailure).toMatchObject({ successfulCaptureCount: 200, failedCaptureCount: 10 });
      expect(out.captureFailure.trueRatePct).toBeCloseTo(4.76, 1);
      expect(out.refundRate).toMatchObject({ refundedCount: 25, totalPledges: 500, ratePct: 5 });
      expect(out.disputeRate).toMatchObject({ disputedCount: 5, totalPledges: 500, ratePct: 1 });
      expect(out.moderation.projectReportsOpened).toBe(10);
      expect(out.moderation.projectReportsResolved).toBe(8);
      expect(out.moderation.projectThroughputPct).toBe(80);
      expect(out.moderation.commentReportsOpened).toBe(4);
      // HONEST NULL — CommentReport has no resolvedAt column.
      expect(out.moderation.commentReportsResolved).toBeNull();
      expect(out.moderation.note).toContain('resolvedAt');
      expect(out.supportTicketsByStatus).toEqual({ OPEN: 12, RESOLVED: 30 });
      expect(out.payoutSuccess).toMatchObject({ sentCount: 45, failedCount: 5, successRatePct: 90 });
    });

    it('null rates on an empty platform (no fabricated 0%)', async () => {
      const out = await svc(buildPrisma()).operations({});
      expect(out.captureFailure.trueRatePct).toBeNull();
      expect(out.refundRate.ratePct).toBeNull();
      expect(out.disputeRate.ratePct).toBeNull();
      expect(out.moderation.projectThroughputPct).toBeNull();
      expect(out.payoutSuccess.successRatePct).toBeNull();
    });
  });
});
