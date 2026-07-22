import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { OpsReadService, clampLimit } from './ops-read.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SettingsService } from '../../settings/settings.service';

/**
 * Batch OPS-PRO Phase 2 — the OPS READ surface. These assert the three
 * invariants every screen depends on:
 *   · PII is masked by default (no raw email/phone in any list output),
 *   · money is always a halalas STRING (never a BigInt / number),
 *   · pagination hands back a cursor when a page overflows the limit;
 * plus the standard Arabic 403 when a permission is missing.
 */

type Mock = jest.Mock;
interface MockModel {
  findUnique: Mock;
  findFirst: Mock;
  findMany: Mock;
  count: Mock;
  aggregate: Mock;
  groupBy: Mock;
}
function model(): MockModel {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: {} }),
    groupBy: jest.fn().mockResolvedValue([]),
  };
}

interface MockDb {
  project: MockModel;
  category: MockModel;
  user: MockModel;
  pledge: MockModel;
  payout: MockModel;
  milestone: MockModel;
  ledgerEntry: MockModel;
  reconciliationRun: MockModel;
  supportTicket: MockModel;
  projectReport: MockModel;
  commentReport: MockModel;
  refreshToken: MockModel;
  rFQ: MockModel;
  comment: MockModel;
  projectUpdate: MockModel;
  rewardTier: MockModel;
  addOn: MockModel;
  spendLog: MockModel;
  projectCollaborator: MockModel;
  faqQuestion: MockModel;
  contest: MockModel;
  supplierBid: MockModel;
  payoutBeneficiary: MockModel;
  webhookEvent: MockModel;
  zatcaInvoice: MockModel;
  opsRole: MockModel;
  opsRoleGrant: MockModel;
  knownDevice: MockModel;
  notification: MockModel;
  appeal: MockModel;
  auditLog: MockModel;
}
function buildPrisma(): MockDb {
  return {
    project: model(),
    category: model(),
    user: model(),
    pledge: model(),
    payout: model(),
    milestone: model(),
    ledgerEntry: model(),
    reconciliationRun: model(),
    supportTicket: model(),
    projectReport: model(),
    commentReport: model(),
    refreshToken: model(),
    rFQ: model(),
    comment: model(),
    projectUpdate: model(),
    rewardTier: model(),
    addOn: model(),
    spendLog: model(),
    projectCollaborator: model(),
    faqQuestion: model(),
    contest: model(),
    supplierBid: model(),
    payoutBeneficiary: model(),
    webhookEvent: model(),
    zatcaInvoice: model(),
    opsRole: model(),
    opsRoleGrant: model(),
    knownDevice: model(),
    notification: model(),
    appeal: model(),
    auditLog: model(),
  };
}

const settingsStub = {
  getAll: jest.fn().mockResolvedValue([
    { key: 'pledges.minHalalas', titleAr: 'x', descriptionAr: 'y', value: 1000, source: 'default' },
  ]),
  // OPS-GAPS R1 — the appeals SLA (hours); the queue overdue flag + the
  // appeals.overdue alert read this. Default 48 for the shared stub.
  get: jest.fn().mockResolvedValue(48),
} as unknown as SettingsService;

/** Audit verifier stub — the alerts center reuses OpsAuditService.verify(). */
function auditStub(verdict?: { ok: boolean; brokenAtSeq: string | null } | Error) {
  return {
    verify: jest.fn().mockImplementation(async () => {
      if (verdict instanceof Error) throw verdict;
      return verdict ?? { ok: true, checked: 0, brokenAtSeq: null, verifiedAt: '' };
    }),
  } as unknown as import('../ops-audit.service').OpsAuditService;
}

function svc(db: MockDb, audit = auditStub()): OpsReadService {
  return new OpsReadService(db as unknown as PrismaService, settingsStub, audit);
}

const RAW_EMAIL = 'aisha.almutairi@example.com';
const RAW_PHONE = '+966501234567';
const RAW_IBAN = 'SA0380000000608010167519';

/** Deep scan: fail if any raw PII string survives into a response. */
function assertNoRawPII(payload: unknown): void {
  const json = JSON.stringify(payload);
  expect(json).not.toContain(RAW_EMAIL);
  expect(json).not.toContain(RAW_PHONE);
  expect(json).not.toContain(RAW_IBAN);
}

describe('OpsReadService', () => {
  describe('clampLimit', () => {
    it('defaults to 50 and caps at 100', () => {
      expect(clampLimit(undefined)).toBe(50);
      expect(clampLimit(0)).toBe(50);
      expect(clampLimit(-5)).toBe(50);
      expect(clampLimit(25)).toBe(25);
      expect(clampLimit(500)).toBe(100);
    });
  });

  describe('assertPermission', () => {
    it('throws the Arabic Forbidden when the permission is absent', () => {
      const s = svc(buildPrisma());
      expect(() => s.assertPermission({ permissions: ['support.tickets'] }, 'money.execute')).toThrow(
        ForbiddenException,
      );
      try {
        s.assertPermission({ permissions: [] }, 'projects.review');
        fail('expected throw');
      } catch (e) {
        expect((e as ForbiddenException).message).toBe('تفتقد الصلاحية المطلوبة: projects.review');
      }
    });

    it('allows the exact permission and the OWNER wildcard', () => {
      const s = svc(buildPrisma());
      expect(() => s.assertPermission({ permissions: ['money.execute'] }, 'money.execute')).not.toThrow();
      expect(() => s.assertPermission({ permissions: ['*'] }, 'anything.at.all')).not.toThrow();
    });
  });

  describe('listUsers — masking + pagination', () => {
    it('masks email and stringifies money, never leaking raw PII', async () => {
      const db = buildPrisma();
      db.user.findMany.mockResolvedValue([
        {
          id: 'u1',
          name: 'Aisha',
          email: RAW_EMAIL,
          phone: RAW_PHONE,
          handle: 'aisha',
          roles: ['BACKER'],
          suspendedAt: null,
          suspendedKind: null,
          nafathVerified: true,
          supplierVerifiedAt: null,
          totalPledgedHalalas: 250000n,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]);
      const out = await svc(db).listUsers({});
      const row = out.items[0]!;
      expect(row.email).toBe('a***@e***.com');
      expect(row.email).not.toBe(RAW_EMAIL);
      expect(row.totalPledgedHalalas).toBe('250000');
      expect(typeof row.totalPledgedHalalas).toBe('string');
      assertNoRawPII(out);
      expect(out.nextCursor).toBeNull();
    });

    it('returns a cursor (last id) when the page overflows the limit', async () => {
      const db = buildPrisma();
      // limit 2 → service fetches 3; a 3rd row present means "hasMore".
      db.user.findMany.mockResolvedValue(
        [1, 2, 3].map((n) => ({
          id: `u${n}`,
          name: `n${n}`,
          email: `u${n}@example.com`,
          phone: null,
          handle: null,
          roles: ['BACKER'],
          suspendedAt: null,
          suspendedKind: null,
          nafathVerified: false,
          supplierVerifiedAt: null,
          totalPledgedHalalas: 0n,
          createdAt: new Date(),
        })),
      );
      const out = await svc(db).listUsers({ limit: 2 });
      expect(out.items).toHaveLength(2);
      expect(out.nextCursor).toBe('u2');
      // limit+1 was requested, cursor pagination is off for the first page.
      const args = db.user.findMany.mock.calls[0]![0];
      expect(args.take).toBe(3);
      expect(args.cursor).toBeUndefined();
    });

    it('threads an incoming cursor into a keyset skip', async () => {
      const db = buildPrisma();
      await svc(db).listUsers({ cursor: 'u2', limit: 10 });
      const args = db.user.findMany.mock.calls[0]![0];
      expect(args.cursor).toEqual({ id: 'u2' });
      expect(args.skip).toBe(1);
    });

    it('maps status=banned to the BANNED suspension kind', async () => {
      const db = buildPrisma();
      await svc(db).listUsers({ status: 'banned' });
      const args = db.user.findMany.mock.calls[0]![0];
      expect(args.where.suspendedKind).toBe('BANNED');
    });
  });

  describe('listPledges — masked backer + string money', () => {
    it('masks the backer email and stringifies amounts', async () => {
      const db = buildPrisma();
      db.pledge.findMany.mockResolvedValue([
        {
          id: 'p1',
          projectId: 'proj1',
          backer: { id: 'u1', name: 'Aisha', email: RAW_EMAIL },
          amountHalalas: 50000n,
          addOnsHalalas: 1500n,
          status: 'CAPTURED',
          paymentMethod: 'CARD',
          contractType: 'DONATION',
          graceStartedAt: null,
          graceExpiresAt: null,
          captureAttempts: 0,
          capturedAt: new Date(),
          refundedAt: null,
          reauthorizedAt: null,
          disputeOutcome: null,
          createdAt: new Date(),
        },
      ]);
      const out = await svc(db).listPledges({});
      const row = out.items[0]!;
      expect(row.backer.email).toBe('a***@e***.com');
      expect(row.amountHalalas).toBe('50000');
      expect(row.addOnsHalalas).toBe('1500');
      assertNoRawPII(out);
    });
  });

  describe('listPayouts — money always strings', () => {
    it('stringifies gross/net/withheld and keeps failureReason', async () => {
      const db = buildPrisma();
      db.payout.findMany.mockResolvedValue([
        {
          id: 'po1',
          projectId: 'proj1',
          milestoneId: 'm1',
          creator: { id: 'u1', name: 'Creator', handle: 'creator' },
          amountHalalas: 1000000n,
          netHalalas: 830000n,
          feeWithheldHalalas: 170000n,
          status: 'SENT',
          failureReason: null,
          zatcaInvoiceId: 'ZTC-1',
          sentAt: new Date(),
          createdAt: new Date(),
        },
      ]);
      const out = await svc(db).listPayouts({ status: 'SENT' });
      const row = out.items[0]!;
      expect(row.grossHalalas).toBe('1000000');
      expect(row.netHalalas).toBe('830000');
      expect(row.feeWithheldHalalas).toBe('170000');
      expect(db.payout.findMany.mock.calls[0]![0].where.status).toBe('SENT');
    });
  });

  describe('listLedger — money strings + date filter', () => {
    it('stringifies amount and threads from/to into a createdAt range', async () => {
      const db = buildPrisma();
      db.ledgerEntry.findMany.mockResolvedValue([
        {
          id: 'l1',
          entryType: 'CAPTURE',
          amountHalalas: 50000n,
          pspRef: 'psp_1',
          pledgeId: 'p1',
          payoutId: null,
          projectId: 'proj1',
          source: 'sync-path',
          createdAt: new Date(),
        },
      ]);
      const from = new Date('2026-01-01T00:00:00Z');
      const to = new Date('2026-02-01T00:00:00Z');
      const out = await svc(db).listLedger({ entryType: 'CAPTURE', from, to });
      expect(out.items[0]!.amountHalalas).toBe('50000');
      const where = db.ledgerEntry.findMany.mock.calls[0]![0].where;
      expect(where.entryType).toBe('CAPTURE');
      expect(where.createdAt).toEqual({ gte: from, lte: to });
    });
  });

  describe('listTickets — masked email', () => {
    it('masks the requester email in the inbox list', async () => {
      const db = buildPrisma();
      db.supportTicket.findMany.mockResolvedValue([
        {
          id: 't1',
          userId: null,
          name: 'Aisha',
          email: RAW_EMAIL,
          topic: 'refund',
          status: 'OPEN',
          assignedToId: null,
          resolvedAt: null,
          createdAt: new Date(),
        },
      ]);
      const out = await svc(db).listTickets({ status: 'OPEN' });
      expect(out.items[0]!.email).toBe('a***@e***.com');
      assertNoRawPII(out);
    });
  });

  describe('rfqDetail — masked supplier', () => {
    it('masks the supplier email on each bid', async () => {
      const db = buildPrisma();
      db.rFQ.findUnique.mockResolvedValue({
        id: 'r1',
        projectId: 'proj1',
        project: { id: 'proj1', titleAr: 'مشروع' },
        specsAr: 'specs',
        status: 'OPEN',
        dueDate: new Date(),
        awardedBidId: null,
        createdAt: new Date(),
        bids: [
          {
            id: 'b1',
            supplier: { id: 'u9', name: 'Supplier', email: RAW_EMAIL, supplierVerifiedAt: new Date() },
            amountHalalas: 900000n,
            leadTimeDays: 30,
            specComplianceNote: 'ok',
            status: 'SUBMITTED',
            createdAt: new Date(),
          },
        ],
      });
      const out = await svc(db).rfqDetail('r1');
      expect(out.bids[0]!.supplier.email).toBe('a***@e***.com');
      expect(out.bids[0]!.supplier.verified).toBe(true);
      expect(out.bids[0]!.amountHalalas).toBe('900000');
      assertNoRawPII(out);
    });

    it('throws NotFound for a missing RFQ', async () => {
      const db = buildPrisma();
      db.rFQ.findUnique.mockResolvedValue(null);
      await expect(svc(db).rfqDetail('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('dashboard — aggregate board, money as strings', () => {
    it('sums vitals as halalas strings and rolls up the work queue', async () => {
      const db = buildPrisma();
      db.project.count.mockResolvedValue(4);
      db.milestone.count.mockResolvedValue(2);
      db.payout.count.mockResolvedValue(3);
      db.projectReport.count.mockResolvedValue(1);
      db.commentReport.count.mockResolvedValue(2);
      db.pledge.count.mockResolvedValue(5);
      db.supportTicket.count.mockResolvedValue(6);
      db.user.count.mockResolvedValue(1234);
      db.project.aggregate
        .mockResolvedValueOnce({ _sum: { raisedHalalas: 9000000n } }) // LIVE raised
        .mockResolvedValueOnce({ _sum: { realizedHalalas: 7000000n } }); // GMV
      db.payout.aggregate.mockResolvedValue({ _sum: { amountHalalas: 500000n, netHalalas: null } });

      const out = await svc(db).dashboard();
      expect(out.vitals.liveRaisedHalalas).toBe('9000000');
      expect(out.vitals.gmvHalalas).toBe('7000000');
      // BUG FIX — PENDING payouts have net=null. The OLD tile fell back to the
      // GROSS (500000) and overstated the liability by the withheld commission
      // +VAT. It now derives the truthful NET via commissionBreakdown():
      //   commission = 500000·5% = 25000; VAT = 25000·15% = 3750;
      //   withheld = 28750 → net = 471250. Gross is exposed alongside.
      expect(out.vitals.grossPendingPayoutHalalas).toBe('500000');
      expect(out.vitals.estimatedNetPayoutLiabilityHalalas).toBe('471250');
      expect(out.vitals.pendingPayoutLiabilityHalalas).toBe('471250');
      expect(out.vitals.pendingPayoutLiabilityHalalas).not.toBe('500000'); // no longer gross
      expect(out.vitals.usersCount).toBe(1234);
      expect(out.workQueue.reportsOpen).toBe(3); // 1 project + 2 comment
      expect(typeof out.vitals.gmvHalalas).toBe('string');
      expect(typeof out.generatedAt).toBe('string');
    });
  });

  /* ── Unit-1 read-layer expansion ───────────────────────────────────────── */

  describe('listUsers — ops-role join in the DTO', () => {
    it('attaches each user\'s ops-role keys (OpsRoleGrant→OpsRole)', async () => {
      const db = buildPrisma();
      db.user.findMany.mockResolvedValue([
        {
          id: 'u1', name: 'Ops', email: 'ops@example.com', phone: null, handle: 'ops',
          roles: ['ADMIN'], suspendedAt: null, suspendedKind: null, nafathVerified: true,
          supplierVerifiedAt: null, totalPledgedHalalas: 0n, createdAt: new Date(),
        },
      ]);
      db.opsRoleGrant.findMany.mockResolvedValue([
        { userId: 'u1', role: { key: 'FINANCE' } },
        { userId: 'u1', role: { key: 'ANALYST' } },
      ]);
      const out = await svc(db).listUsers({});
      expect(out.items[0]!.opsRoleKeys).toEqual(['FINANCE', 'ANALYST']);
      // the join is scoped to the page's user ids
      expect(db.opsRoleGrant.findMany.mock.calls[0]![0].where).toEqual({ userId: { in: ['u1'] } });
    });
  });

  describe('moderation queue — merges both report types', () => {
    it('interleaves open ProjectReport + CommentReport, reporter pseudonymised', async () => {
      const db = buildPrisma();
      db.projectReport.findMany.mockResolvedValue([
        {
          id: 'pr1', projectId: 'proj1', reporterId: 'reporter-uuid-1111', reasonAr: 'مخالفة',
          createdAt: new Date('2026-03-02T00:00:00Z'),
          project: { titleAr: 'مشروع', hiddenAt: null },
        },
      ]);
      db.commentReport.findMany.mockResolvedValue([
        {
          id: 'cr1', commentId: 'c1', reporterId: 'reporter-uuid-2222', reasonAr: 'إساءة',
          createdAt: new Date('2026-03-01T00:00:00Z'),
          comment: { projectId: 'proj1', bodyAr: 'نص التعليق', hidden: false },
        },
      ]);
      const out = await svc(db).listModerationReports({});
      expect(out.items).toHaveLength(2);
      const kinds = out.items.map((i) => i.kind);
      expect(kinds).toContain('project');
      expect(kinds).toContain('comment');
      // newest-first interleave (project report is later)
      expect(out.items[0]!.kind).toBe('project');
      // only OPEN project reports are queued
      expect(db.projectReport.findMany.mock.calls[0]![0].where.resolvedAt).toBeNull();
      // reporter identity is masked, never the full uuid
      const proj = out.items.find((i) => i.kind === 'project')!;
      expect(proj.reporterMasked).toBe('reporter…');
      expect(JSON.stringify(out)).not.toContain('reporter-uuid-1111');
      expect(proj.subjectTitleAr).toBe('مشروع');
      const cmt = out.items.find((i) => i.kind === 'comment')!;
      expect(cmt.subjectSnippet).toBe('نص التعليق');
    });
  });

  describe('listComments — masked author + snippet', () => {
    it('masks the comment author email and orders by `date`', async () => {
      const db = buildPrisma();
      db.comment.findMany.mockResolvedValue([
        {
          id: 'c1', projectId: 'proj1',
          user: { id: 'u1', name: 'Aisha', email: RAW_EMAIL },
          bodyAr: 'تعليق', hidden: false, pinned: false, likeCount: 0, reportCount: 3,
          parentId: null, date: new Date(),
        },
      ]);
      const out = await svc(db).listComments({ reported: true });
      expect(out.items[0]!.author.email).toBe('a***@e***.com');
      expect(out.items[0]!.reportCount).toBe(3);
      assertNoRawPII(out);
      // `reported` → reportCount > 0 filter, keyset on `date`
      expect(db.comment.findMany.mock.calls[0]![0].where.reportCount).toEqual({ gt: 0 });
      expect(db.comment.findMany.mock.calls[0]![0].orderBy[0].date).toBe('desc');
    });
  });

  describe('listBeneficiaries — masked IBAN + mobile', () => {
    it('masks the IBAN and mobile, never leaking the raw bank record', async () => {
      const db = buildPrisma();
      db.payoutBeneficiary.findMany.mockResolvedValue([
        {
          id: 'b1', userId: 'u1', type: 'BANK_ACCOUNT', iban: RAW_IBAN, name: 'Creator',
          mobile: RAW_PHONE, country: 'SA', city: 'Riyadh', moyasarAccountId: 'acc_123',
          verifiedAt: new Date(), createdAt: new Date(),
          user: { id: 'u1', name: 'Creator', handle: 'creator' },
        },
      ]);
      const out = await svc(db).listBeneficiaries({});
      const row = out.items[0]!;
      expect(row.ibanMasked).toBe('SA03****19');
      expect(row.ibanMasked).not.toBe(RAW_IBAN);
      expect(row.mobileMasked).not.toBe(RAW_PHONE);
      // the account id itself is never exposed — only its presence
      expect(row.moyasarAccountRegistered).toBe(true);
      expect(JSON.stringify(out)).not.toContain('acc_123');
      assertNoRawPII(out);
    });
  });

  describe('listZatcaInvoices — money strings + orphan flag', () => {
    it('stringifies commission/vat/total and flags reportedAt-null orphans', async () => {
      const db = buildPrisma();
      db.zatcaInvoice.findMany.mockResolvedValue([
        {
          id: 'z1', invoiceNumber: 'ZTC-1', payoutId: 'po1', creatorId: 'u1',
          commissionHalalas: 25000n, vatHalalas: 3750n, totalHalalas: 28750n,
          issuedAt: new Date(), reportedAt: null,
        },
      ]);
      const out = await svc(db).listZatcaInvoices({ reported: false });
      const row = out.items[0]!;
      expect(row.commissionHalalas).toBe('25000');
      expect(row.vatHalalas).toBe('3750');
      expect(row.totalHalalas).toBe('28750');
      expect(row.orphan).toBe(true);
      // keyset on issuedAt; `reported:false` → orphan-only filter
      expect(db.zatcaInvoice.findMany.mock.calls[0]![0].orderBy[0].issuedAt).toBe('desc');
      expect(db.zatcaInvoice.findMany.mock.calls[0]![0].where.reportedAt).toBeNull();
    });
  });

  describe('listWebhookEvents — outcome filter (unblocks webhooks.replay)', () => {
    it('lists event ids and threads the outcome filter', async () => {
      const db = buildPrisma();
      db.webhookEvent.findMany.mockResolvedValue([
        {
          id: 'w1', provider: 'moyasar', eventType: 'payment_paid', pspRef: 'psp_1',
          outcome: 'mismatch', processedAt: new Date(), createdAt: new Date(),
        },
      ]);
      const out = await svc(db).listWebhookEvents({ outcome: 'mismatch' });
      expect(out.items[0]!.id).toBe('w1');
      expect(out.items[0]!.outcome).toBe('mismatch');
      expect(db.webhookEvent.findMany.mock.calls[0]![0].where.outcome).toBe('mismatch');
    });
  });

  describe('listMilestoneQueue — cross-project submitted queue', () => {
    it('defaults to SUBMITTED, joins project title, money as strings', async () => {
      const db = buildPrisma();
      db.milestone.findMany.mockResolvedValue([
        {
          id: 'm1', projectId: 'proj1', order: 1, titleAr: 'مرحلة', releasePct: 50,
          status: 'SUBMITTED', releasedHalalas: 0n, evidenceUrl: 'url',
          submittedAt: new Date(), approvedAt: null, releasedAt: null,
          project: { titleAr: 'مشروع' },
        },
      ]);
      const out = await svc(db).listMilestoneQueue({});
      expect(out.items[0]!.projectTitleAr).toBe('مشروع');
      expect(out.items[0]!.releasedHalalas).toBe('0');
      expect(typeof out.items[0]!.releasedHalalas).toBe('string');
      expect(db.milestone.findMany.mock.calls[0]![0].where.status).toBe('SUBMITTED');
      expect(db.milestone.findMany.mock.calls[0]![0].orderBy[0].submittedAt).toBe('desc');
    });
  });

  describe('listProjectBackers — full roster with rewardStatus', () => {
    it('masks the backer and exposes rewardStatus/backerNo (string money)', async () => {
      const db = buildPrisma();
      db.pledge.findMany.mockResolvedValue([
        {
          id: 'p1', projectId: 'proj1', backerNo: 7,
          backer: { id: 'u1', name: 'Aisha', email: RAW_EMAIL },
          amountHalalas: 50000n, addOnsHalalas: 0n, status: 'CAPTURED',
          rewardStatus: 'IN_PROGRESS', tierId: 't1', createdAt: new Date(),
        },
      ]);
      const out = await svc(db).listProjectBackers('proj1', {});
      expect(out.items[0]!.backer.email).toBe('a***@e***.com');
      expect(out.items[0]!.rewardStatus).toBe('IN_PROGRESS');
      expect(out.items[0]!.amountHalalas).toBe('50000');
      expect(db.pledge.findMany.mock.calls[0]![0].where.projectId).toBe('proj1');
      assertNoRawPII(out);
    });
  });

  describe('listUserSessions — merged RefreshToken + KnownDevice, no hashes', () => {
    it('merges both sources, withholds token/device hashes', async () => {
      const db = buildPrisma();
      db.refreshToken.findMany.mockResolvedValue([
        {
          id: 'rt1', userId: 'u1', tokenHash: 'SECRET_TOKEN_HASH',
          expiresAt: new Date(Date.now() + 86_400_000), revokedAt: null,
          createdAt: new Date('2026-03-02T00:00:00Z'),
        },
      ]);
      db.knownDevice.findMany.mockResolvedValue([
        {
          id: 'kd1', userId: 'u1', deviceHash: 'DEVICE_HASH_SECRET',
          lastSeenAt: new Date(), createdAt: new Date('2026-03-01T00:00:00Z'),
        },
      ]);
      const out = await svc(db).listUserSessions('u1', {});
      expect(out.items).toHaveLength(2);
      expect(out.items[0]!.kind).toBe('token'); // newer first
      expect(out.items[0]!.active).toBe(true);
      const json = JSON.stringify(out);
      expect(json).not.toContain('SECRET_TOKEN_HASH');
      expect(json).not.toContain('DEVICE_HASH_SECRET');
    });
  });

  describe('supplierProfile — masked user + bids + won/lost', () => {
    it('masks PII, tallies won/lost, stringifies bid money', async () => {
      const db = buildPrisma();
      db.user.findUnique.mockResolvedValue({
        id: 'u9', name: 'Supplier', email: RAW_EMAIL, phone: RAW_PHONE, handle: 'sup',
        city: 'Jeddah', roles: ['SUPPLIER'], supplierVerifiedAt: new Date(),
        supplierVerifiedById: 'ops1', supplierVerifyNote: 'ok', createdAt: new Date(),
      });
      db.supplierBid.groupBy.mockResolvedValue([
        { status: 'AWARDED', _count: { _all: 2 } },
        { status: 'REJECTED', _count: { _all: 1 } },
      ]);
      db.supplierBid.findMany.mockResolvedValue([
        {
          id: 'b1', rfqId: 'r1', amountHalalas: 900000n, leadTimeDays: 30, status: 'AWARDED',
          createdAt: new Date(), rfq: { id: 'r1', projectId: 'proj1', status: 'AWARDED' },
        },
      ]);
      const out = await svc(db).supplierProfile('u9');
      expect(out.email).toBe('a***@e***.com');
      expect(out.phone).not.toBe(RAW_PHONE);
      expect(out.isSupplier).toBe(true);
      expect(out.verification.verified).toBe(true);
      expect(out.wonCount).toBe(2);
      expect(out.lostCount).toBe(1);
      expect(out.bids[0]!.amountHalalas).toBe('900000');
      assertNoRawPII(out);
    });

    it('throws NotFound for a missing supplier', async () => {
      const db = buildPrisma();
      db.user.findUnique.mockResolvedValue(null);
      await expect(svc(db).supplierProfile('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('status aggregates — cross-page count-by-status', () => {
    it('projectStats rolls groupBy into a statusCounts object + total', async () => {
      const db = buildPrisma();
      db.project.groupBy.mockResolvedValue([
        { status: 'LIVE', _count: { _all: 3 } },
        { status: 'DRAFT', _count: { _all: 2 } },
      ]);
      const out = await svc(db).projectStats();
      expect(out.statusCounts).toEqual({ LIVE: 3, DRAFT: 2 });
      expect(out.total).toBe(5);
    });

    it('userStats derives active = total − suspended − banned', async () => {
      const db = buildPrisma();
      db.user.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(10) // suspended
        .mockResolvedValueOnce(5) // banned
        .mockResolvedValueOnce(60) // nafathVerified
        .mockResolvedValueOnce(20); // supplierVerified
      const out = await svc(db).userStats();
      expect(out.statusCounts).toEqual({ active: 85, suspended: 10, banned: 5 });
      expect(out.nafathVerified).toBe(60);
      expect(out.total).toBe(100);
    });

    it('ticketStats rolls groupBy into a statusCounts object', async () => {
      const db = buildPrisma();
      db.supportTicket.groupBy.mockResolvedValue([
        { status: 'OPEN', _count: { _all: 4 } },
        { status: 'RESOLVED', _count: { _all: 6 } },
      ]);
      const out = await svc(db).ticketStats();
      expect(out.statusCounts).toEqual({ OPEN: 4, RESOLVED: 6 });
      expect(out.total).toBe(10);
    });
  });

  describe('listProjects — openReportCount on the row', () => {
    it('attaches the open-report count from a grouped count', async () => {
      const db = buildPrisma();
      db.project.findMany.mockResolvedValue([
        {
          id: 'proj1', titleAr: 'مشروع', status: 'LIVE', categoryId: null, categoryRef: null,
          fundingGoalHalalas: 1000000n, raisedHalalas: 500000n, realizedHalalas: 0n,
          backersCount: 3, createdBy: { handle: 'creator' }, createdById: 'u1',
          hiddenAt: null, createdAt: new Date(),
        },
      ]);
      db.projectReport.groupBy.mockResolvedValue([{ projectId: 'proj1', _count: { _all: 4 } }]);
      const out = await svc(db).listProjects({});
      expect(out.items[0]!.openReportCount).toBe(4);
      expect(out.items[0]!.raisedHalalas).toBe('500000');
      // the grouped count is scoped to OPEN reports for the page's ids
      const gb = db.projectReport.groupBy.mock.calls[0]![0];
      expect(gb.where).toEqual({ projectId: { in: ['proj1'] }, resolvedAt: null });
    });
  });

  describe('effectiveSettings', () => {
    it('delegates to SettingsService.getAll()', async () => {
      const out = await svc(buildPrisma()).effectiveSettings();
      expect(out.items[0]!.key).toBe('pledges.minHalalas');
    });
  });

  describe('listAllCategories — includes hidden nodes + excluded flag (OPS-GAPS Y1)', () => {
    it('does NOT filter isActive, flags excluded nodes, and attaches a per-node projectCount', async () => {
      const db = buildPrisma();
      db.category.findMany.mockResolvedValue([
        { id: 'c1', slug: 'art', nameAr: 'الفنون', nameEn: 'Art', parentId: null, sortOrder: 0, isActive: true },
        { id: 'c2', slug: 'music', nameAr: 'موسيقى', nameEn: 'Music', parentId: null, sortOrder: 1, isActive: false },
        { id: 'c3', slug: 'painting', nameAr: 'الرسم', nameEn: 'Painting', parentId: 'c1', sortOrder: 0, isActive: false },
      ]);
      db.project.groupBy.mockResolvedValue([
        { categoryId: 'c1', _count: { _all: 5 } },
        { categoryId: 'c3', _count: { _all: 2 } },
      ]);

      const out = await svc(db).listAllCategories();

      // the read must NOT constrain isActive (hidden nodes surface too)
      const where = db.category.findMany.mock.calls[0]![0].where;
      expect(where).toBeUndefined();
      expect(out.items).toHaveLength(3);

      const music = out.items.find((i) => i.id === 'c2')!;
      expect(music.isActive).toBe(false);
      expect(music.excluded).toBe(true); // permanent cultural exclusion
      expect(music.projectCount).toBe(0);

      const art = out.items.find((i) => i.id === 'c1')!;
      expect(art.excluded).toBe(false);
      expect(art.projectCount).toBe(5);

      const painting = out.items.find((i) => i.id === 'c3')!;
      expect(painting.parentId).toBe('c1'); // flat list carries parentId
      expect(painting.isActive).toBe(false);
      expect(painting.projectCount).toBe(2);
    });
  });

  /* ── OPS-360 Unit-2 — alerts, name resolution, view-as snapshot ─────────── */

  describe('alerts — the global anomaly center', () => {
    it('emits only firing alerts, sorted critical→warn→info, chain intact', async () => {
      const db = buildPrisma();
      // payout.count is called twice (stuck-SENDING, then SENT-orphan).
      db.payout.count.mockResolvedValueOnce(2).mockResolvedValueOnce(3);
      db.webhookEvent.count.mockResolvedValue(1); // mismatch → critical
      db.zatcaInvoice.count.mockResolvedValue(0); // no backfill → suppressed
      // pledge.count: DISPUTED, PENDING_REAUTH, FAILED_CAPTURE
      db.pledge.count.mockResolvedValueOnce(4).mockResolvedValueOnce(0).mockResolvedValueOnce(5);
      db.projectReport.count.mockResolvedValue(1);
      db.commentReport.count.mockResolvedValue(2);

      const out = await svc(db).alerts();
      const keys = out.items.map((a) => a.key);
      // firing: stuck_sending(crit), webhooks.mismatch(crit), zatca_orphan(warn),
      // disputed(warn), failed_capture(warn), reports_open(info=3).
      expect(keys).toContain('payouts.stuck_sending');
      expect(keys).toContain('webhooks.mismatch');
      expect(keys).toContain('payouts.zatca_orphan');
      expect(keys).toContain('pledges.disputed');
      expect(keys).toContain('pledges.failed_capture');
      expect(keys).toContain('moderation.reports_open');
      // suppressed (count 0): fatoora backfill + pending_reauth
      expect(keys).not.toContain('zatca.fatoora_backfill');
      expect(keys).not.toContain('pledges.pending_reauth');
      // sorted critical first, info last
      expect(out.items[0]!.severity).toBe('critical');
      expect(out.items[out.items.length - 1]!.severity).toBe('info');
      expect(out.items.find((a) => a.key === 'moderation.reports_open')!.count).toBe(3);
      expect(out.chainOk).toBe(true);
      // stuck-SENDING predicate matches the disburser's 15-min staleness gate
      const stuckWhere = db.payout.count.mock.calls[0]![0].where;
      expect(stuckWhere.status).toBe('SENDING');
      expect(stuckWhere.claimedAt.lt).toBeInstanceOf(Date);
    });

    it('adds a critical audit.chain_broken alert when the chain fails to verify', async () => {
      const db = buildPrisma();
      const out = await svc(db, auditStub({ ok: false, brokenAtSeq: '42' })).alerts();
      const broken = out.items.find((a) => a.key === 'audit.chain_broken')!;
      expect(broken).toBeDefined();
      expect(broken.severity).toBe('critical');
      expect(broken.detailAr).toContain('42');
      expect(out.chainOk).toBe(false);
    });

    it('treats a verifier throw as a broken chain (critical), not a crash', async () => {
      const db = buildPrisma();
      const out = await svc(db, auditStub(new Error('db down'))).alerts();
      expect(out.chainOk).toBe(false);
      expect(out.items.some((a) => a.key === 'audit.chain_broken')).toBe(true);
    });
  });

  describe('resolveActors — batch name resolution, no PII', () => {
    it('maps ids → {name, kind}, dedupes, caps at 100, and never leaks email', async () => {
      const db = buildPrisma();
      db.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'Aisha', handle: 'aisha', roles: ['BACKER'] },
        { id: 'u2', name: null, handle: 'ops', roles: ['ADMIN'] },
        { id: 'u3', name: 'Supp', handle: 'supp', roles: ['SUPPLIER'] },
      ]);
      const out = await svc(db).resolveActors(['u1', 'u1', 'u2', 'u3']);
      expect(out.u1).toEqual({ name: 'Aisha', kind: 'user' });
      expect(out.u2).toEqual({ name: 'ops', kind: 'operator' }); // falls back to handle
      expect(out.u3!.kind).toBe('supplier');
      // deduped ids passed to the query
      expect(db.user.findMany.mock.calls[0]![0].where.id.in).toEqual(['u1', 'u2', 'u3']);
      // select never asks for email/phone
      const select = db.user.findMany.mock.calls[0]![0].select;
      expect(select.email).toBeUndefined();
      expect(select.phone).toBeUndefined();
    });

    it('returns an empty map for no ids without hitting the db', async () => {
      const db = buildPrisma();
      const out = await svc(db).resolveActors([]);
      expect(out).toEqual({});
      expect(db.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('viewAsSnapshot — read-only view-as, masked PII', () => {
    it('returns a masked profile + pledges + projects, flagged readOnly', async () => {
      const db = buildPrisma();
      db.user.findUnique.mockResolvedValue({
        id: 'u1', name: 'Aisha', handle: 'aisha', city: 'Riyadh', email: RAW_EMAIL,
        phone: RAW_PHONE, roles: ['BACKER', 'CREATOR'], reputationTier: 'BRONZE',
        emailVerified: true, nafathVerified: false, totalPledgedHalalas: 250000n,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      db.pledge.findMany.mockResolvedValue([
        {
          id: 'p1', projectId: 'proj1', amountHalalas: 50000n, addOnsHalalas: 0n,
          status: 'CAPTURED', rewardStatus: 'PENDING', createdAt: new Date(),
          project: { id: 'proj1', titleAr: 'مشروع' },
        },
      ]);
      db.project.findMany.mockResolvedValue([
        {
          id: 'proj2', titleAr: 'مشروعي', status: 'LIVE', fundingGoalHalalas: 1000000n,
          raisedHalalas: 300000n, backersCount: 5, createdAt: new Date(),
        },
      ]);
      const out = await svc(db).viewAsSnapshot('u1');
      expect(out.readOnly).toBe(true);
      expect(out.profile.email).toBe('a***@e***.com');
      expect(out.profile.totalPledgedHalalas).toBe('250000');
      expect(out.pledges[0]!.projectTitleAr).toBe('مشروع');
      expect(out.pledges[0]!.amountHalalas).toBe('50000');
      expect(out.projects[0]!.raisedHalalas).toBe('300000');
      assertNoRawPII(out);
    });

    it('throws NotFound for a missing user', async () => {
      const db = buildPrisma();
      db.user.findUnique.mockResolvedValue(null);
      await expect(svc(db).viewAsSnapshot('nope')).rejects.toThrow(NotFoundException);
    });
  });

  /* ── OPS-360 Unit-4 — notifications, contests, fulfillment ──────────────── */

  describe('listUserNotifications — allowlisted payload summary, no secrets', () => {
    it('projects only safe scalar fields, dropping deepLink / actor names / tokens', async () => {
      const db = buildPrisma();
      db.notification.findMany.mockResolvedValue([
        {
          id: 'n1',
          userId: 'u1',
          kind: 'UPDATE_POSTED',
          readAt: null,
          createdAt: new Date('2026-03-02T00:00:00Z'),
          payload: {
            projectId: 'proj1',
            projectTitleAr: 'مشروع',
            updateId: 'up1',
            updateTitleAr: 'تحديث',
            // must be dropped — a link is never echoed
            deepLink: '/projects/proj1/updates/up1?token=SECRET_LINK_TOKEN',
            // actor identity must be dropped
            byUserId: 'actor-uuid',
            byName: 'Actor Name',
            byHandle: 'actorhandle',
            // arbitrary future secret must be dropped (allowlist, not denylist)
            resetToken: 'SUPER_SECRET_TOKEN',
            amountHalalas: 50000,
          },
        },
      ]);
      const out = await svc(db).listUserNotifications('u1', {});
      const row = out.items[0]!;
      expect(row.kind).toBe('UPDATE_POSTED');
      expect(row.readAt).toBeNull();
      // safe fields survive
      expect(row.payloadSummary.projectId).toBe('proj1');
      expect(row.payloadSummary.updateTitleAr).toBe('تحديث');
      // money stringified
      expect(row.payloadSummary.amountHalalas).toBe('50000');
      // secrets / links / actor identity are gone
      expect(row.payloadSummary).not.toHaveProperty('deepLink');
      expect(row.payloadSummary).not.toHaveProperty('byName');
      expect(row.payloadSummary).not.toHaveProperty('byHandle');
      expect(row.payloadSummary).not.toHaveProperty('byUserId');
      expect(row.payloadSummary).not.toHaveProperty('resetToken');
      const json = JSON.stringify(out);
      expect(json).not.toContain('SECRET_LINK_TOKEN');
      expect(json).not.toContain('SUPER_SECRET_TOKEN');
      expect(json).not.toContain('Actor Name');
    });

    it('threads the kind filter and keysets on (createdAt, id)', async () => {
      const db = buildPrisma();
      await svc(db).listUserNotifications('u1', { kind: 'PLEDGE_RECEIVED' });
      const args = db.notification.findMany.mock.calls[0]![0];
      expect(args.where.userId).toBe('u1');
      expect(args.where.kind).toBe('PLEDGE_RECEIVED');
      expect(args.orderBy[0].createdAt).toBe('desc');
    });

    it('refuses nested objects/arrays in the payload', async () => {
      const db = buildPrisma();
      db.notification.findMany.mockResolvedValue([
        {
          id: 'n2', userId: 'u1', kind: 'PLEDGE_RECEIVED', readAt: new Date(),
          createdAt: new Date(),
          payload: { projectId: 'proj1', method: { nested: 'obj' }, reason: ['a', 'b'] },
        },
      ]);
      const out = await svc(db).listUserNotifications('u1', {});
      expect(out.items[0]!.payloadSummary.projectId).toBe('proj1');
      expect(out.items[0]!.payloadSummary).not.toHaveProperty('method');
      expect(out.items[0]!.payloadSummary).not.toHaveProperty('reason');
    });
  });

  describe('notificationStats — count-by-kind over a recent window', () => {
    it('rolls groupBy into kindCounts + total over a 30-day window', async () => {
      const db = buildPrisma();
      db.notification.groupBy.mockResolvedValue([
        { kind: 'PLEDGE_RECEIVED', _count: { _all: 12 } },
        { kind: 'UPDATE_POSTED', _count: { _all: 8 } },
      ]);
      const out = await svc(db).notificationStats();
      expect(out.windowDays).toBe(30);
      expect(out.kindCounts).toEqual({ PLEDGE_RECEIVED: 12, UPDATE_POSTED: 8 });
      expect(out.total).toBe(20);
      // the aggregate is windowed on createdAt >= since
      const where = db.notification.groupBy.mock.calls[0]![0].where;
      expect(where.createdAt.gte).toBeInstanceOf(Date);
    });
  });

  describe('listAllContests — cross-project FSM oversight', () => {
    it('joins project title, exposes winner tally + FSM status, filters by status', async () => {
      const db = buildPrisma();
      db.contest.findMany.mockResolvedValue([
        {
          id: 'ct1', projectId: 'proj1', roundNum: 2, status: 'ANNOUNCED',
          prizeCustomAr: 'جائزة خاصة', prizeRewardTierId: null, prizeAddOnId: null,
          winnersCount: 3, startsAt: new Date(), endsAt: new Date(), announcedAt: new Date(),
          createdAt: new Date(),
          project: { id: 'proj1', titleAr: 'مشروع' },
          _count: { winners: 3 },
        },
      ]);
      const out = await svc(db).listAllContests({ status: 'ANNOUNCED' });
      const row = out.items[0]!;
      expect(row.projectTitleAr).toBe('مشروع');
      expect(row.status).toBe('ANNOUNCED');
      expect(row.prizeDescAr).toBe('جائزة خاصة');
      expect(row.targetWinnersCount).toBe(3);
      expect(row.winnerCount).toBe(3);
      expect(db.contest.findMany.mock.calls[0]![0].where.status).toBe('ANNOUNCED');
    });
  });

  describe('contestDetail — winners roster with masked backer', () => {
    it('masks each winner backer email and reflects the announced state', async () => {
      const db = buildPrisma();
      db.contest.findUnique.mockResolvedValue({
        id: 'ct1', projectId: 'proj1', roundNum: 1, promptAr: 'اكتب شعاراً',
        status: 'ANNOUNCED', prizeCustomAr: null, prizeRewardTierId: 't1', prizeAddOnId: null,
        winnersCount: 2, startsAt: new Date(), endsAt: new Date(), announcedAt: new Date(),
        createdAt: new Date(),
        project: { id: 'proj1', titleAr: 'مشروع' },
        winners: [
          {
            id: 'w1', backerNo: 7, createdAt: new Date(),
            backer: { id: 'u1', name: 'Aisha', email: RAW_EMAIL },
          },
        ],
      });
      const out = await svc(db).contestDetail('ct1');
      expect(out.announced).toBe(true);
      expect(out.winnerCount).toBe(1);
      expect(out.winners[0]!.backer.email).toBe('a***@e***.com');
      expect(out.winners[0]!.backerNo).toBe(7);
      assertNoRawPII(out);
    });

    it('throws NotFound for a missing contest', async () => {
      const db = buildPrisma();
      db.contest.findUnique.mockResolvedValue(null);
      await expect(svc(db).contestDetail('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listFulfillment — cross-project reward roster, rewardStatus filter', () => {
    it('filters to tier-bearing pledges by rewardStatus, masks backer, joins titles', async () => {
      const db = buildPrisma();
      db.pledge.findMany.mockResolvedValue([
        {
          id: 'p1', projectId: 'proj1', backerNo: 4, tierId: 't1',
          rewardStatus: 'IN_PROGRESS', createdAt: new Date(),
          backer: { id: 'u1', name: 'Aisha', email: RAW_EMAIL },
          project: { id: 'proj1', titleAr: 'مشروع' },
          tier: { id: 't1', titleAr: 'المكافأة' },
        },
      ]);
      const out = await svc(db).listFulfillment({ rewardStatus: 'IN_PROGRESS' });
      const row = out.items[0]!;
      expect(row.pledgeId).toBe('p1');
      expect(row.projectTitleAr).toBe('مشروع');
      expect(row.tierTitleAr).toBe('المكافأة');
      expect(row.rewardStatus).toBe('IN_PROGRESS');
      expect(row.backer.email).toBe('a***@e***.com');
      expect(row.backerNo).toBe(4);
      // only pledges carrying a reward tier, filtered by rewardStatus
      const where = db.pledge.findMany.mock.calls[0]![0].where;
      expect(where.tierId).toEqual({ not: null });
      expect(where.rewardStatus).toBe('IN_PROGRESS');
      assertNoRawPII(out);
    });
  });

  /* ── OPS-GAPS R1 — appeals read surface + SLA + alert ───────────────────── */

  describe('listAppeals — masked submitter, ageHours/overdue, open-first ordering', () => {
    it('masks submitter email, computes ageHours + overdue, orders open-first oldest-first', async () => {
      const db = buildPrisma();
      const now = Date.now();
      const hoursAgo = (n: number) => new Date(now - n * 3_600_000);
      db.appeal.findMany.mockResolvedValue([
        {
          id: 'a1', kind: 'ACCOUNT_BAN', subjectId: 'u9', submittedById: 'u1',
          status: 'SUBMITTED', decidedAt: null, createdAt: hoursAgo(100),
        },
        {
          id: 'a2', kind: 'PROJECT_REJECTION', subjectId: 'proj9', submittedById: 'u2',
          status: 'UPHELD', decidedAt: hoursAgo(10), createdAt: hoursAgo(200),
        },
      ]);
      db.user.findMany.mockResolvedValue([
        { id: 'u1', email: RAW_EMAIL },
        { id: 'u2', email: 'other.person@example.com' },
      ]);

      const out = await svc(db).listAppeals({});
      const [open, decided] = out.items;
      // submitter is a masked email — never the raw address
      expect(open!.submitter).toBe('a***@e***.com');
      expect(open!.submitter).not.toContain('aisha');
      // ageHours derived from createdAt
      expect(open!.ageHours).toBeGreaterThanOrEqual(99);
      // OPEN + past the 48h SLA stub → overdue
      expect(open!.overdue).toBe(true);
      expect(open!.kindAr).toBe('حظر حساب');
      // a DECIDED appeal is never "overdue" even though it is 200h old
      expect(decided!.overdue).toBe(false);
      expect(decided!.kindAr).toBe('رفض مشروع');
      // ordering: open-first (status asc), then oldest-first (createdAt asc)
      const orderBy = db.appeal.findMany.mock.calls[0]![0].orderBy;
      expect(orderBy).toEqual([{ status: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]);
      assertNoRawPII(out);
    });

    it('passes status + kind filters through to the where clause', async () => {
      const db = buildPrisma();
      await svc(db).listAppeals({ status: 'UNDER_REVIEW', kind: 'ACCOUNT_BAN' });
      const where = db.appeal.findMany.mock.calls[0]![0].where;
      expect(where.status).toBe('UNDER_REVIEW');
      expect(where.kind).toBe('ACCOUNT_BAN');
    });
  });

  describe('appealDetail — original decision context + originalDeciderId', () => {
    it('ACCOUNT_BAN: returns suspension block + ban audit row + originalDeciderId (self-review trips)', async () => {
      const db = buildPrisma();
      db.appeal.findUnique.mockResolvedValue({
        id: 'a1', kind: 'ACCOUNT_BAN', subjectId: 'u9', submittedById: 'u1',
        reasonAr: 'أعتقد أن الحظر جاء بالخطأ', status: 'SUBMITTED',
        decidedById: null, decisionReason: null, decidedAt: null, createdAt: new Date(),
      });
      db.user.findUnique
        .mockResolvedValueOnce({ id: 'u1', name: 'Aisha', handle: 'aisha', email: RAW_EMAIL })
        .mockResolvedValueOnce({
          id: 'u9', handle: 'banned', suspendedAt: new Date(),
          suspendedKind: 'BANNED', suspendedReasonAr: 'مخالفة',
        });
      db.auditLog.findFirst.mockResolvedValue({
        actorId: 'operator-7', reason: 'محتوى محظور', createdAt: new Date(),
      });

      const out = await svc(db).appealDetail('a1', 'operator-7');
      expect(out.kind).toBe('ACCOUNT_BAN');
      expect(out.reasonAr).toContain('الحظر');
      expect(out.submitter!.email).toBe('a***@e***.com');
      expect(out.original!.suspension).toMatchObject({ suspendedKind: 'BANNED' });
      expect(out.original!.decision).toMatchObject({ actorId: 'operator-7', reason: 'محتوى محظور' });
      expect(out.originalDeciderId).toBe('operator-7');
      // current operator IS the original decider → self-review guard trips
      expect(out.isSelfReview).toBe(true);
      // the ban audit row was located by action + subject id
      const w = db.auditLog.findFirst.mock.calls[0]![0].where;
      expect(w.action).toBe('ops.moderation.user.ban');
      expect(w.entityId).toBe('u9');
      assertNoRawPII(out);
    });

    it('PROJECT_REJECTION: returns reviewFeedback + reject audit row; no self-review for a different operator', async () => {
      const db = buildPrisma();
      db.appeal.findUnique.mockResolvedValue({
        id: 'a2', kind: 'PROJECT_REJECTION', subjectId: 'proj9', submittedById: 'u2',
        reasonAr: 'عالجت الملاحظات', status: 'UNDER_REVIEW',
        decidedById: null, decisionReason: null, decidedAt: null, createdAt: new Date(),
      });
      db.user.findUnique.mockResolvedValue({ id: 'u2', name: 'Omar', handle: 'omar', email: RAW_EMAIL });
      db.project.findUnique.mockResolvedValue({
        id: 'proj9', titleAr: 'مشروعي', status: 'DRAFT',
        reviewFeedback: 'الوصف ناقص', reviewedAt: new Date(),
      });
      db.auditLog.findFirst.mockResolvedValue({
        actorId: 'operator-3', reason: 'وصف غير مكتمل', createdAt: new Date(),
      });

      const out = await svc(db).appealDetail('a2', 'operator-99');
      expect(out.original!.project).toMatchObject({ reviewFeedback: 'الوصف ناقص' });
      expect(out.original!.decision).toMatchObject({ actorId: 'operator-3' });
      expect(out.originalDeciderId).toBe('operator-3');
      expect(out.isSelfReview).toBe(false);
      const w = db.auditLog.findFirst.mock.calls[0]![0].where;
      expect(w.action).toBe('ops.projects.review.reject');
      expect(w.entityId).toBe('proj9');
      assertNoRawPII(out);
    });

    it('throws NotFound for a missing appeal', async () => {
      const db = buildPrisma();
      db.appeal.findUnique.mockResolvedValue(null);
      await expect(svc(db).appealDetail('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('alerts — appeals.overdue leg (OPS-GAPS R1)', () => {
    it('fires warn when open appeals exceed the SLA, thresholded against the SLA cutoff', async () => {
      const db = buildPrisma();
      // appeal.count order in alerts(): appealsOpen, appealsOverdue, appealsOver2Sla
      db.appeal.count.mockResolvedValueOnce(5).mockResolvedValueOnce(3).mockResolvedValueOnce(0);
      const out = await svc(db).alerts();
      const overdue = out.items.find((a) => a.key === 'appeals.overdue')!;
      expect(overdue).toBeDefined();
      expect(overdue.count).toBe(3);
      expect(overdue.severity).toBe('warn');
      expect(overdue.href).toBe('/ops/appeals');
      expect(overdue.titleAr).toBe('تظلّمات تجاوزت مهلة الرد');
      const open = out.items.find((a) => a.key === 'appeals.open')!;
      expect(open.severity).toBe('info');
      expect(open.count).toBe(5);
      // overdue count is thresholded on a createdAt cutoff over the OPEN states
      const overdueWhere = db.appeal.count.mock.calls[1]![0].where;
      expect(overdueWhere.createdAt.lt).toBeInstanceOf(Date);
      expect(overdueWhere.status.in).toEqual(['SUBMITTED', 'UNDER_REVIEW']);
    });

    it('escalates appeals.overdue to critical when an appeal exceeds 2×SLA', async () => {
      const db = buildPrisma();
      db.appeal.count.mockResolvedValueOnce(2).mockResolvedValueOnce(2).mockResolvedValueOnce(1);
      const out = await svc(db).alerts();
      expect(out.items.find((a) => a.key === 'appeals.overdue')!.severity).toBe('critical');
    });

    it('suppresses both appeals legs when none are open', async () => {
      const db = buildPrisma();
      // default appeal.count → 0 for all three
      const out = await svc(db).alerts();
      expect(out.items.some((a) => a.key === 'appeals.overdue')).toBe(false);
      expect(out.items.some((a) => a.key === 'appeals.open')).toBe(false);
    });
  });
});
