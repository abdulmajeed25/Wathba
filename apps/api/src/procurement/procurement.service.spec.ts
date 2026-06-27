import { ProcurementService } from './procurement.service';
import { PrismaService } from '../prisma/prisma.service';
import { BidStatus, RFQStatus } from '@prisma/client';

type MockedPrisma = PrismaService & {
  rFQ: Record<string, jest.Mock>;
  supplierBid: Record<string, jest.Mock>;
  project: Record<string, jest.Mock>;
  $transaction: jest.Mock;
};

const buildPrisma = (over: Record<string, unknown> = {}): MockedPrisma => {
  const prisma: MockedPrisma = {
    project: { findUnique: jest.fn() },
    rFQ: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    supplierBid: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
    ...over,
  } as unknown as MockedPrisma;
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
};

describe('ProcurementService.award', () => {
  it('rejects on non-creator', async () => {
    const prisma = buildPrisma();
    (prisma.rFQ.findUnique as jest.Mock).mockResolvedValue({
      id: 'r1',
      status: RFQStatus.OPEN,
      project: { createdById: 'other-user' },
    });
    const svc = new ProcurementService(prisma);
    await expect(svc.award('u1', 'r1', 'b1')).rejects.toThrow(/only the project creator/);
  });

  it('rejects on closed RFQ', async () => {
    const prisma = buildPrisma();
    (prisma.rFQ.findUnique as jest.Mock).mockResolvedValue({
      id: 'r1',
      status: RFQStatus.AWARDED,
      project: { createdById: 'u1' },
    });
    const svc = new ProcurementService(prisma);
    await expect(svc.award('u1', 'r1', 'b1')).rejects.toThrow(/cannot award/);
  });

  it('marks chosen bid AWARDED and rejects others', async () => {
    const prisma = buildPrisma();
    (prisma.rFQ.findUnique as jest.Mock).mockResolvedValue({
      id: 'r1',
      status: RFQStatus.OPEN,
      project: { createdById: 'u1' },
    });
    (prisma.supplierBid.findUnique as jest.Mock).mockResolvedValue({
      id: 'b1',
      rfqId: 'r1',
      status: BidStatus.SUBMITTED,
    });
    (prisma.rFQ.update as jest.Mock).mockResolvedValue({
      id: 'r1',
      status: RFQStatus.AWARDED,
      awardedBidId: 'b1',
      projectId: 'p1',
      specsAr: 'x',
      dueDate: new Date(),
      createdAt: new Date(),
    });
    const svc = new ProcurementService(prisma);
    const r = await svc.award('u1', 'r1', 'b1');
    expect(r.status).toBe(RFQStatus.AWARDED);
    expect(prisma.supplierBid.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { status: BidStatus.AWARDED },
    });
    expect(prisma.supplierBid.updateMany).toHaveBeenCalledWith({
      where: { rfqId: 'r1', id: { not: 'b1' } },
      data: { status: BidStatus.REJECTED },
    });
  });
});

describe('ProcurementService.submitBid', () => {
  it('rejects when RFQ is not OPEN', async () => {
    const prisma = buildPrisma();
    (prisma.rFQ.findUnique as jest.Mock).mockResolvedValue({
      id: 'r1',
      status: RFQStatus.CLOSED,
      dueDate: new Date(Date.now() + 60_000),
    });
    const svc = new ProcurementService(prisma);
    await expect(
      svc.submitBid('s1', 'r1', {
        amountHalalas: 100_000,
        leadTimeDays: 30,
        specComplianceNote: 'all good',
      }),
    ).rejects.toThrow(/no longer accepting/);
  });

  it('rejects duplicate bid from same supplier', async () => {
    const prisma = buildPrisma();
    (prisma.rFQ.findUnique as jest.Mock).mockResolvedValue({
      id: 'r1',
      status: RFQStatus.OPEN,
      dueDate: new Date(Date.now() + 60_000),
    });
    (prisma.supplierBid.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });
    const svc = new ProcurementService(prisma);
    await expect(
      svc.submitBid('s1', 'r1', {
        amountHalalas: 100_000,
        leadTimeDays: 30,
        specComplianceNote: 'all good',
      }),
    ).rejects.toThrow(/already submitted/);
  });
});
