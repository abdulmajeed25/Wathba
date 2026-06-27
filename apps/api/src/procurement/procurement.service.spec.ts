import { ProcurementService } from './procurement.service';
import { PrismaService } from '../prisma/prisma.service';
import { BidStatus, RFQStatus } from '@prisma/client';

interface MockedPrisma {
  rFQ: Record<string, jest.Mock>;
  supplierBid: Record<string, jest.Mock>;
  project: Record<string, jest.Mock>;
  $transaction: jest.Mock;
}

const buildPrisma = () => {
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
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
};

const asPrisma = (m: MockedPrisma): PrismaService => m as unknown as PrismaService;

describe('ProcurementService.award', () => {
  it('rejects when caller is not the project creator', async () => {
    const prisma = buildPrisma();
    prisma.rFQ.findUnique!.mockResolvedValue({
      id: 'r1', status: RFQStatus.OPEN, project: { createdById: 'other' },
    });
    const svc = new ProcurementService(asPrisma(prisma));
    await expect(svc.award('u1', 'r1', 'b1')).rejects.toThrow(/only the project creator/);
  });

  it('rejects when RFQ already AWARDED', async () => {
    const prisma = buildPrisma();
    prisma.rFQ.findUnique!.mockResolvedValue({
      id: 'r1', status: RFQStatus.AWARDED, project: { createdById: 'u1' },
    });
    const svc = new ProcurementService(asPrisma(prisma));
    await expect(svc.award('u1', 'r1', 'b1')).rejects.toThrow(/cannot award/);
  });

  it('atomically AWARDS chosen bid + REJECTS others + flips RFQ', async () => {
    const prisma = buildPrisma();
    prisma.rFQ.findUnique!.mockResolvedValue({
      id: 'r1', status: RFQStatus.OPEN, project: { createdById: 'u1' },
    });
    prisma.supplierBid.findUnique!.mockResolvedValue({
      id: 'b1', rfqId: 'r1', status: BidStatus.SUBMITTED,
    });
    prisma.rFQ.update!.mockResolvedValue({
      id: 'r1', status: RFQStatus.AWARDED, awardedBidId: 'b1',
      projectId: 'p1', specsAr: 'x', dueDate: new Date(), createdAt: new Date(),
    });
    const svc = new ProcurementService(asPrisma(prisma));
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
  it('rejects on closed RFQ', async () => {
    const prisma = buildPrisma();
    prisma.rFQ.findUnique!.mockResolvedValue({
      id: 'r1', status: RFQStatus.CLOSED, dueDate: new Date(Date.now() + 60_000),
    });
    const svc = new ProcurementService(asPrisma(prisma));
    await expect(
      svc.submitBid('s1', 'r1', { amountHalalas: 1000, leadTimeDays: 7, specComplianceNote: 'ok' }),
    ).rejects.toThrow(/no longer accepting/);
  });

  it('rejects duplicate bid from same supplier', async () => {
    const prisma = buildPrisma();
    prisma.rFQ.findUnique!.mockResolvedValue({
      id: 'r1', status: RFQStatus.OPEN, dueDate: new Date(Date.now() + 60_000),
    });
    prisma.supplierBid.findFirst!.mockResolvedValue({ id: 'existing' });
    const svc = new ProcurementService(asPrisma(prisma));
    await expect(
      svc.submitBid('s1', 'r1', { amountHalalas: 1000, leadTimeDays: 7, specComplianceNote: 'ok' }),
    ).rejects.toThrow(/already submitted/);
  });
});
