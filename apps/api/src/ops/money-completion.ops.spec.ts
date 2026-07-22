/* eslint-disable @typescript-eslint/no-explicit-any */
import { OperationsRegistry } from './operations.registry';
import { moneyOps } from './operations/money.ops';
import type { OperationContext } from './operation.types';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Batch OPS (registry completion) — the MONEY-group additions:
 *   money.refund.pledge / money.refund.project / money.capture.retry-cohort /
 *   money.payout.retry / money.reconcile.run.
 *
 * The real moneyOps definitions run against a mocked prisma + mocked
 * EscrowService/MoyasarAdapter deps: every precondition refusal carries its
 * kebab-case code, dryRun previews the blast radius without writing, and
 * execute delegates with exactly the right arguments (a PSP refusal surfaces
 * as a FAILED orchestrated execution, never a silent no-op).
 */

type Mock = jest.Mock;
interface MockModel {
  findUnique: Mock; findUniqueOrThrow: Mock; findFirst: Mock; findFirstOrThrow: Mock;
  findMany: Mock; count: Mock; aggregate: Mock; groupBy: Mock;
  create: Mock; update: Mock; updateMany: Mock;
  delete: Mock; deleteMany: Mock; upsert: Mock;
}

interface MockDb {
  project: MockModel; milestone: MockModel; payout: MockModel; pledge: MockModel;
  user: MockModel; reconciliationRun: MockModel;
  operationExecution: MockModel; auditLog: MockModel; operationProposal: MockModel;
  $transaction: Mock;
}

function buildPrisma(): MockDb {
  const model = (): MockModel => ({
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: {} }),
    groupBy: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'row-1', ...data })),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
  });
  const prisma: any = {
    project: model(), milestone: model(), payout: model(), pledge: model(),
    user: model(), reconciliationRun: model(),
    operationExecution: model(), auditLog: model(), operationProposal: model(),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

const asPrisma = (db: unknown): PrismaService => db as PrismaService;

const ctx = (over: Partial<OperationContext> = {}): OperationContext => ({
  actor: { id: 'admin-1', type: 'HUMAN', roles: ['OWNER'], permissions: ['*'] },
  reason: 'سبب اختباري كافٍ للطول',
  idempotencyKey: 'k1',
  stepUpVerifiedAt: new Date(),
  ...over,
});

function escrowMock(): any {
  return {
    adminRefundPledge: jest.fn(),
    adminRefundProject: jest.fn(),
    retryCaptureCohort: jest.fn(),
  };
}

function buildReg(prisma: any, escrow: any = escrowMock(), moyasar: any = { fetchPayment: jest.fn() }) {
  const reg = new OperationsRegistry(asPrisma(prisma));
  reg.permissionPort = { has: () => true };
  for (const op of moneyOps({
    prisma: asPrisma(prisma),
    funding: {} as never,
    disburser: {} as never,
    escrow,
    moyasar,
    notifications: { create: jest.fn().mockResolvedValue(null) } as never,
    email: { milestoneReleased: jest.fn().mockResolvedValue({}) } as never,
  }))
    reg.register(op);
  return { reg, escrow, moyasar };
}

const PLEDGE_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const PAYOUT_ID = '33333333-3333-4333-8333-333333333333';

const refundablePledge = (over: Record<string, unknown> = {}) => ({
  id: PLEDGE_ID,
  projectId: PROJECT_ID,
  backerId: 'backer-1',
  tierId: 'tier-1',
  status: 'CAPTURED',
  amountHalalas: 50_000n,
  addOnsHalalas: 0n,
  paymentRef: 'ref-1',
  project: { titleAr: 'مشروع' },
  ...over,
});

describe('money.refund.pledge', () => {
  it('refuses a missing pledge (pledge-missing)', async () => {
    const prisma = buildPrisma();
    prisma.pledge.findUnique.mockResolvedValue(null);
    const { reg } = buildReg(prisma);
    await expect(
      reg.execute('money.refund.pledge', { pledgeId: PLEDGE_ID }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'pledge-missing' }) });
  });

  it('refuses a FAILED_CAPTURE pledge (not-refundable)', async () => {
    const prisma = buildPrisma();
    prisma.pledge.findUnique.mockResolvedValue(refundablePledge({ status: 'FAILED_CAPTURE' }));
    const { reg } = buildReg(prisma);
    await expect(
      reg.execute('money.refund.pledge', { pledgeId: PLEDGE_ID }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'not-refundable' }) });
  });

  it('refuses a CAPTURED refund not covered by unreleased realized funds (funds-already-released)', async () => {
    const prisma = buildPrisma();
    // Pledge of 50k; project realized 100k but a released milestone already
    // paid out 60k → only 40k unreleased < 50k.
    prisma.pledge.findUnique.mockResolvedValue(refundablePledge());
    prisma.project.findUnique.mockResolvedValue({ realizedHalalas: 100_000n });
    prisma.milestone.aggregate.mockResolvedValue({ _sum: { releasedHalalas: 60_000n } });
    const { reg } = buildReg(prisma);
    await expect(
      reg.execute('money.refund.pledge', { pledgeId: PLEDGE_ID }, ctx()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'funds-already-released' }),
    });
  });

  it('the released-funds guard never blocks a HELD void (no realized draw)', async () => {
    const prisma = buildPrisma();
    prisma.pledge.findUnique.mockResolvedValue(refundablePledge({ status: 'HELD' }));
    prisma.project.findUnique.mockResolvedValue({ realizedHalalas: 0n });
    prisma.milestone.aggregate.mockResolvedValue({ _sum: { releasedHalalas: 0n } });
    const { reg, escrow } = buildReg(prisma);
    escrow.adminRefundPledge.mockResolvedValue({ ok: true, mode: 'void', amountHalalas: 50_000n });
    const out = await reg.execute('money.refund.pledge', { pledgeId: PLEDGE_ID }, ctx());
    expect(out.result).toEqual({ ok: true, mode: 'void', amountHalalas: '50000' });
  });

  it('dryRun previews mode + the full counter blast-radius without writing', async () => {
    const prisma = buildPrisma();
    prisma.pledge.findUnique.mockResolvedValue(refundablePledge());
    prisma.pledge.count.mockResolvedValue(0); // last active pledge → backersCount drops
    prisma.project.findUnique.mockResolvedValue({ realizedHalalas: 100_000n });
    prisma.milestone.aggregate.mockResolvedValue({ _sum: { releasedHalalas: 0n } });
    const { reg } = buildReg(prisma);
    const dry = await reg.dryRun('money.refund.pledge', { pledgeId: PLEDGE_ID }, ctx());
    expect(dry.ok).toBe(true);
    expect(dry.preview).toMatchObject({
      before: { pledgeStatus: 'CAPTURED', mode: 'refund' },
      after: { pledgeStatus: 'REFUNDED', mode: 'refund' },
      counts: { tierStockReleased: 1, backersCountDecrement: 1 },
      monetaryDeltasHalalas: {
        refundToBacker: '50000',
        raisedDelta: '-50000',
        realizedDelta: '-50000',
        backerTotalPledgedDelta: '-50000',
      },
    });
    expect(prisma.pledge.update).not.toHaveBeenCalled();
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('executes by delegating to escrow.adminRefundPledge with the pledge id', async () => {
    const prisma = buildPrisma();
    prisma.pledge.findUnique.mockResolvedValue(refundablePledge());
    prisma.project.findUnique.mockResolvedValue({ realizedHalalas: 100_000n });
    prisma.milestone.aggregate.mockResolvedValue({ _sum: { releasedHalalas: 0n } });
    const { reg, escrow } = buildReg(prisma);
    escrow.adminRefundPledge.mockResolvedValue({
      ok: true, mode: 'refund', amountHalalas: 50_000n,
    });
    const out = await reg.execute('money.refund.pledge', { pledgeId: PLEDGE_ID }, ctx());
    expect(escrow.adminRefundPledge).toHaveBeenCalledWith(PLEDGE_ID);
    expect(out.result).toEqual({ ok: true, mode: 'refund', amountHalalas: '50000' });
  });

  it('surfaces ok:false from the escrow routine as a FAILED orchestrated execution', async () => {
    const prisma = buildPrisma();
    prisma.pledge.findUnique.mockResolvedValue(refundablePledge());
    prisma.project.findUnique.mockResolvedValue({ realizedHalalas: 100_000n });
    prisma.milestone.aggregate.mockResolvedValue({ _sum: { releasedHalalas: 0n } });
    const { reg, escrow } = buildReg(prisma);
    escrow.adminRefundPledge.mockResolvedValue({
      ok: false, mode: 'refund', amountHalalas: 50_000n, failureReason: 'psp-refund-declined',
    });
    await expect(
      reg.execute('money.refund.pledge', { pledgeId: PLEDGE_ID }, ctx()),
    ).rejects.toThrow(/psp-refund-declined/);
    // Orchestrated claim recorded the failure.
    expect(prisma.operationExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });
});

describe('money.refund.project', () => {
  it('refuses a project with no refundable pledge (nothing-to-refund)', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID });
    prisma.pledge.count.mockResolvedValue(0);
    const { reg } = buildReg(prisma);
    await expect(
      reg.execute('money.refund.project', { projectId: PROJECT_ID }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'nothing-to-refund' }) });
  });

  it('refuses when the aggregated CAPTURED total exceeds unreleased realized (funds-already-released)', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID, realizedHalalas: 100_000n });
    prisma.pledge.count.mockResolvedValue(3);
    prisma.pledge.aggregate.mockResolvedValue({
      _sum: { amountHalalas: 80_000n, addOnsHalalas: 5_000n },
    });
    prisma.milestone.aggregate.mockResolvedValue({ _sum: { releasedHalalas: 30_000n } });
    // captured 85k > unreleased 70k
    const { reg } = buildReg(prisma);
    await expect(
      reg.execute('money.refund.project', { projectId: PROJECT_ID }, ctx()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'funds-already-released' }),
    });
  });

  it('dryRun shows the blast radius: per-status counts, gross total and the void/refund split', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID, titleAr: 'مشروع', realizedHalalas: 500_000n });
    prisma.pledge.count.mockResolvedValue(6);
    prisma.pledge.aggregate.mockResolvedValue({ _sum: { amountHalalas: 90_000n, addOnsHalalas: 0n } });
    prisma.milestone.aggregate.mockResolvedValue({ _sum: { releasedHalalas: 0n } });
    prisma.pledge.groupBy.mockResolvedValue([
      { status: 'HELD', _count: 3, _sum: { amountHalalas: 30_000n, addOnsHalalas: 1_000n } },
      { status: 'PENDING_REAUTH', _count: 1, _sum: { amountHalalas: 5_000n, addOnsHalalas: 0n } },
      { status: 'CAPTURED', _count: 2, _sum: { amountHalalas: 90_000n, addOnsHalalas: 0n } },
    ]);
    const { reg } = buildReg(prisma);
    const dry = await reg.dryRun('money.refund.project', { projectId: PROJECT_ID }, ctx());
    expect(dry.ok).toBe(true);
    expect(dry.preview).toMatchObject({
      counts: { held: 3, pendingReauth: 1, captured: 2, total: 6 },
      monetaryDeltasHalalas: {
        grossRefund: '126000',
        voidTotal: '36000',
        refundTotal: '90000',
      },
    });
  });

  it('executes by delegating to escrow.adminRefundProject and serializes the total', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID, realizedHalalas: 500_000n });
    prisma.pledge.count.mockResolvedValue(2);
    prisma.pledge.aggregate.mockResolvedValue({ _sum: { amountHalalas: 0n, addOnsHalalas: 0n } });
    prisma.milestone.aggregate.mockResolvedValue({ _sum: { releasedHalalas: 0n } });
    const { reg, escrow } = buildReg(prisma);
    escrow.adminRefundProject.mockResolvedValue({ refunded: 2, failed: 1, totalHalalas: 35_000n });
    const out = await reg.execute('money.refund.project', { projectId: PROJECT_ID }, ctx());
    expect(escrow.adminRefundProject).toHaveBeenCalledWith(PROJECT_ID);
    expect(out.result).toEqual({ refunded: 2, failed: 1, totalHalalas: '35000' });
  });
});

describe('money.capture.retry-cohort', () => {
  it('refuses an empty cohort (cohort-empty)', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID });
    prisma.pledge.count.mockResolvedValue(0);
    const { reg } = buildReg(prisma);
    await expect(
      reg.execute('money.capture.retry-cohort', { projectId: PROJECT_ID }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'cohort-empty' }) });
  });

  it('the cohort scope follows includeFailed (grace-only vs grace+failed)', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID });
    prisma.pledge.count.mockImplementation(({ where }: any) =>
      Promise.resolve(where.status.in.includes('FAILED_CAPTURE') ? 2 : 0),
    );
    const { reg, escrow } = buildReg(prisma);
    // Only FAILED_CAPTURE rows exist: without includeFailed the cohort is empty…
    await expect(
      reg.execute('money.capture.retry-cohort', { projectId: PROJECT_ID }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'cohort-empty' }) });
    // …and with it, the op proceeds.
    escrow.retryCaptureCohort.mockResolvedValue({ attempted: 2, captured: 1, stillFailed: 1 });
    const out = await reg.execute(
      'money.capture.retry-cohort',
      { projectId: PROJECT_ID, includeFailed: true },
      ctx({ idempotencyKey: 'k2' }),
    );
    expect(escrow.retryCaptureCohort).toHaveBeenCalledWith(PROJECT_ID, { includeFailed: true });
    expect(out.result).toEqual({ attempted: 2, captured: 1, stillFailed: 1 });
  });

  it('dryRun reports per-bucket counts + monetary totals; includeFailed defaults to false', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID });
    prisma.pledge.count.mockResolvedValue(3);
    prisma.pledge.groupBy.mockResolvedValue([
      { status: 'CAPTURE_GRACE', _count: 3, _sum: { amountHalalas: 12_000n, addOnsHalalas: 0n } },
      { status: 'FAILED_CAPTURE', _count: 2, _sum: { amountHalalas: 7_000n, addOnsHalalas: 500n } },
    ]);
    const { reg } = buildReg(prisma);
    const dry = await reg.dryRun('money.capture.retry-cohort', { projectId: PROJECT_ID }, ctx());
    expect(dry.ok).toBe(true);
    expect(dry.preview).toMatchObject({
      counts: { inGrace: 3, failed: 2 },
      monetaryDeltasHalalas: { inGraceHalalas: '12000', failedHalalas: '0' }, // failed excluded by default
    });
    const dryAll = await reg.dryRun(
      'money.capture.retry-cohort',
      { projectId: PROJECT_ID, includeFailed: true },
      ctx(),
    );
    expect(dryAll.preview!.monetaryDeltasHalalas).toMatchObject({ failedHalalas: '7500' });
  });

  it('executes with the default includeFailed=false', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID });
    prisma.pledge.count.mockResolvedValue(1);
    const { reg, escrow } = buildReg(prisma);
    escrow.retryCaptureCohort.mockResolvedValue({ attempted: 1, captured: 1, stillFailed: 0 });
    await reg.execute('money.capture.retry-cohort', { projectId: PROJECT_ID }, ctx());
    expect(escrow.retryCaptureCohort).toHaveBeenCalledWith(PROJECT_ID, { includeFailed: false });
  });
});

describe('money.payout.retry', () => {
  it('refuses a missing payout (payout-missing)', async () => {
    const prisma = buildPrisma();
    prisma.payout.findUnique.mockResolvedValue(null);
    const { reg } = buildReg(prisma);
    await expect(
      reg.execute('money.payout.retry', { payoutId: PAYOUT_ID }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'payout-missing' }) });
  });

  it('refuses a non-FAILED payout — a stuck SENDING row is manual investigation (not-failed)', async () => {
    const prisma = buildPrisma();
    for (const status of ['PENDING', 'SENDING', 'SENT']) {
      prisma.payout.findUnique.mockResolvedValue({ id: PAYOUT_ID, status, amountHalalas: 1n });
      const { reg } = buildReg(prisma);
      await expect(
        reg.execute('money.payout.retry', { payoutId: PAYOUT_ID }, ctx()),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'not-failed' }) });
    }
  });

  it('re-queues with EXACTLY status→PENDING + failureReason→null through the registry tx', async () => {
    const prisma = buildPrisma();
    prisma.payout.findUnique.mockResolvedValue({
      id: PAYOUT_ID, status: 'FAILED', amountHalalas: 40_000n, failureReason: 'payout failed: no funds',
    });
    prisma.payout.update.mockResolvedValue({
      id: PAYOUT_ID, status: 'PENDING', amountHalalas: 40_000n, failureReason: null,
    });
    const { reg } = buildReg(prisma);
    const out = await reg.execute('money.payout.retry', { payoutId: PAYOUT_ID }, ctx());
    expect(prisma.payout.update).toHaveBeenCalledWith({
      where: { id: PAYOUT_ID },
      data: { status: 'PENDING', failureReason: null },
    });
    expect(out.result).toEqual({ id: PAYOUT_ID, status: 'PENDING', amountHalalas: '40000' });
    // Transactional op: the mutation + execution + audit rode one $transaction.
    expect(prisma.operationExecution.create).toHaveBeenCalled();
  });

  it('dryRun shows before/after + the gross amount', async () => {
    const prisma = buildPrisma();
    prisma.payout.findUnique.mockResolvedValue({
      id: PAYOUT_ID, status: 'FAILED', amountHalalas: 40_000n, failureReason: 'iban rejected',
    });
    const { reg } = buildReg(prisma);
    const dry = await reg.dryRun('money.payout.retry', { payoutId: PAYOUT_ID }, ctx());
    expect(dry.preview).toMatchObject({
      before: { status: 'FAILED', failureReason: 'iban rejected' },
      after: { status: 'PENDING', failureReason: null },
      monetaryDeltasHalalas: { payoutRequeuedGross: '40000' },
    });
  });
});

describe('money.reconcile.run', () => {
  const rows = [
    { id: 'pl-a', status: 'CAPTURED', paymentRef: 'ref-a' },
    { id: 'pl-b', status: 'REFUNDED', paymentRef: 'ref-b' },
    { id: 'pl-c', status: 'HELD', paymentRef: 'ref-c' },
    { id: 'pl-d', status: 'CAPTURED', paymentRef: 'ref-d' },
    { id: 'pl-e', status: 'PENDING_REAUTH', paymentRef: 'ref-e' },
  ];

  it('maps FSM↔PSP truth: matched / mismatched / skipped (stub + fetch failure) and persists ONE run row', async () => {
    const prisma = buildPrisma();
    prisma.pledge.findMany.mockResolvedValue(rows);
    const moyasar = {
      fetchPayment: jest
        .fn()
        .mockResolvedValueOnce({ status: 'paid', amountHalalas: 1 })        // a CAPTURED↔paid → match
        .mockResolvedValueOnce({ status: 'voided', amountHalalas: 1 })      // b REFUNDED↔voided → match
        .mockResolvedValueOnce({ status: 'paid', amountHalalas: 1 })        // c HELD↔paid → MISMATCH
        .mockResolvedValueOnce({ status: null, amountHalalas: null })       // d stub → skipped, never matched
        .mockRejectedValueOnce(new Error('psp 500')),                        // e fetch throw → skipped
    };
    const { reg } = buildReg(prisma, escrowMock(), moyasar);
    const out = await reg.execute<any>('money.reconcile.run', {}, ctx());
    expect(out.result).toMatchObject({
      scanned: 5, matched: 2, mismatched: 1, skipped: 2, runId: 'row-1', truncated: false,
    });
    // The mismatch row shape the ops UI renders.
    expect(out.result.mismatches).toEqual([
      {
        pledgeId: 'pl-c',
        paymentRef: 'ref-c',
        ledgerSays: 'HELD',
        pspSays: 'paid',
        detailAr: expect.stringContaining('authorized'),
      },
    ]);
    expect(prisma.reconciliationRun.create).toHaveBeenCalledTimes(1);
    expect(prisma.reconciliationRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        windowDays: 7, scanned: 5, matched: 2, mismatched: 1, skipped: 2, source: 'moyasar',
        mismatches: [expect.objectContaining({ pledgeId: 'pl-c' })],
      }),
    });
  });

  it('applies the zod defaults (windowDays 7, limit 200) and scans newest first', async () => {
    const prisma = buildPrisma();
    prisma.pledge.findMany.mockResolvedValue([]);
    const { reg } = buildReg(prisma);
    await reg.execute('money.reconcile.run', {}, ctx());
    expect(prisma.pledge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 200,
        orderBy: { createdAt: 'desc' },
        where: expect.objectContaining({
          status: { in: ['CAPTURED', 'REFUNDED', 'HELD', 'PENDING_REAUTH'] },
        }),
      }),
    );
  });

  it('dryRun counts the would-be scan (capped at limit) and warns that stub mode yields skipped-not-matched', async () => {
    const prisma = buildPrisma();
    prisma.pledge.count.mockResolvedValue(450);
    const { reg } = buildReg(prisma);
    const dry = await reg.dryRun('money.reconcile.run', { windowDays: 30, limit: 100 }, ctx());
    expect(dry.ok).toBe(true);
    expect(dry.preview).toMatchObject({ counts: { candidates: 450, toScan: 100 } });
    expect(dry.preview!.summaryAr).toContain('SKIPPED');
    expect(prisma.reconciliationRun.create).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range window via zod', async () => {
    const prisma = buildPrisma();
    const { reg } = buildReg(prisma);
    await expect(
      reg.execute('money.reconcile.run', { windowDays: 365 }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ message: 'مدخلات غير صالحة' }) });
  });
});
