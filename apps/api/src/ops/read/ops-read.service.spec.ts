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
  findMany: Mock;
  count: Mock;
  aggregate: Mock;
  groupBy: Mock;
}
function model(): MockModel {
  return {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: {} }),
    groupBy: jest.fn().mockResolvedValue([]),
  };
}

interface MockDb {
  project: MockModel;
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
}
function buildPrisma(): MockDb {
  return {
    project: model(),
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
  };
}

const settingsStub = {
  getAll: jest.fn().mockResolvedValue([
    { key: 'pledges.minHalalas', titleAr: 'x', descriptionAr: 'y', value: 1000, source: 'default' },
  ]),
} as unknown as SettingsService;

function svc(db: MockDb): OpsReadService {
  return new OpsReadService(db as unknown as PrismaService, settingsStub);
}

const RAW_EMAIL = 'aisha.almutairi@example.com';
const RAW_PHONE = '+966501234567';

/** Deep scan: fail if any raw PII string survives into a response. */
function assertNoRawPII(payload: unknown): void {
  const json = JSON.stringify(payload);
  expect(json).not.toContain(RAW_EMAIL);
  expect(json).not.toContain(RAW_PHONE);
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
      // net is null for PENDING payouts → liability falls back to gross.
      expect(out.vitals.pendingPayoutLiabilityHalalas).toBe('500000');
      expect(out.vitals.usersCount).toBe(1234);
      expect(out.workQueue.reportsOpen).toBe(3); // 1 project + 2 comment
      expect(typeof out.vitals.gmvHalalas).toBe('string');
      expect(typeof out.generatedAt).toBe('string');
    });
  });

  describe('effectiveSettings', () => {
    it('delegates to SettingsService.getAll()', async () => {
      const out = await svc(buildPrisma()).effectiveSettings();
      expect(out.items[0]!.key).toBe('pledges.minHalalas');
    });
  });
});
