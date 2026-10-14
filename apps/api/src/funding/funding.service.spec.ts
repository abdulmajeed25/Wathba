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

// Batch OPS (registry completion) — FundingService reads pledge bounds +
// payment-method switches through SettingsService; this stub returns the
// catalog defaults so the pre-existing semantics hold verbatim.
const settingsStub = () =>
  ({
    get: jest.fn(async (key: string) =>
      ({
        'pledges.minHalalas': 1000,
        'pledges.maxHalalas': null,
        'payments.methodsEnabled': { card: true, bnpl: true },
        'support.inboxEmail': 'support@wathba.sa',
        // OPS-GAPS Y2 — funding policy knobs at their catalog defaults.
        'funding.graceWindowHours': 72,
        'funding.pauseCapDays': 7,
      })[key],
    ),
    invalidate: jest.fn(),
  }) as never;

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
        findMany: jest.fn().mockResolvedValue([]),
        // Batch PAY — BNPL intent transitions at settlement.
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
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
    const email = { projectFunded: jest.fn(), projectFailed: jest.fn() } as any;
    const notifications = { create: jest.fn(), filterAllowed: jest.fn().mockResolvedValue([]) } as any;
    return { svc: new FundingService(prisma, escrow, contracts, gateway, community, { record: jest.fn() } as any, { log: jest.fn() } as any, email, notifications, { assertHuman: jest.fn().mockResolvedValue(undefined) } as never, settingsStub()), prisma, escrow };
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

  it('requires the next whole halala when the success threshold is fractional', async () => {
    const below = buildService(buildProject({ fundingGoalHalalas: 101n, raisedHalalas: 80n }));
    expect((await below.svc.settleProject('p1')).transition).toBe('refunded');
    expect(below.escrow.captureAllHeld).not.toHaveBeenCalled();
    const above = buildService(buildProject({ fundingGoalHalalas: 101n, raisedHalalas: 81n }));
    expect((await above.svc.settleProject('p1')).transition).toBe('funded');
  });

  it.each(['raisedHalalas', 'fundingGoalHalalas', 'releaseThresholdPct', 'deadline', 'status'] as const)(
    'does not move money when %s changes between the read and settlement claim', async field => {
      const snapshot = buildProject();
      const current = { ...snapshot, [field]: field === 'deadline' ? new Date(Date.now() + 60000)
        : field === 'status' ? ProjectStatus.PAUSED : field === 'releaseThresholdPct' ? 90
          : (snapshot[field] as bigint) + 1n };
      const { svc, prisma, escrow } = buildService(snapshot);
      (prisma.project.updateMany as jest.Mock).mockImplementation(({ where }) => ({
        count: Object.entries(where).every(([key, value]) => current[key as keyof typeof current] === value) ? 1 : 0,
      }));
      expect((await svc.settleProject('p1')).transition).toBe('noop');
      expect(escrow.captureAllHeld).not.toHaveBeenCalled();
      expect(escrow.refundAllHeld).not.toHaveBeenCalled();
    },
  );

  it('refunds when raised is 1 halala below the threshold', async () => {
    const { svc, escrow } = buildService(buildProject({ raisedHalalas: 79_999_999n }));
    const res = await svc.settleProject('p1');
    expect(res.transition).toBe('refunded');
    expect(escrow.refundAllHeld).toHaveBeenCalledWith('p1');
    expect(escrow.captureAllHeld).not.toHaveBeenCalled();
  });

  it('Batch PAY — success: BNPL intents become due (CAPTURE_GRACE); failure: discarded', async () => {
    // Success path — intents transition to the 72h checkout window.
    const success = buildService(buildProject({}));
    await success.svc.settleProject('p1');
    const sCalls = (success.prisma.pledge.updateMany as jest.Mock).mock.calls;
    expect(sCalls[0][0].where).toEqual({ projectId: 'p1', status: 'PENDING_BNPL' });
    expect(sCalls[0][0].data.status).toBe('CAPTURE_GRACE');
    expect(sCalls[0][0].data.graceExpiresAt).toBeInstanceOf(Date);

    // Failure path uses the shared sweep: a bulk status flip would leak stock.
    const fail = buildService(buildProject({ raisedHalalas: 1n }));
    await fail.svc.settleProject('p1');
    expect(fail.prisma.pledge.updateMany).not.toHaveBeenCalled();
    expect(fail.escrow.refundAllHeld).toHaveBeenCalledWith('p1');
  });

  it('failed settlement reports refund_pending when the database completion condition is not met', async () => {
    const { svc, prisma } = buildService(buildProject({ raisedHalalas: 1n }));
    (prisma.project.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect((await svc.settleProject('p1')).transition).toBe('refund_pending');
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('OPS-GAPS Y2 — the BNPL grace window follows funding.graceWindowHours (default 72h, editable)', async () => {
    const HOUR = 3_600_000;
    const settingsFor = (graceHours: number) =>
      ({
        get: jest.fn(async (key: string) =>
          key === 'funding.graceWindowHours' ? graceHours : ({
            'pledges.minHalalas': 1000,
            'pledges.maxHalalas': null,
            'payments.methodsEnabled': { card: true, bnpl: true },
            'funding.pauseCapDays': 7,
          } as Record<string, unknown>)[key],
        ),
        invalidate: jest.fn(),
      }) as never;
    const buildWith = (graceHours: number) => {
      const project = buildProject({});
      const prisma = {
        project: {
          findUnique: jest.fn().mockResolvedValue(project),
          update: jest.fn().mockResolvedValue(project),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        pledge: {
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([]),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      } as unknown as PrismaService;
      const escrow = {
        captureAllHeld: jest.fn().mockResolvedValue({ captured: 0, failed: 0 }),
        refundAllHeld: jest.fn().mockResolvedValue({ refunded: 0, failed: 0 }),
      } as unknown as EscrowService;
      const svc = new FundingService(
        prisma, escrow, {} as ContractsService, { emitTick: jest.fn() } as never,
        {} as never, { record: jest.fn() } as never, { log: jest.fn() } as never,
        { projectFunded: jest.fn(), projectFailed: jest.fn() } as never,
        { create: jest.fn(), filterAllowed: jest.fn().mockResolvedValue([]) } as never,
        { assertHuman: jest.fn().mockResolvedValue(undefined) } as never,
        settingsFor(graceHours),
      );
      return { svc, prisma };
    };

    // Default 72h — unchanged behaviour.
    const def = buildWith(72);
    const t0 = Date.now();
    await def.svc.settleProject('p1');
    const defExpiry = (def.prisma.pledge.updateMany as jest.Mock).mock.calls[0][0].data
      .graceExpiresAt as Date;
    expect(defExpiry.getTime() - t0).toBeGreaterThanOrEqual(72 * HOUR - 5_000);
    expect(defExpiry.getTime() - t0).toBeLessThanOrEqual(72 * HOUR + 5_000);

    // Non-default 24h — the window narrows.
    const narrow = buildWith(24);
    const t1 = Date.now();
    await narrow.svc.settleProject('p1');
    const narrowExpiry = (narrow.prisma.pledge.updateMany as jest.Mock).mock.calls[0][0].data
      .graceExpiresAt as Date;
    expect(narrowExpiry.getTime() - t1).toBeGreaterThanOrEqual(24 * HOUR - 5_000);
    expect(narrowExpiry.getTime() - t1).toBeLessThanOrEqual(24 * HOUR + 5_000);
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
    shippingHalalas: 0n,
    includesPhysicalProduct: false,
    // CC-13 — pledge guard reads these; default to an open tier, no early-bird.
    isActive: true,
    earlyBirdAmountHalalas: null,
    earlyBirdUntil: null,
    ...over,
  });

  const dto = (over: Partial<Record<string, unknown>> = {}) =>
    ({ projectId: PROJ, tierId: TIER, amountHalalas: 60_000, source: 'tok_x', ...over }) as never;

  function build(opts: {
    project?: Record<string, unknown> | null;
    tierRow?: Record<string, unknown> | null;
    holdResult?: { paymentRef: string; status: 'authorized' | 'failed' };
    holdThrows?: boolean;
    maxPledge?: number;
  }) {
    const prisma: Record<string, unknown> = {
      notification: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      project: {
        findUnique: jest.fn().mockResolvedValue(opts.project === undefined ? liveProject() : opts.project),
        update: jest.fn().mockResolvedValue({ raisedHalalas: 60_000n, backersCount: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ raisedHalalas: 60_000n, backersCount: 1 }),
      },
      rewardTier: {
        findUnique: jest.fn().mockResolvedValue(opts.tierRow === undefined ? tier() : opts.tierRow),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      addOn: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      pledge: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'pl-1', paymentRef: 'pay_ok', status: 'HELD' }),
        count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _max: { backerNo: 4 } }),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'pl-1', ...data })),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'pl-1', ...data })),
      },
      user: {
        update: jest.fn().mockResolvedValue({}),
        // STAKES/S-3/A6 — backer must be Nafath-verified to pledge.
        findUnique: jest.fn().mockResolvedValue({ id: BACKER, email: 'backer@test.sa', nafathVerified: true }),
      },
    };
    (prisma as { $transaction?: unknown }).$transaction = jest.fn(
      async (fn: (tx: unknown) => unknown) => fn(prisma),
    );
    const escrow = {
      hold: opts.holdThrows
        ? jest.fn().mockRejectedValue(new Error('psp down'))
        : jest.fn().mockImplementation(async (req: { givenId: string; amountHalalas: bigint }) => ({ paymentRef: req.givenId, status: opts.holdResult?.status ?? 'authorized', raw: { id: req.givenId, status: opts.holdResult?.status ?? 'authorized', amount: Number(req.amountHalalas), currency: 'SAR', captured: 0, refunded: 0 } })),
      recordInitialAuthorization: jest.fn().mockResolvedValue(undefined),
      captureAllHeld: jest.fn(),
      refundAllHeld: jest.fn(),
    };
    const contracts = { inferType: jest.fn().mockReturnValue('DONATION') };
    const gateway = { emitTick: jest.fn() };
    const community = { materializeFromPledge: jest.fn().mockResolvedValue(undefined) };
    const ledger = { record: jest.fn().mockResolvedValue(undefined) };
    const email = { pledgeReceipt: jest.fn().mockResolvedValue({}), projectFunded: jest.fn(), projectFailed: jest.fn() };
    const notifications = { create: jest.fn().mockResolvedValue({}) };
    const pledgeSettings = opts.maxPledge === undefined ? settingsStub() : { get: jest.fn(async (key: string) =>
      key === 'pledges.maxHalalas' ? opts.maxPledge : ({ 'pledges.minHalalas': 1000, 'payments.methodsEnabled': { card: true, bnpl: true } } as Record<string, unknown>)[key]) };
    const svc = new FundingService(
      prisma as never, escrow as never, contracts as never,
      gateway as never, community as never, ledger as never,
      { log: jest.fn() } as never,
      email as never, notifications as never,
      { assertHuman: jest.fn().mockResolvedValue(undefined) } as never,
      pledgeSettings as never,
    );
    type MockedTables = {
      notification: { createMany: jest.Mock };
      project: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
      rewardTier: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
      pledge: { aggregate: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
      user: { update: jest.Mock };
    };
    return { svc, prisma: prisma as never as MockedTables, escrow, gateway, ledger, email, notifications };
  }

  it('STAKES/A6 — rejects an unverified backer (403) before charging', async () => {
    const { svc, prisma, escrow } = build({});
    (prisma.user as unknown as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
      id: BACKER, email: 'b@test.sa', nafathVerified: false,
    });
    await expect(svc.pledge(BACKER, dto())).rejects.toThrow(/نفاذ|KYC/);
    expect(escrow.hold).not.toHaveBeenCalled();
  });

  it('STAKES/F2 — fires a pledge-receipt email + notification on success', async () => {
    const { svc, email, notifications, prisma } = build({});
    await svc.pledge(BACKER, dto());
    expect(email.pledgeReceipt).toHaveBeenCalledWith('backer@test.sa', expect.objectContaining({ projectTitle: expect.any(String) }));
    expect(prisma.notification.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ kind: 'PLEDGE_RECEIVED', dedupKey: 'pledge-receipt:pl-1' })] }));
    expect(notifications.create).not.toHaveBeenCalled();
  });

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

  it('keeps an ambiguous authorization uncounted and pending reconciliation', async () => {
    const { svc, prisma, ledger } = build({ holdThrows: true });
    await expect(svc.pledge(BACKER, dto())).rejects.toThrow(/تعذر التأكد/);
    expect(prisma.pledge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorizationIssue: 'authorization-outcome-unknown' }) }),
    );
    expect(prisma.project.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(ledger.record).not.toHaveBeenCalled();
  });

  it('marks the pledge FAILED when the PSP declines the hold', async () => {
    const { svc, prisma } = build({ holdResult: { paymentRef: 'pay_declined', status: 'failed' } });
    await expect(svc.pledge(BACKER, dto())).rejects.toThrow(/not authorized/);
    expect(prisma.pledge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    expect(prisma.project.updateMany).not.toHaveBeenCalled();
  });

  it('holds tier + add-ons at the PSP (Sprint 2 undercharge regression)', async () => {
    const { svc, prisma, escrow } = build({});
    (prisma as unknown as { addOn: { findMany: jest.Mock } }).addOn.findMany.mockResolvedValue([
      { id: 'addon-1', projectId: PROJ, titleAr: 'إضافة', amountHalalas: 15_000n, limitQty: null, claimedQty: 0 },
    ]);
    await svc.pledge(BACKER, dto({ addOns: [{ addOnId: 'addon-1', qty: 2 }] }));
    // 60,000 tier + 2 × 15,000 add-on = 90,000 must be authorized
    expect(escrow.hold).toHaveBeenCalledWith(
      expect.objectContaining({ amountHalalas: 90_000n }),
    );
    expect(escrow.recordInitialAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({ amountHalalas: 60_000n, addOnsHalalas: 30_000n }),
    );
  });

  it('applies the configured pledge cap to the full contribution including add-ons', async () => {
    const { svc, prisma, escrow } = build({ maxPledge: 70000 });
    (prisma as unknown as { addOn: { findMany: jest.Mock } }).addOn.findMany.mockResolvedValue([
      { id: 'addon-1', projectId: PROJ, titleAr: 'إضافة', amountHalalas: 15000n, limitQty: null, claimedQty: 0 },
    ]);
    await expect(svc.pledge(BACKER, dto({ addOns: [{ addOnId: 'addon-1', qty: 1 }] }))).rejects.toThrow(/الإضافات/);
    expect(escrow.hold).not.toHaveBeenCalled();
    expect(prisma.pledge.create).not.toHaveBeenCalled();
  });

  it('does not accept duplicate add-on lines that could bypass stock validation', async () => {
    const { svc, escrow } = build({});
    await expect(svc.pledge(BACKER, dto({ addOns: [{ addOnId: 'addon-1', qty: 1 }, { addOnId: 'addon-1', qty: 1 }] }))).rejects.toThrow(/تكرار/);
    expect(escrow.hold).not.toHaveBeenCalled();
  });

  it('rejects an unsafe total before converting to the payment provider number format', async () => {
    const { svc, prisma, escrow } = build({});
    (prisma as unknown as { addOn: { findMany: jest.Mock } }).addOn.findMany.mockResolvedValue([
      { id: 'addon-1', projectId: PROJ, titleAr: 'إضافة', amountHalalas: BigInt(Number.MAX_SAFE_INTEGER), limitQty: null, claimedQty: 0 },
    ]);
    await expect(svc.pledge(BACKER, dto({ addOns: [{ addOnId: 'addon-1', qty: 1 }] }))).rejects.toThrow(/الدقة المالية/);
    expect(escrow.hold).not.toHaveBeenCalled();
  });

  it('happy path: HELD pledge + atomic counters + ledger + live tick', async () => {
    const { svc, prisma, gateway, escrow } = build({});
    const out = (await svc.pledge(BACKER, dto())) as unknown as { paymentRef: string };
    expect(out.paymentRef).toBe('pay_ok');
    // Pending authorization is excluded from settlement until finalization.
    expect(prisma.pledge.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING_AUTH', backerNo: 5 }) }),
    );
    // counters bumped in the tx
    expect(prisma.project.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          raisedHalalas: { increment: 60_000n },
          backersCount: { increment: 1 },
        }),
      }),
    );
    expect(prisma.rewardTier.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { claimedQty: { increment: 1 } } }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { totalPledgedHalalas: { increment: 60_000n } },
      }),
    );
    // money journal + realtime tick
    expect(escrow.recordInitialAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({ paymentRef: expect.stringMatching(/^[0-9a-f-]{36}$/) }),
    );
    expect(gateway.emitTick).toHaveBeenCalled();
  });
});

describe('FundingService.cancelCampaign (Sprint 3 / P1-209)', () => {
  function build(status: ProjectStatus, createdById = 'creator-1') {
    const prisma: Record<string, unknown> = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1', status, createdById, titleAr: 'مشروع', raisedHalalas: 0n, backersCount: 0,
        }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn().mockResolvedValue({}),
      },
      pledge: { count: jest.fn().mockResolvedValue(0) },
    };
    const escrow = {
      refundAllHeld: jest.fn().mockResolvedValue({ refunded: 0, failed: 0 }),
      captureAllHeld: jest.fn(),
      hold: jest.fn(),
    };
    const svc = new FundingService(
      prisma as never,
      escrow as never,
      {} as never,
      { emitTick: jest.fn() } as never,
      { materializeFromPledge: jest.fn() } as never,
      { record: jest.fn() } as never,
      { log: jest.fn() } as never,
      { projectFunded: jest.fn(), projectFailed: jest.fn() } as never,
      { create: jest.fn() } as never,
      { assertHuman: jest.fn().mockResolvedValue(undefined) } as never,
      settingsStub(),
    );
    return { svc, prisma: prisma as never as Record<string, Record<string, jest.Mock>>, escrow };
  }

  it('DRAFT → hard delete', async () => {
    const { svc, prisma } = build(ProjectStatus.DRAFT);
    const r = await svc.cancelCampaign('creator-1', 'p1');
    expect(r.outcome).toBe('deleted');
    expect(prisma.project!.delete).toHaveBeenCalled();
  });

  it('UNDER_REVIEW → withdrawn back to DRAFT', async () => {
    const { svc, prisma } = build(ProjectStatus.UNDER_REVIEW);
    const r = await svc.cancelCampaign('creator-1', 'p1');
    expect(r.outcome).toBe('withdrawn');
    expect(prisma.project!.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: ProjectStatus.DRAFT, scheduledLaunchAt: null } }),
    );
  });

  it('LIVE → refunds every hold and lands on REFUNDED', async () => {
    const { svc, prisma, escrow } = build(ProjectStatus.LIVE);
    const r = await svc.cancelCampaign('creator-1', 'p1');
    expect(r.outcome).toBe('refunded');
    expect(escrow.refundAllHeld).toHaveBeenCalledWith('p1');
    expect(prisma.project!.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ raisedHalalas: 0n, realizedHalalas: 0n, backersCount: 0,
          pledges: { none: { status: { not: 'REFUNDED' } } } }),
        data: { status: ProjectStatus.REFUNDED },
      }),
    );
  });

  it('LIVE cancel racing a settle claim → 400, nothing refunded', async () => {
    const { svc, prisma, escrow } = build(ProjectStatus.LIVE);
    prisma.project!.updateMany!.mockResolvedValue({ count: 0 });
    await expect(svc.cancelCampaign('creator-1', 'p1')).rejects.toThrow(/being settled/);
    expect(escrow.refundAllHeld).not.toHaveBeenCalled();
  });

  it('FUNDED → 400 (settled money cannot be creator-cancelled)', async () => {
    const { svc } = build(ProjectStatus.FUNDED);
    await expect(svc.cancelCampaign('creator-1', 'p1')).rejects.toThrow(/cannot cancel/);
  });

  it('non-owner → 403', async () => {
    const { svc } = build(ProjectStatus.LIVE);
    await expect(svc.cancelCampaign('intruder', 'p1')).rejects.toThrow(/not your project/);
  });
});

/**
 * OPS-GAPS Y2 — the cumulative pause cap follows funding.pauseCapDays
 * (default 7). Default keeps the 7-day behaviour; a lower value tightens it.
 */
describe('FundingService.pauseCampaign — funding.pauseCapDays wiring', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  const buildWith = (capDays: number, pausedMsAccrued: bigint) => {
    const project = {
      id: 'p1',
      createdById: 'creator-1',
      status: ProjectStatus.LIVE,
      deadline: new Date(Date.now() + 10 * DAY_MS),
      pausedMsAccrued,
    };
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue(project),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;
    const settings = {
      get: jest.fn(async (key: string) => (key === 'funding.pauseCapDays' ? capDays : undefined)),
      invalidate: jest.fn(),
    } as never;
    const svc = new FundingService(
      prisma, {} as EscrowService, {} as ContractsService, {} as never, {} as never,
      { record: jest.fn() } as never, { log: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never, { create: jest.fn() } as never,
      { assertHuman: jest.fn().mockResolvedValue(undefined) } as never, settings,
    );
    return { svc };
  };

  it('default 7 days: a project with 3 days paused can still pause; capMs reflects 7 days', async () => {
    const { svc } = buildWith(7, BigInt(3 * DAY_MS));
    const res = await svc.pauseCampaign('creator-1', 'p1');
    expect(res.capMs).toBe(7 * DAY_MS);
  });

  it('non-default 2-day cap: 3 days already paused → rejected (behaviour changed)', async () => {
    const { svc } = buildWith(2, BigInt(3 * DAY_MS));
    await expect(svc.pauseCampaign('creator-1', 'p1')).rejects.toThrow(/2 days/);
  });
});
