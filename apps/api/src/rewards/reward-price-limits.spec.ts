import { RewardsService } from './rewards.service';

describe('operator-managed reward price limits', () => {
  const tier = { id: 'tier', projectId: 'project', amountHalalas: 2000n, earlyBirdAmountHalalas: null, claimedQty: 1 };
  const prisma = { project: { findUnique: jest.fn() }, rewardTier: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } };
  const settings = { get: jest.fn(async (key: string) => key === 'rewards.minHalalas' ? 500 : 5000) };
  const service = new RewardsService(prisma as never, settings as never);
  const dto = { titleAr: 'مكافأة', descAr: 'وصف المكافأة', amountHalalas: 1000, estDeliveryDate: '2027-01-01' };
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.project.findUnique.mockResolvedValue({ id: 'project', createdById: 'owner', status: 'DRAFT' });
    prisma.rewardTier.findUnique.mockResolvedValue(tier);
    prisma.rewardTier.create.mockResolvedValue(tier);
    prisma.rewardTier.update.mockResolvedValue(tier);
  });
  it.each([499, 5001, Number.MAX_SAFE_INTEGER + 1])('rejects an invalid new price %s without writing', async (amountHalalas) => {
    await expect(service.create('owner', 'project', { ...dto, amountHalalas })).rejects.toThrow();
    expect(prisma.rewardTier.create).not.toHaveBeenCalled();
  });
  it.each([500, 5000])('accepts the inclusive boundary %s', async (amountHalalas) => {
    await service.create('owner', 'project', { ...dto, amountHalalas });
    expect(prisma.rewardTier.create).toHaveBeenCalled();
  });
  it('rejects early pricing below policy or at the regular price', async () => {
    for (const earlyBirdAmountHalalas of [499, 1000]) await expect(service.create('owner', 'project', { ...dto, earlyBirdAmountHalalas })).rejects.toThrow();
  });
  it('preserves the price promised to existing backers', async () => {
    await expect(service.update('owner', 'project', 'tier', { amountHalalas: 3000 })).rejects.toThrow('لها داعمون');
    expect(prisma.rewardTier.update).not.toHaveBeenCalled();
  });
  it('permits a copy correction without repricing an existing tier', async () => {
    await service.update('owner', 'project', 'tier', { titleAr: 'تصحيح الاسم' });
    expect(prisma.rewardTier.update).toHaveBeenCalledWith(expect.objectContaining({ data: { titleAr: 'تصحيح الاسم' } }));
  });
  it('requires an explicit shipping price and rejects fees on non-shipping rewards', async () => {
    await expect(service.create('owner', 'project', { ...dto, requiresShipping: true })).rejects.toThrow('حدد تكلفة الشحن');
    await expect(service.create('owner', 'project', { ...dto, shippingHalalas: 100 })).rejects.toThrow('لا تضاف');
    expect(prisma.rewardTier.create).not.toHaveBeenCalled();
  });
  it('accepts included shipping and enforces the administrator cap', async () => {
    await service.create('owner', 'project', { ...dto, requiresShipping: true, shippingHalalas: 0 });
    expect(prisma.rewardTier.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ shippingHalalas: 0n }) }));
    await expect(service.create('owner', 'project', { ...dto, requiresShipping: true, shippingHalalas: 5001 })).rejects.toThrow('الحد المعتمد');
  });
  it('does not let another creator configure shipping or reprice an existing backed reward', async () => {
    await expect(service.update('other', 'project', 'tier', { shippingHalalas: 500 })).rejects.toThrow('not your project');
    prisma.rewardTier.findUnique.mockResolvedValue({ ...tier, requiresShipping: true, shippingHalalas: 500n });
    await expect(service.update('owner', 'project', 'tier', { shippingHalalas: 600 })).rejects.toThrow('اعتماد تغيير الاتفاق');
    expect(prisma.rewardTier.update).not.toHaveBeenCalled();
  });
  it('allows an unbacked reward shipping update, guarded against a new simultaneous backer', async () => {
    prisma.rewardTier.findUnique.mockResolvedValue({ ...tier, claimedQty: 0, requiresShipping: true, shippingHalalas: null });
    await service.update('owner', 'project', 'tier', { shippingHalalas: 750 });
    expect(prisma.rewardTier.update).toHaveBeenCalledWith({ where: { id: 'tier', claimedQty: 0 }, data: { shippingHalalas: 750n } });
  });
  it('allows configuring or extending destinations but prevents removing existing backed destinations', async () => {
    prisma.rewardTier.findUnique.mockResolvedValue({ ...tier, requiresShipping: true, shipsTo: ['SA'] });
    await expect(service.update('owner', 'project', 'tier', { shipsTo: ['AE'] })).rejects.toThrow('سحب وجهة');
    expect(prisma.rewardTier.update).not.toHaveBeenCalled();
    await service.update('owner', 'project', 'tier', { shipsTo: ['SA', 'AE'] });
    expect(prisma.rewardTier.update).toHaveBeenCalledWith({ where: { id: 'tier', claimedQty: 1 }, data: { shipsTo: ['SA', 'AE'] } });
    prisma.rewardTier.findUnique.mockResolvedValue({ ...tier, requiresShipping: true, shipsTo: [] });
    await service.update('owner', 'project', 'tier', { shipsTo: ['SA'] });
  });
});
