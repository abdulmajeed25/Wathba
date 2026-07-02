import { FundingService } from './funding.service';
import { EscrowService } from '../escrow-payments/escrow.service';
import { ContractsService } from '../contracts/contracts.service';
import { FundingGateway } from './funding.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectStatus } from '@prisma/client';

/**
 * Unit tests for the §5 funding rule: at deadline, capture iff
 * raised ≥ goal × thresholdPct/100, else void/refund.
 */

describe('FundingService.settleProject (§5 FSM)', () => {
  const buildProject = (over: Partial<Record<string, unknown>> = {}) => ({
    id: 'p1',
    status: ProjectStatus.LIVE,
    deadline: new Date(Date.now() - 1000), // past
    fundingGoalHalalas: 100_000_000n, // 1,000,000 SAR
    releaseThresholdPct: 80,
    raisedHalalas: 80_000_000n,
    ...over,
  });

  const buildService = (project: ReturnType<typeof buildProject>) => {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue(project),
        update: jest.fn().mockResolvedValue(project),
        // Sprint 1 / P1-306 atomic claim — count=1 means "we won the settle".
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      pledge: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as unknown as PrismaService;
    const escrow = {
      captureAllHeld: jest.fn().mockResolvedValue({ captured: 0, failed: 0 }),
      refundAllHeld: jest.fn().mockResolvedValue({ refunded: 0, failed: 0 }),
    } as unknown as EscrowService;
    const contracts = {} as ContractsService;
    const gateway = { emitTick: jest.fn() } as unknown as FundingGateway;
    const community = {
      materializeFromPledge: jest.fn().mockResolvedValue(undefined),
    } as unknown as import('../community/community.service').CommunityService;
    return { svc: new FundingService(prisma, escrow, contracts, gateway, community, { record: jest.fn() } as any), prisma, escrow };
  };

  it('no-ops when another settler already claimed the transition (P1-306 race)', async () => {
    const { svc, prisma, escrow } = buildService(buildProject());
    (prisma as unknown as { project: { updateMany: jest.Mock } }).project.updateMany
      .mockResolvedValue({ count: 0 });
    const res = await svc.settleProject('p1');
    expect(res.transition).toBe('noop');
    expect(escrow.captureAllHeld).not.toHaveBeenCalled();
    expect(escrow.refundAllHeld).not.toHaveBeenCalled();
  });

  it('captures when raised exactly meets the 80% threshold', async () => {
    const { svc, escrow } = buildService(buildProject({ raisedHalalas: 80_000_000n }));
    const res = await svc.settleProject('p1');
    expect(res.transition).toBe('funded');
    expect(escrow.captureAllHeld).toHaveBeenCalledWith('p1');
    expect(escrow.refundAllHeld).not.toHaveBeenCalled();
  });

  it('refunds when raised is 1 halala below the threshold', async () => {
    const { svc, escrow } = buildService(buildProject({ raisedHalalas: 79_999_999n }));
    const res = await svc.settleProject('p1');
    expect(res.transition).toBe('refunded');
    expect(escrow.refundAllHeld).toHaveBeenCalledWith('p1');
    expect(escrow.captureAllHeld).not.toHaveBeenCalled();
  });

  it('no-ops if deadline has not passed', async () => {
    const future = new Date(Date.now() + 60_000);
    const { svc, escrow } = buildService(buildProject({ deadline: future }));
    const res = await svc.settleProject('p1');
    expect(res.transition).toBe('noop');
    expect(escrow.captureAllHeld).not.toHaveBeenCalled();
    expect(escrow.refundAllHeld).not.toHaveBeenCalled();
  });

  it('no-ops if project is not LIVE', async () => {
    const { svc, escrow } = buildService(buildProject({ status: ProjectStatus.FUNDED }));
    const res = await svc.settleProject('p1');
    expect(res.transition).toBe('noop');
    expect(escrow.captureAllHeld).not.toHaveBeenCalled();
  });

  it('respects custom release threshold — 50% pass', async () => {
    const { svc, escrow } = buildService(
      buildProject({ releaseThresholdPct: 50, raisedHalalas: 50_000_000n }),
    );
    const res = await svc.settleProject('p1');
    expect(res.transition).toBe('funded');
    expect(escrow.captureAllHeld).toHaveBeenCalled();
  });

  it('respects custom release threshold — 50% fail at 49,999,999', async () => {
    const { svc, escrow } = buildService(
      buildProject({ releaseThresholdPct: 50, raisedHalalas: 49_999_999n }),
    );
    const res = await svc.settleProject('p1');
    expect(res.transition).toBe('refunded');
    expect(escrow.refundAllHeld).toHaveBeenCalled();
  });
});

describe('FundingService.pledge (money-in entry point — Sprint 1 / P1-902)', () => {
  const PROJ = 'proj-1';
  const TIER = 'tier-1';
  const BACKER = 'backer-1';

  const liveProject = (over: Partial<Record<string, unknown>> = {}) => ({
    id: PROJ,
    status: ProjectStatus.LIVE,
    deadline: new Date(Date.now() + 86_400_000),
    titleAr: 'مشروع اختبار',
    ...over,
  });

  const tier = (over: Partial<Record<string, unknown>> = {}) => ({
    id: TIER,
    projectId: PROJ,
    amountHalalas: 50_000n,
    limitQty: null,
    claimedQty: 0,
    requiresShipping: false,
    includesPhysicalProduct: false,
    ...over,
  });

  const dto = (over: Partial<Record<string, unknown>> = {}) =>
    ({ projectId: PROJ, tierId: TIER, amountHalalas: 60_000, source: 'tok_x', ...over }) as never;

  function build(opts: {
    project?: Record<string, unknown> | null;
    tierRow?: Record<string, unknown> | null;
    holdResult?: { paymentRef: string; status: 'authorized' | 'failed' };
    holdThrows?: boolean;
  }) {
    const prisma: Record<string, unknown> = {
      project: {
        findUnique: jest.fn().mockResolvedValue(opts.project === undefined ? liveProject() : opts.project),
        update: jest.fn().mockResolvedValue({ raisedHalalas: 60_000n, backersCount: 1 }),
      },
      rewardTier: {
        findUnique: jest.fn().mockResolvedValue(opts.tierRow === undefined ? tier() : opts.tierRow),
        update: jest.fn().mockResolvedValue({}),
      },
      addOn: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      pledge: {
        aggregate: jest.fn().mockResolvedValue({ _max: { backerNo: 4 } }),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'pl-1', ...data })),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'pl-1', ...data })),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
    };
    (prisma as { $transaction?: unknown }).$transaction = jest.fn(
      async (fn: (tx: unknown) => unknown) => fn(prisma),
    );
    const escrow = {
      hold: opts.holdThrows
        ? jest.fn().mockRejectedValue(new Error('psp down'))
        : jest.fn().mockResolvedValue(opts.holdResult ?? { paymentRef: 'pay_ok', status: 'authorized' }),
      captureAllHeld: jest.fn(),
      refundAllHeld: jest.fn(),
    };
    const contracts = { inferType: jest.fn().mockReturnValue('DONATION') };
    const gateway = { emitTick: jest.fn() };
    const community = { materializeFromPledge: jest.fn().mockResolvedValue(undefined) };
    const ledger = { record: jest.fn().mockResolvedValue(undefined) };
    const svc = new FundingService(
      prisma as never, escrow as never, contracts as never,
      gateway as never, community as never, ledger as never,
    );
    type MockedTables = {
      project: { findUnique: jest.Mock; update: jest.Mock };
      rewardTier: { findUnique: jest.Mock; update: jest.Mock };
      pledge: { aggregate: jest.Mock; create: jest.Mock; update: jest.Mock };
      user: { update: jest.Mock };
    };
    return { svc, prisma: prisma as never as MockedTables, escrow, gateway, ledger };
  }

  it('rejects a non-LIVE project', async () => {
    const { svc } = build({ project: liveProject({ status: ProjectStatus.DRAFT }) });
    await expect(svc.pledge(BACKER, dto())).rejects.toThrow(/not LIVE/);
  });

  it('rejects past-deadline projects', async () => {
    const { svc } = build({ project: liveProject({ deadline: new Date(Date.now() - 1000) }) });
    await expect(svc.pledge(BACKER, dto())).rejects.toThrow(/deadline/);
  });

  it('rejects a tier belonging to another project', async () => {
    const { svc } = build({ tierRow: tier({ projectId: 'someone-else' }) });
    await expect(svc.pledge(BACKER, dto())).rejects.toThrow(/invalid tier/);
  });

  it('rejects an amount below the tier minimum', async () => {
    const { svc } = build({});
    await expect(svc.pledge(BACKER, dto({ amountHalalas: 49_999 }))).rejects.toThrow(/below the tier minimum/);
  });

  it('rejects a sold-out tier', async () => {
    const { svc } = build({ tierRow: tier({ limitQty: 10, claimedQty: 10 }) });
    await expect(svc.pledge(BACKER, dto())).rejects.toThrow(/sold out/);
  });

  it('rejects a shipping tier without a shipping address', async () => {
    const { svc } = build({ tierRow: tier({ requiresShipping: true }) });
    await expect(svc.pledge(BACKER, dto())).rejects.toThrow(/shipping address is required/);
  });

  it('marks the pledge FAILED and throws 400 when the PSP hold throws — counters untouched', async () => {
    const { svc, prisma, ledger } = build({ holdThrows: true });
    await expect(svc.pledge(BACKER, dto())).rejects.toThrow(/authorization failed/);
    expect(prisma.pledge.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    expect(prisma.project.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(ledger.record).not.toHaveBeenCalled();
  });

  it('marks the pledge FAILED when the PSP declines the hold', async () => {
    const { svc, prisma } = build({ holdResult: { paymentRef: 'pay_declined', status: 'failed' } });
    await expect(svc.pledge(BACKER, dto())).rejects.toThrow(/not authorized/);
    expect(prisma.pledge.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('holds tier + add-ons at the PSP (Sprint 2 undercharge regression)', async () => {
    const { svc, prisma, escrow, ledger } = build({});
    (prisma as unknown as { addOn: { findMany: jest.Mock } }).addOn.findMany.mockResolvedValue([
      { id: 'addon-1', projectId: PROJ, titleAr: 'إضافة', amountHalalas: 15_000n, limitQty: null, claimedQty: 0 },
    ]);
    await svc.pledge(BACKER, dto({ addOns: [{ addOnId: 'addon-1', qty: 2 }] }));
    // 60,000 tier + 2 × 15,000 add-on = 90,000 must be authorized
    expect(escrow.hold).toHaveBeenCalledWith(
      expect.objectContaining({ amountHalalas: 90_000n }),
    );
    expect(ledger.record).toHaveBeenCalledWith(
      expect.objectContaining({ entryType: 'HOLD_AUTHORIZED', amountHalalas: 90_000n }),
    );
  });

  it('happy path: HELD pledge + atomic counters + ledger + live tick', async () => {
    const { svc, prisma, gateway, ledger } = build({});
    const out = (await svc.pledge(BACKER, dto())) as unknown as { paymentRef: string };
    expect(out.paymentRef).toBe('pay_ok');
    // pledge row created HELD with backerNo = max+1
    expect(prisma.pledge.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'HELD', backerNo: 5 }) }),
    );
    // counters bumped in the tx
    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          raisedHalalas: { increment: 60_000n },
          backersCount: { increment: 1 },
        }),
      }),
    );
    expect(prisma.rewardTier.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { claimedQty: { increment: 1 } } }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { totalPledgedHalalas: { increment: 60_000n } },
      }),
    );
    // money journal + realtime tick
    expect(ledger.record).toHaveBeenCalledWith(
      expect.objectContaining({ entryType: 'HOLD_AUTHORIZED', pspRef: 'pay_ok' }),
    );
    expect(gateway.emitTick).toHaveBeenCalled();
  });
});
