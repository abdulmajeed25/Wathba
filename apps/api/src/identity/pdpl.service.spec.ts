/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConflictException } from '@nestjs/common';
import { PdplService } from './pdpl.service';

function auditMock(): any {
  return { log: jest.fn().mockResolvedValue(undefined) };
}

/**
 * PdplService — Sprint 2 / P0-702.
 *   export: aggregates every table, drops passwordHash, stringifies BigInt
 *   erase: refused with HELD pledges / active campaigns; otherwise
 *          anonymizes PII + deletes satellites, keeps financial rows
 */

const USER = {
  id: 'user-1',
  name: 'سارة',
  email: 's@x.sa',
  phone: '+966500000000',
  passwordHash: 'secret-hash',
  addresses: [],
  creatorProfile: null,
};

function makePrisma(over: Record<string, any> = {}): any {
  const prisma: any = {
    user: {
      findUnique: jest.fn().mockResolvedValue(USER),
      update: jest.fn().mockResolvedValue({}),
    },
    pledge: {
      findMany: jest.fn().mockResolvedValue([{ id: 'pl', amountHalalas: 5000n }]),
      count: jest.fn().mockResolvedValue(0),
    },
    project: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    comment: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    payout: { findMany: jest.fn().mockResolvedValue([]) },
    supplierBid: { findMany: jest.fn().mockResolvedValue([]) },
    creatorFollow: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    faqQuestion: { findMany: jest.fn().mockResolvedValue([]) },
    payoutBeneficiary: { findUnique: jest.fn().mockResolvedValue(null), deleteMany: jest.fn() },
    address: { deleteMany: jest.fn() },
    ...over,
  };
  prisma.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

describe('PdplService.exportData', () => {
  it('exports all sections, drops passwordHash, stringifies BigInt money', async () => {
    const svc = new PdplService(makePrisma(), auditMock());
    const out = (await svc.exportData('user-1')) as any;
    expect(out.profile.email).toBe('s@x.sa');
    expect(out.profile.passwordHash).toBeUndefined();
    expect(out.pledges[0].amountHalalas).toBe('5000'); // BigInt → string
    for (const k of ['projects', 'comments', 'notifications', 'payouts', 'supplierBids', 'follows', 'faqQuestions']) {
      expect(out[k]).toBeDefined();
    }
  });
});

describe('PdplService.eraseAccount', () => {
  it('refuses while pledges are HELD (409)', async () => {
    const prisma = makePrisma({
      pledge: { findMany: jest.fn(), count: jest.fn().mockResolvedValue(2) },
    });
    const svc = new PdplService(prisma, auditMock());
    await expect(svc.eraseAccount('user-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses while campaigns are active (409)', async () => {
    const prisma = makePrisma({
      project: { findMany: jest.fn(), count: jest.fn().mockResolvedValue(1) },
    });
    const svc = new PdplService(prisma, auditMock());
    await expect(svc.eraseAccount('user-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('anonymizes PII, disables login, deletes satellites, keeps financial rows', async () => {
    const prisma = makePrisma();
    const svc = new PdplService(prisma, auditMock());
    const r = await svc.eraseAccount('user-1');
    expect(r).toEqual({ erased: true });
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.email).toBe('erased-user-1@erased.wathba.sa');
    expect(data.passwordHash).toBeNull();
    expect(data.phone).toBeNull();
    expect(prisma.address.deleteMany).toHaveBeenCalled();
    expect(prisma.notification.deleteMany).toHaveBeenCalled();
    expect(prisma.creatorFollow.deleteMany).toHaveBeenCalled();
  });
});
