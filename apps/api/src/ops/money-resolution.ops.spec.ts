import { PledgeStatus } from '@prisma/client';

import { OperationsRegistry } from './operations.registry';
import { moneyOps } from './operations/money.ops';
import type { OperationContext } from './operation.types';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Batch OPS-PRO Phase 1 — MONEY-RESOLUTION group guard tests. The real
 * moneyOps definitions run against a mocked prisma + mocked EscrowService /
 * FundingService / ZatcaService, so these assert the OP layer: every
 * precondition refusal, the dispute WON-vs-LOST preview split, the revive
 * tier-exhausted → FAILED surface, the ZATCA no-orphan refusal, and the
 * counter recompute's drift report + dryRun purity (no writes on preview).
 */

function model() {
  return {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: {} }),
    groupBy: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'exec-1', ...data })),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
  };
}

function buildPrisma(): any {
  const prisma: any = {
    project: model(), pledge: model(), payout: model(),
    rewardTier: model(), addOn: model(), pledgeAddOn: model(),
    user: model(), operationExecution: model(), auditLog: model(),
    operationProposal: model(),
  };
  prisma.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
  prisma.operationExecution.findUnique.mockResolvedValue(null);
  return prisma;
}

const asPrisma = (db: any): PrismaService => db as unknown as PrismaService;

function deps(prisma: any) {
  const escrow = {
    resolveDispute: jest.fn(),
    reviveFailedPledge: jest.fn(),
  };
  const funding = { resettleResidue: jest.fn() };
  const zatca = { generateForPayout: jest.fn() };
  return {
    all: {
      prisma: asPrisma(prisma),
      funding: funding as never,
      disburser: {} as never,
      escrow: escrow as never,
      moyasar: {} as never,
      zatca: zatca as never,
      notifications: { create: jest.fn().mockResolvedValue(null) } as never,
      email: { milestoneReleased: jest.fn().mockResolvedValue({}) } as never,
    },
    escrow,
    funding,
    zatca,
  };
}

function buildReg(prisma: any) {
  const d = deps(prisma);
  const reg = new OperationsRegistry(asPrisma(prisma));
  reg.permissionPort = { has: () => true };
  for (const op of moneyOps(d.all)) reg.register(op);
  return { reg, ...d };
}

const ctx = (over: Partial<OperationContext> = {}): OperationContext => ({
  actor: { id: 'admin-1', type: 'HUMAN', roles: ['ADMIN'], permissions: ['*'] },
  reason: 'سبب تشغيلي واضح ومكتوب بما يكفي',
  idempotencyKey: `k-${Math.random()}`,
  stepUpVerifiedAt: new Date(),
  ...over,
});

const PLEDGE = '11111111-1111-4111-8111-111111111111';
const PROJECT = '22222222-2222-4222-8222-222222222222';
const PAYOUT = '33333333-3333-4333-8333-333333333333';

function richPledge(over: any = {}): any {
  return {
    id: PLEDGE, projectId: 'proj-1', backerId: 'backer-1', tierId: 'tier-1',
    amountHalalas: 10_000n, addOnsHalalas: 2_000n, status: PledgeStatus.DISPUTED,
    paymentRef: 'ref-1', disputeOutcome: null,
    project: { titleAr: 'مشروع' },
    tier: { limitQty: 5, claimedQty: 2 },
    ...over,
  };
}

/* ── money.dispute.resolve ─────────────────────────────────────────────── */
describe('money.dispute.resolve', () => {
  it('refuses a missing pledge (pledge-missing)', async () => {
    const prisma = buildPrisma();
    prisma.pledge.findUnique.mockResolvedValue(null);
    const { reg } = buildReg(prisma);
    await expect(
      reg.execute('money.dispute.resolve', { pledgeId: PLEDGE, outcome: 'WON' }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'pledge-missing' }) });
  });

  it('refuses a non-disputed pledge (not-disputed)', async () => {
    const prisma = buildPrisma();
    prisma.pledge.findUnique.mockResolvedValue({ id: PLEDGE, status: PledgeStatus.CAPTURED });
    const { reg } = buildReg(prisma);
    await expect(
      reg.execute('money.dispute.resolve', { pledgeId: PLEDGE, outcome: 'LOST' }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'not-disputed' }) });
  });

  it('WON preview shows NO counter movement; execute delegates outcome WON', async () => {
    const prisma = buildPrisma();
    prisma.pledge.findUnique.mockResolvedValue(richPledge());
    const { reg, escrow } = buildReg(prisma);
    escrow.resolveDispute.mockResolvedValue({
      ok: true, outcome: 'WON', status: PledgeStatus.CAPTURED, amountHalalas: 12_000n,
    });

    const dry = await reg.dryRun('money.dispute.resolve', { pledgeId: PLEDGE, outcome: 'WON' }, ctx());
    expect(dry.ok).toBe(true);
    expect(dry.preview!.monetaryDeltasHalalas).toMatchObject({ raisedDelta: '0', realizedDelta: '0' });

    const out = await reg.execute(
      'money.dispute.resolve',
      { pledgeId: PLEDGE, outcome: 'WON' },
      ctx(),
    );
    expect(escrow.resolveDispute).toHaveBeenCalledWith(PLEDGE, 'WON');
    expect(out.result).toMatchObject({ outcome: 'WON', status: 'CAPTURED', amountHalalas: '12000' });
  });

  it('LOST preview shows the raised+realized decrements; execute delegates outcome LOST', async () => {
    const prisma = buildPrisma();
    prisma.pledge.findUnique.mockResolvedValue(richPledge());
    const { reg, escrow } = buildReg(prisma);
    escrow.resolveDispute.mockResolvedValue({
      ok: true, outcome: 'LOST', status: PledgeStatus.REFUNDED, amountHalalas: 12_000n,
    });

    const dry = await reg.dryRun('money.dispute.resolve', { pledgeId: PLEDGE, outcome: 'LOST' }, ctx());
    expect(dry.preview!.monetaryDeltasHalalas).toMatchObject({
      raisedDelta: '-12000', realizedDelta: '-12000', refundToBacker: '12000',
    });
    expect(dry.preview!.counts).toMatchObject({ tierStockReleased: 1, backersCountDecrement: 1 });

    const out = await reg.execute(
      'money.dispute.resolve',
      { pledgeId: PLEDGE, outcome: 'LOST' },
      ctx(),
    );
    expect(escrow.resolveDispute).toHaveBeenCalledWith(PLEDGE, 'LOST');
    expect(out.result).toMatchObject({ outcome: 'LOST', status: 'REFUNDED' });
  });
});

/* ── money.pledge.revive ───────────────────────────────────────────────── */
describe('money.pledge.revive', () => {
  it('refuses a pledge that is not FAILED_CAPTURE (not-failed-capture)', async () => {
    const prisma = buildPrisma();
    prisma.pledge.findUnique.mockResolvedValue({ id: PLEDGE, status: PledgeStatus.HELD });
    const { reg } = buildReg(prisma);
    await expect(
      reg.execute('money.pledge.revive', { pledgeId: PLEDGE }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'not-failed-capture' }) });
  });

  it('tier-stock-exhausted → BadRequest, execution recorded FAILED', async () => {
    const prisma = buildPrisma();
    prisma.pledge.findUnique.mockResolvedValue(
      richPledge({ status: PledgeStatus.FAILED_CAPTURE, tier: { limitQty: 5, claimedQty: 5 } }),
    );
    const { reg, escrow } = buildReg(prisma);
    escrow.reviveFailedPledge.mockResolvedValue({
      ok: false, reason: 'tier-stock-exhausted', status: PledgeStatus.FAILED_CAPTURE,
    });
    await expect(
      reg.execute('money.pledge.revive', { pledgeId: PLEDGE }, ctx()),
    ).rejects.toThrow(/مخزون المكافأة نافد/);
    // Orchestrated claim lands FAILED, never a silent no-op.
    expect(prisma.operationExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('ok path returns the CAPTURED status', async () => {
    const prisma = buildPrisma();
    prisma.pledge.findUnique.mockResolvedValue(richPledge({ status: PledgeStatus.FAILED_CAPTURE }));
    const { reg, escrow } = buildReg(prisma);
    escrow.reviveFailedPledge.mockResolvedValue({ ok: true, status: PledgeStatus.CAPTURED });
    const out = await reg.execute('money.pledge.revive', { pledgeId: PLEDGE }, ctx());
    expect(escrow.reviveFailedPledge).toHaveBeenCalledWith(PLEDGE);
    expect(out.result).toMatchObject({ ok: true, status: 'CAPTURED' });
  });
});

/* ── money.settle.residue ──────────────────────────────────────────────── */
describe('money.settle.residue', () => {
  it('refuses a not-yet-settled project (not-settled)', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT, status: 'LIVE' });
    const { reg } = buildReg(prisma);
    await expect(
      reg.execute('money.settle.residue', { projectId: PROJECT }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'not-settled' }) });
  });

  it('FUNDED → capture direction preview; execute delegates to resettleResidue', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT, status: 'FUNDED', titleAr: 'مشروع' });
    prisma.pledge.count.mockResolvedValue(3);
    const { reg, funding } = buildReg(prisma);
    funding.resettleResidue.mockResolvedValue({ projectId: 'proj-1', swept: { ok: 3, failed: 0 } });

    const dry = await reg.dryRun('money.settle.residue', { projectId: PROJECT }, ctx());
    expect(dry.preview!.counts).toMatchObject({ residue: 3, direction: 1 });

    const out = await reg.execute('money.settle.residue', { projectId: PROJECT }, ctx());
    expect(funding.resettleResidue).toHaveBeenCalledWith(PROJECT);
    expect(out.result).toMatchObject({ swept: { ok: 3, failed: 0 } });
  });
});

/* ── money.counters.recompute ──────────────────────────────────────────── */
describe('money.counters.recompute', () => {
  /** Wires a project whose stored counters all drift from the ledger truth. */
  function withDrift(prisma: any) {
    prisma.project.findUnique.mockResolvedValue({
      id: PROJECT, raisedHalalas: 100n, realizedHalalas: 40n, backersCount: 3,
    });
    prisma.pledge.aggregate.mockImplementation(({ where }: any) =>
      Promise.resolve(
        where.status === PledgeStatus.CAPTURED
          ? { _sum: { amountHalalas: 50n, addOnsHalalas: 0n } } // realized 40 → 50
          : { _sum: { amountHalalas: 120n, addOnsHalalas: 0n } }, // raised 100 → 120
      ),
    );
    prisma.pledge.findMany.mockResolvedValue([{ backerId: 'b1' }, { backerId: 'b2' }]); // 3 → 2
    prisma.pledge.groupBy.mockResolvedValue([{ tierId: 't1', _count: 3 }]); // tier 5 → 3
    prisma.rewardTier.findMany.mockResolvedValue([{ id: 't1', claimedQty: 5 }]);
    prisma.addOn.findMany.mockResolvedValue([{ id: 'a1', claimedQty: 2 }]);
    prisma.pledgeAddOn.groupBy.mockResolvedValue([{ addOnId: 'a1', _sum: { qty: 2 } }]); // no drift
  }

  it('refuses a missing project (project-missing)', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue(null);
    const { reg } = buildReg(prisma);
    await expect(
      reg.execute('money.counters.recompute', { projectId: PROJECT }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'project-missing' }) });
  });

  it('dryRun detects drift and writes NOTHING (purity)', async () => {
    const prisma = buildPrisma();
    withDrift(prisma);
    const { reg } = buildReg(prisma);

    const dry = await reg.dryRun('money.counters.recompute', { projectId: PROJECT }, ctx());
    expect(dry.ok).toBe(true);
    expect(dry.preview!.counts).toMatchObject({ driftedFields: 4 });
    expect(dry.preview!.after).toMatchObject({ raisedHalalas: '120', realizedHalalas: '50', backersCount: '2' });
    // dryRun purity — no counter was corrected.
    expect(prisma.project.update).not.toHaveBeenCalled();
    expect(prisma.rewardTier.update).not.toHaveBeenCalled();
    expect(prisma.addOn.update).not.toHaveBeenCalled();
  });

  it('execute corrects ONLY the drifted counters', async () => {
    const prisma = buildPrisma();
    withDrift(prisma);
    const { reg } = buildReg(prisma);

    const out = await reg.execute('money.counters.recompute', { projectId: PROJECT }, ctx());
    expect((out.result as any).corrected).toBe(4);
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: PROJECT },
      data: { raisedHalalas: 120n, realizedHalalas: 50n, backersCount: 2 },
    });
    expect(prisma.rewardTier.update).toHaveBeenCalledWith({
      where: { id: 't1' }, data: { claimedQty: 3 },
    });
    expect(prisma.addOn.update).not.toHaveBeenCalled(); // add-on was already correct
  });
});

/* ── money.zatca.retry ─────────────────────────────────────────────────── */
describe('money.zatca.retry', () => {
  it('refuses a missing payout (payout-missing)', async () => {
    const prisma = buildPrisma();
    prisma.payout.findUnique.mockResolvedValue(null);
    const { reg } = buildReg(prisma);
    await expect(
      reg.execute('money.zatca.retry', { payoutId: PAYOUT }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'payout-missing' }) });
  });

  it('refuses a payout that already has an invoice (no-orphan)', async () => {
    const prisma = buildPrisma();
    prisma.payout.findUnique.mockResolvedValue({
      id: PAYOUT, status: 'SENT', zatcaInvoiceId: 'WTB-2026-000001',
    });
    const { reg } = buildReg(prisma);
    await expect(
      reg.execute('money.zatca.retry', { payoutId: PAYOUT }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'no-orphan' }) });
  });

  it('refuses a non-SENT payout (no-orphan)', async () => {
    const prisma = buildPrisma();
    prisma.payout.findUnique.mockResolvedValue({ id: PAYOUT, status: 'PENDING', zatcaInvoiceId: null });
    const { reg } = buildReg(prisma);
    await expect(
      reg.execute('money.zatca.retry', { payoutId: PAYOUT }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'no-orphan' }) });
  });

  it('orphan SENT payout: execute regenerates the invoice (idempotent)', async () => {
    const prisma = buildPrisma();
    const payout = { id: PAYOUT, status: 'SENT', zatcaInvoiceId: null, amountHalalas: 500_000n, creatorId: 'c1', milestoneId: 'm1' };
    prisma.payout.findUnique.mockResolvedValue(payout);
    prisma.payout.findUniqueOrThrow.mockResolvedValue(payout);
    const { reg, zatca } = buildReg(prisma);
    zatca.generateForPayout.mockResolvedValue({ invoiceNumber: 'WTB-2026-000009', totalHalalas: 28_750n });

    const out = await reg.execute('money.zatca.retry', { payoutId: PAYOUT }, ctx());
    expect(zatca.generateForPayout).toHaveBeenCalledWith(payout);
    expect(out.result).toMatchObject({ invoiceNumber: 'WTB-2026-000009', totalHalalas: '28750' });
  });
});
