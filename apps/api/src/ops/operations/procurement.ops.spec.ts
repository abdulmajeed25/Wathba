import { OperationsRegistry } from '../operations.registry';
import { procurementOps } from './procurement.ops';
import type { OperationContext } from '../operation.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { EmailService } from '../../email/email.service';

/**
 * Batch OPS-PRO Phase 1 — procurement ops guard tests: every precondition
 * refusal (Arabic code), the state transitions each execute writes, and the
 * SUPPLIER_VERIFIED afterCommit notification.
 */

type Mock = jest.Mock;
function model() {
  return {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'exec-1', ...data })),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
  };
}

function buildPrisma() {
  const prisma = {
    user: model(),
    project: model(),
    rFQ: model(),
    supplierBid: model(),
    operationExecution: model(),
    auditLog: model(),
    operationProposal: model(),
    $transaction: jest.fn() as Mock,
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

const notifications = { create: jest.fn().mockResolvedValue(null) };
const email = {};

function regWith(prisma: ReturnType<typeof buildPrisma>): OperationsRegistry {
  const reg = new OperationsRegistry(prisma as unknown as PrismaService);
  for (const op of procurementOps({
    prisma: prisma as unknown as PrismaService,
    notifications: notifications as unknown as NotificationsService,
    email: email as unknown as EmailService,
  }))
    reg.register(op);
  return reg;
}

const ADMIN: OperationContext['actor'] = { id: 'admin-1', type: 'HUMAN', roles: ['ADMIN'] };
const ctx = (over: Partial<OperationContext> = {}): OperationContext => ({
  actor: ADMIN,
  stepUpVerifiedAt: new Date(),
  reason: 'سبب تشغيلي واضح ومكتوب للاختبار',
  ...over,
});

const USER_ID = '11111111-1111-4111-8111-111111111111';
const RFQ_ID = '22222222-2222-4222-8222-222222222222';
const BID_ID = '33333333-3333-4333-8333-333333333333';

const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  notifications.create.mockClear();
});

describe('suppliers.verify', () => {
  it('refuses a missing user', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      regWith(prisma).execute('suppliers.verify', { userId: USER_ID }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'user-missing' }) });
  });

  it('refuses a user without the SUPPLIER role', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ id: USER_ID, roles: ['BACKER'], supplierVerifiedAt: null });
    await expect(
      regWith(prisma).execute('suppliers.verify', { userId: USER_ID }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'not-a-supplier' }) });
  });

  it('refuses an already-verified supplier', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: USER_ID, roles: ['SUPPLIER'], supplierVerifiedAt: new Date(),
    });
    await expect(
      regWith(prisma).execute('suppliers.verify', { userId: USER_ID }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'already-verified' }) });
  });

  it('verifies: stamps verifiedAt + actor + note, and notifies SUPPLIER_VERIFIED', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: USER_ID, name: 'مورّد', roles: ['SUPPLIER'], supplierVerifiedAt: null,
    });
    prisma.user.update.mockResolvedValue({ id: USER_ID });
    const out = await regWith(prisma).execute(
      'suppliers.verify',
      { userId: USER_ID, note: 'وثائق سليمة' },
      ctx(),
    );
    expect(out.result).toMatchObject({ verifiedAt: expect.any(String) });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: expect.objectContaining({
        supplierVerifiedById: null, // non-uuid actor id → stored as null
        supplierVerifyNote: 'وثائق سليمة',
        supplierVerifiedAt: expect.any(Date),
      }),
    });
    await flush();
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, kind: 'SUPPLIER_VERIFIED' }),
    );
  });
});

describe('rfq.close', () => {
  it('refuses a missing RFQ', async () => {
    const prisma = buildPrisma();
    prisma.rFQ.findUnique.mockResolvedValue(null);
    await expect(
      regWith(prisma).execute('rfq.close', { rfqId: RFQ_ID }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'rfq-missing' }) });
  });

  it('refuses an RFQ that is not OPEN', async () => {
    const prisma = buildPrisma();
    prisma.rFQ.findUnique.mockResolvedValue({ id: RFQ_ID, status: 'AWARDED' });
    await expect(
      regWith(prisma).execute('rfq.close', { rfqId: RFQ_ID }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'not-open' }) });
  });

  it('closes: RFQ OPEN→CLOSED and rejects live bids', async () => {
    const prisma = buildPrisma();
    prisma.rFQ.findUnique.mockResolvedValue({ id: RFQ_ID, status: 'OPEN' });
    prisma.supplierBid.count.mockResolvedValue(3);
    prisma.supplierBid.updateMany.mockResolvedValue({ count: 3 });
    const out = await regWith(prisma).execute('rfq.close', { rfqId: RFQ_ID }, ctx());
    expect(out.result).toEqual({ status: 'CLOSED', bidsRejected: 3 });
    expect(prisma.rFQ.update).toHaveBeenCalledWith({
      where: { id: RFQ_ID }, data: { status: 'CLOSED' },
    });
    expect(prisma.supplierBid.updateMany).toHaveBeenCalledWith({
      where: { rfqId: RFQ_ID, status: { in: ['SUBMITTED', 'SHORTLISTED'] } },
      data: { status: 'REJECTED' },
    });
  });
});

describe('rfq.cancel', () => {
  it('refuses an RFQ that is not OPEN (not-cancellable)', async () => {
    const prisma = buildPrisma();
    prisma.rFQ.findUnique.mockResolvedValue({ id: RFQ_ID, status: 'CLOSED' });
    await expect(
      regWith(prisma).execute('rfq.cancel', { rfqId: RFQ_ID }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'not-cancellable' }) });
  });

  it('cancels: RFQ OPEN→CANCELLED and rejects live bids', async () => {
    const prisma = buildPrisma();
    prisma.rFQ.findUnique.mockResolvedValue({ id: RFQ_ID, status: 'OPEN' });
    prisma.supplierBid.count.mockResolvedValue(2);
    prisma.supplierBid.updateMany.mockResolvedValue({ count: 2 });
    const out = await regWith(prisma).execute('rfq.cancel', { rfqId: RFQ_ID }, ctx());
    expect(out.result).toEqual({ status: 'CANCELLED', bidsRejected: 2 });
    expect(prisma.rFQ.update).toHaveBeenCalledWith({
      where: { id: RFQ_ID }, data: { status: 'CANCELLED' },
    });
  });
});

describe('bids.shortlist', () => {
  it('refuses a missing bid', async () => {
    const prisma = buildPrisma();
    prisma.supplierBid.findUnique.mockResolvedValue(null);
    await expect(
      regWith(prisma).execute('bids.shortlist', { bidId: BID_ID }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'bid-missing' }) });
  });

  it('refuses when the parent RFQ is not OPEN', async () => {
    const prisma = buildPrisma();
    prisma.supplierBid.findUnique.mockResolvedValue({
      id: BID_ID, status: 'SUBMITTED', rfq: { status: 'CLOSED' }, amountHalalas: 100n,
    });
    await expect(
      regWith(prisma).execute('bids.shortlist', { bidId: BID_ID }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'rfq-not-open' }) });
  });

  it('refuses a bid that is not SUBMITTED', async () => {
    const prisma = buildPrisma();
    prisma.supplierBid.findUnique.mockResolvedValue({
      id: BID_ID, status: 'REJECTED', rfq: { status: 'OPEN' }, amountHalalas: 100n,
    });
    await expect(
      regWith(prisma).execute('bids.shortlist', { bidId: BID_ID }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'not-submitted' }) });
  });

  it('shortlists: bid SUBMITTED→SHORTLISTED', async () => {
    const prisma = buildPrisma();
    prisma.supplierBid.findUnique.mockResolvedValue({
      id: BID_ID, status: 'SUBMITTED', rfq: { status: 'OPEN' }, amountHalalas: 100n,
    });
    prisma.supplierBid.update.mockResolvedValue({ id: BID_ID, status: 'SHORTLISTED' });
    const out = await regWith(prisma).execute('bids.shortlist', { bidId: BID_ID }, ctx());
    expect(out.result).toEqual({ id: BID_ID, status: 'SHORTLISTED' });
    expect(prisma.supplierBid.update).toHaveBeenCalledWith({
      where: { id: BID_ID }, data: { status: 'SHORTLISTED' },
    });
  });
});
