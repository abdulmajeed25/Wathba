/* eslint-disable @typescript-eslint/no-explicit-any */
import { PledgeStatus, Prisma } from '@prisma/client';
import { EscrowService } from './escrow.service';

function ledgerMock(): any {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

// Batch OPS (registry completion) — the admin refund notifies directly.
function notificationsMock(): any {
  return { create: jest.fn().mockResolvedValue(null) };
}
function emailMock(): any {
  return { refundCompleted: jest.fn().mockResolvedValue({}) };
}

function newSvc(prisma: any, moyasar: any, ledger: any = ledgerMock()): EscrowService {
  return new EscrowService(prisma, moyasar, ledger, notificationsMock(), emailMock());
}

/**
 * EscrowService.captureAllHeld / refundAllHeld — Tier 3.9 covers the
 * bounded-concurrency batch runner introduced in Tier 1.4.
 *
 *   - mixed-success batch returns ok + fail counts that match the input
 *   - a single PSP failure doesn't stop the next pledge in the same batch
 *   - 0 HELD pledges returns 0 + 0 (no crash on empty)
 *   - 50 pledges across 2 batches: confirms the slicing math
 *
 * The MoyasarAdapter is fully mocked; pledge.update is asserted to fire
 * only for the success cases.
 */

function pledge(id: string): any {
  return {
    id, projectId: 'p', backerId: 'b', tierId: 't', backerNo: 1,
    amountHalalas: BigInt(10000), addOnsHalalas: BigInt(0),
    contractType: 'DONATION', shipping: null, status: PledgeStatus.HELD,
    paymentRef: `ref-${id}`, createdAt: new Date(),
    capturedAt: null, refundedAt: null,
  };
}

function makePrisma(pledges: any[] = []): any {
  const prisma: any = {
    pledge: {
      findMany: jest.fn().mockResolvedValue(pledges),
      update: jest.fn().mockResolvedValue({}),
    },
    // Batch PAY — markCaptured maintains the REALIZED counter in a tx.
    project: { update: jest.fn().mockResolvedValue({}) },
  };
  prisma.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

describe('EscrowService.captureAllHeld', () => {
  it('returns 0/0 when there are no HELD pledges', async () => {
    const prisma = makePrisma([]);
    const moyasar = { capture: jest.fn(), void: jest.fn(), hold: jest.fn() } as any;
    const svc = newSvc(prisma, moyasar);
    const r = await svc.captureAllHeld('proj');
    expect(r).toEqual({ captured: 0, failed: 0 });
    expect(moyasar.capture).not.toHaveBeenCalled();
  });

  it('counts each pledge once + a single PSP failure does not stop the rest', async () => {
    const pledges = ['a', 'b', 'c', 'd'].map(pledge);
    const prisma = makePrisma(pledges);
    const moyasar = {
      capture: jest
        .fn()
        .mockResolvedValueOnce({ ok: true })   // a
        .mockResolvedValueOnce({ ok: false })  // b (PSP declined)
        .mockRejectedValueOnce(new Error('timeout')) // c (network)
        .mockResolvedValueOnce({ ok: true }),  // d
      void: jest.fn(),
      hold: jest.fn(),
    } as any;
    const svc = newSvc(prisma, moyasar);
    const r = await svc.captureAllHeld('proj');
    expect(r).toEqual({ captured: 2, failed: 2 });
    // Batch PAY — every pledge gets an update: 2 CAPTURED + 2 into
    // CAPTURE_GRACE (failed captures no longer stay silently HELD).
    expect(prisma.pledge.update).toHaveBeenCalledTimes(4);
    const graceCalls = (prisma.pledge.update as jest.Mock).mock.calls.filter(
      (c: any[]) => c[0].data.status === 'CAPTURE_GRACE',
    );
    expect(graceCalls).toHaveLength(2);
    expect(graceCalls[0][0].data.graceExpiresAt).toBeInstanceOf(Date);
  });

  it('runs in BATCH_CONCURRENCY-sized slices (50 pledges → 2 batches of 25)', async () => {
    const pledges = Array.from({ length: 50 }, (_, i) => pledge(`p${i}`));
    const prisma = makePrisma(pledges);
    const moyasar = {
      capture: jest.fn().mockResolvedValue({ ok: true }),
      void: jest.fn(), hold: jest.fn(),
    } as any;
    const svc = newSvc(prisma, moyasar);
    const r = await svc.captureAllHeld('proj');
    expect(r).toEqual({ captured: 50, failed: 0 });
    expect(moyasar.capture).toHaveBeenCalledTimes(50);
    expect(prisma.pledge.update).toHaveBeenCalledTimes(50);
  });
});

describe('EscrowService.refundAllHeld', () => {
  it('counts each pledge once + a single void failure does not stop the rest', async () => {
    const pledges = ['x', 'y', 'z'].map(pledge);
    const prisma = makePrisma(pledges);
    const moyasar = {
      capture: jest.fn(),
      void: jest
        .fn()
        .mockResolvedValueOnce({ ok: true })
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ ok: true }),
      hold: jest.fn(),
    } as any;
    const svc = newSvc(prisma, moyasar);
    const r = await svc.refundAllHeld('proj');
    expect(r).toEqual({ refunded: 2, failed: 1 });
    expect(prisma.pledge.update).toHaveBeenCalledTimes(2);
  });
});

/* ═══ Batch OPS (registry completion) — admin refund + retry cohort ═══ */

/** Richer prisma mock covering every table the admin routines compensate. */
function makeOpsPrisma(): any {
  const prisma: any = {
    pledge: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    project: { update: jest.fn().mockResolvedValue({}) },
    rewardTier: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: { update: jest.fn().mockResolvedValue({}) },
    ledgerEntry: { create: jest.fn().mockResolvedValue({}) },
    webhookEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  prisma.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

function adminPledge(over: any = {}): any {
  return {
    id: 'pl-1', projectId: 'proj-1', backerId: 'backer-1', tierId: 'tier-1',
    amountHalalas: 10_000n, addOnsHalalas: 2_000n, status: PledgeStatus.HELD,
    paymentRef: 'ref-pl-1', paymentMethod: 'CARD', captureAttempts: 1, backerNo: 7,
    createdAt: new Date(), capturedAt: null, refundedAt: null,
    ...over,
  };
}

/** Second findUnique inside notifyAdminRefund resolves backer + project. */
function stubNotifyLookup(prisma: any, p: any): void {
  prisma.pledge.findUnique
    .mockResolvedValueOnce(p) // adminRefundPledge load
    .mockResolvedValueOnce({
      backer: { id: p.backerId, email: 'backer@example.com' },
      project: { id: p.projectId, titleAr: 'مشروع' },
    });
}

function buildSvc(prisma: any, moyasar: any) {
  const ledger = ledgerMock();
  const notifications = notificationsMock();
  const email = emailMock();
  const svc = new EscrowService(prisma, moyasar, ledger, notifications, email);
  return { svc, ledger, notifications, email };
}

describe('EscrowService.adminRefundPledge', () => {
  it('HELD → VOID branch: PSP void, REFUNDED, ops-refund VOID ledger row, full counter compensation, backersCount drop on last pledge', async () => {
    const p = adminPledge(); // HELD, tier set
    const prisma = makeOpsPrisma();
    stubNotifyLookup(prisma, p);
    prisma.pledge.count.mockResolvedValue(0); // last active pledge
    const moyasar = { void: jest.fn().mockResolvedValue({ ok: true }), refund: jest.fn() } as any;
    const { svc, notifications, email } = buildSvc(prisma, moyasar);

    const r = await svc.adminRefundPledge('pl-1');

    expect(r).toEqual({ ok: true, mode: 'void', amountHalalas: 12_000n });
    expect(moyasar.void).toHaveBeenCalledWith('ref-pl-1');
    expect(moyasar.refund).not.toHaveBeenCalled();
    expect(prisma.pledge.update).toHaveBeenCalledWith({
      where: { id: 'pl-1' },
      data: expect.objectContaining({ status: PledgeStatus.REFUNDED }),
    });
    expect(prisma.ledgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entryType: 'VOID', amountHalalas: 12_000n, pspRef: 'ref-pl-1',
        pledgeId: 'pl-1', projectId: 'proj-1', source: 'ops-refund',
      }),
    });
    // Held money never entered REALIZED — the void must not touch it.
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      data: {
        raisedHalalas: { decrement: 12_000n },
        backersCount: { decrement: 1 },
      },
    });
    expect(prisma.rewardTier.updateMany).toHaveBeenCalledWith({
      where: { id: 'tier-1', claimedQty: { gt: 0 } },
      data: { claimedQty: { decrement: 1 } },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'backer-1' },
      data: { totalPledgedHalalas: { decrement: 12_000n } },
    });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'backer-1', kind: 'REFUND_COMPLETED' }),
    );
    expect(email.refundCompleted).toHaveBeenCalledWith(
      'backer@example.com',
      expect.objectContaining({ amountHalalas: 12_000 }),
    );
  });

  it('CAPTURED → REFUND branch (first refund() caller): REALIZED is decremented too; other active pledge keeps backersCount', async () => {
    const p = adminPledge({ status: PledgeStatus.CAPTURED, tierId: null });
    const prisma = makeOpsPrisma();
    stubNotifyLookup(prisma, p);
    prisma.pledge.count.mockResolvedValue(1); // backer still has another active pledge
    const moyasar = { void: jest.fn(), refund: jest.fn().mockResolvedValue({ ok: true }) } as any;
    const { svc } = buildSvc(prisma, moyasar);

    const r = await svc.adminRefundPledge('pl-1');

    expect(r).toEqual({ ok: true, mode: 'refund', amountHalalas: 12_000n });
    expect(moyasar.refund).toHaveBeenCalledWith('ref-pl-1');
    expect(moyasar.void).not.toHaveBeenCalled();
    expect(prisma.ledgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entryType: 'REFUND', source: 'ops-refund' }),
    });
    // The live correctness gap: captured refunds must leave REALIZED.
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      data: {
        raisedHalalas: { decrement: 12_000n },
        realizedHalalas: { decrement: 12_000n },
      },
    });
    expect(prisma.rewardTier.updateMany).not.toHaveBeenCalled(); // no tier
  });

  it('PENDING_REAUTH is voided like HELD', async () => {
    const p = adminPledge({ status: PledgeStatus.PENDING_REAUTH });
    const prisma = makeOpsPrisma();
    stubNotifyLookup(prisma, p);
    const moyasar = { void: jest.fn().mockResolvedValue({ ok: true }), refund: jest.fn() } as any;
    const { svc } = buildSvc(prisma, moyasar);
    const r = await svc.adminRefundPledge('pl-1');
    expect(r.ok).toBe(true);
    expect(r.mode).toBe('void');
    expect(moyasar.void).toHaveBeenCalledWith('ref-pl-1');
  });

  it('PSP refusal mutates NOTHING and reports the failure', async () => {
    const p = adminPledge({ status: PledgeStatus.CAPTURED });
    const prisma = makeOpsPrisma();
    prisma.pledge.findUnique.mockResolvedValue(p);
    const moyasar = { void: jest.fn(), refund: jest.fn().mockResolvedValue({ ok: false }) } as any;
    const { svc, notifications, email } = buildSvc(prisma, moyasar);

    const r = await svc.adminRefundPledge('pl-1');

    expect(r).toEqual({
      ok: false, mode: 'refund', amountHalalas: 12_000n, failureReason: 'psp-refund-declined',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.pledge.update).not.toHaveBeenCalled();
    expect(prisma.project.update).not.toHaveBeenCalled();
    expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
    expect(email.refundCompleted).not.toHaveBeenCalled();
  });

  it('refuses a terminal-state pledge (FAILED_CAPTURE) without any PSP call', async () => {
    const p = adminPledge({ status: PledgeStatus.FAILED_CAPTURE });
    const prisma = makeOpsPrisma();
    prisma.pledge.findUnique.mockResolvedValue(p);
    const moyasar = { void: jest.fn(), refund: jest.fn() } as any;
    const { svc } = buildSvc(prisma, moyasar);
    const r = await svc.adminRefundPledge('pl-1');
    expect(r.ok).toBe(false);
    expect(r.failureReason).toBe('not-refundable:FAILED_CAPTURE');
    expect(moyasar.void).not.toHaveBeenCalled();
    expect(moyasar.refund).not.toHaveBeenCalled();
  });

  it('a claimed dedupKey (P2002) silences the notify without failing the refund', async () => {
    const p = adminPledge();
    const prisma = makeOpsPrisma();
    prisma.pledge.findUnique.mockResolvedValue(p);
    const dup = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    });
    prisma.webhookEvent.create.mockRejectedValue(dup);
    const moyasar = { void: jest.fn().mockResolvedValue({ ok: true }), refund: jest.fn() } as any;
    const { svc, notifications, email } = buildSvc(prisma, moyasar);
    const r = await svc.adminRefundPledge('pl-1');
    expect(r.ok).toBe(true);
    expect(notifications.create).not.toHaveBeenCalled();
    expect(email.refundCompleted).not.toHaveBeenCalled();
  });
});

describe('EscrowService.adminRefundProject', () => {
  it('sweeps every refundable pledge with partial-failure isolation and aggregates totals', async () => {
    const prisma = makeOpsPrisma();
    prisma.pledge.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]);
    const moyasar = { void: jest.fn(), refund: jest.fn() } as any;
    const { svc } = buildSvc(prisma, moyasar);
    jest
      .spyOn(svc, 'adminRefundPledge')
      .mockResolvedValueOnce({ ok: true, mode: 'void', amountHalalas: 100n })
      .mockResolvedValueOnce({ ok: false, mode: 'refund', amountHalalas: 50n, failureReason: 'psp-refund-declined' })
      .mockRejectedValueOnce(new Error('network down')) // hard throw is isolated too
      .mockResolvedValueOnce({ ok: true, mode: 'refund', amountHalalas: 200n });

    const r = await svc.adminRefundProject('proj-1');

    expect(r).toEqual({ refunded: 2, failed: 2, totalHalalas: 300n });
    expect(svc.adminRefundPledge).toHaveBeenCalledTimes(4);
    expect(prisma.pledge.findMany).toHaveBeenCalledWith({
      where: {
        projectId: 'proj-1',
        status: { in: [PledgeStatus.HELD, PledgeStatus.PENDING_REAUTH, PledgeStatus.CAPTURED] },
      },
      select: { id: true },
    });
  });
});

describe('EscrowService.retryCaptureCohort', () => {
  it('CAPTURE_GRACE success lands on markCaptured (CAPTURED + REALIZED + CAPTURE ledger); FAILED_CAPTURE untouched without includeFailed', async () => {
    const p = adminPledge({ status: PledgeStatus.CAPTURE_GRACE });
    const prisma = makeOpsPrisma();
    prisma.pledge.findMany.mockResolvedValueOnce([p]);
    const moyasar = {
      capture: jest.fn().mockResolvedValue({ ok: true }),
      reauthorize: jest.fn(),
    } as any;
    const { svc, ledger } = buildSvc(prisma, moyasar);

    const r = await svc.retryCaptureCohort('proj-1', { includeFailed: false });

    expect(r).toEqual({ attempted: 1, captured: 1, stillFailed: 0 });
    expect(moyasar.capture).toHaveBeenCalledWith('ref-pl-1');
    expect(prisma.pledge.update).toHaveBeenCalledWith({
      where: { id: 'pl-1' },
      data: expect.objectContaining({ status: PledgeStatus.CAPTURED }),
    });
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      data: { realizedHalalas: { increment: 12_000n } },
    });
    expect(ledger.record).toHaveBeenCalledWith(
      expect.objectContaining({ entryType: 'CAPTURE', amountHalalas: 12_000n }),
    );
    // Scope respected: only the CAPTURE_GRACE query ran.
    expect(prisma.pledge.findMany).toHaveBeenCalledTimes(1);
    expect(moyasar.reauthorize).not.toHaveBeenCalled();
  });

  it('CAPTURE_GRACE failure bumps captureAttempts only', async () => {
    const p = adminPledge({ status: PledgeStatus.CAPTURE_GRACE });
    const prisma = makeOpsPrisma();
    prisma.pledge.findMany.mockResolvedValueOnce([p]);
    const moyasar = { capture: jest.fn().mockResolvedValue({ ok: false }) } as any;
    const { svc } = buildSvc(prisma, moyasar);

    const r = await svc.retryCaptureCohort('proj-1', { includeFailed: false });

    expect(r).toEqual({ attempted: 1, captured: 0, stillFailed: 1 });
    expect(prisma.pledge.update).toHaveBeenCalledWith({
      where: { id: 'pl-1' },
      data: { captureAttempts: { increment: 1 } },
    });
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('includeFailed: reauthorize→capture after an ATOMIC tier-stock re-claim (guarded by limitQty)', async () => {
    const p = adminPledge({ status: PledgeStatus.FAILED_CAPTURE });
    const prisma = makeOpsPrisma();
    prisma.pledge.findMany
      .mockResolvedValueOnce([]) // CAPTURE_GRACE bucket empty
      .mockResolvedValueOnce([p]); // FAILED_CAPTURE bucket
    prisma.rewardTier.findUnique.mockResolvedValue({ limitQty: 5 });
    prisma.rewardTier.updateMany.mockResolvedValue({ count: 1 }); // re-claim wins
    const moyasar = {
      capture: jest.fn().mockResolvedValue({ ok: true }),
      reauthorize: jest.fn().mockResolvedValue({ ok: true }),
    } as any;
    const { svc } = buildSvc(prisma, moyasar);

    const r = await svc.retryCaptureCohort('proj-1', { includeFailed: true });

    expect(r).toEqual({ attempted: 1, captured: 1, stillFailed: 0 });
    // Stock re-claimed BEFORE any PSP call, with the sold-out guard.
    expect(prisma.rewardTier.updateMany).toHaveBeenCalledWith({
      where: { id: 'tier-1', claimedQty: { lt: 5 } },
      data: { claimedQty: { increment: 1 } },
    });
    expect(moyasar.reauthorize).toHaveBeenCalledWith('ref-pl-1');
    expect(moyasar.capture).toHaveBeenCalledWith('ref-pl-1');
    expect(prisma.pledge.update).toHaveBeenCalledWith({
      where: { id: 'pl-1' },
      data: expect.objectContaining({ status: PledgeStatus.CAPTURED }),
    });
  });

  it('includeFailed: exhausted tier stock skips the pledge — NO PSP call, no rollback', async () => {
    const p = adminPledge({ status: PledgeStatus.FAILED_CAPTURE });
    const prisma = makeOpsPrisma();
    prisma.pledge.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([p]);
    prisma.rewardTier.findUnique.mockResolvedValue({ limitQty: 5 });
    prisma.rewardTier.updateMany.mockResolvedValue({ count: 0 }); // sold out
    const moyasar = { capture: jest.fn(), reauthorize: jest.fn() } as any;
    const { svc } = buildSvc(prisma, moyasar);

    const r = await svc.retryCaptureCohort('proj-1', { includeFailed: true });

    expect(r).toEqual({ attempted: 1, captured: 0, stillFailed: 1 });
    expect(moyasar.reauthorize).not.toHaveBeenCalled();
    expect(moyasar.capture).not.toHaveBeenCalled();
    // Exactly one updateMany (the failed claim) — never a rollback decrement.
    expect(prisma.rewardTier.updateMany).toHaveBeenCalledTimes(1);
  });

  it('includeFailed: PSP failure after the re-claim rolls the stock back', async () => {
    const p = adminPledge({ status: PledgeStatus.FAILED_CAPTURE });
    const prisma = makeOpsPrisma();
    prisma.pledge.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([p]);
    prisma.rewardTier.findUnique.mockResolvedValue({ limitQty: 5 });
    prisma.rewardTier.updateMany.mockResolvedValue({ count: 1 });
    const moyasar = {
      capture: jest.fn(),
      reauthorize: jest.fn().mockResolvedValue({ ok: false }), // issuer refuses
    } as any;
    const { svc } = buildSvc(prisma, moyasar);

    const r = await svc.retryCaptureCohort('proj-1', { includeFailed: true });

    expect(r).toEqual({ attempted: 1, captured: 0, stillFailed: 1 });
    expect(moyasar.capture).not.toHaveBeenCalled();
    // Claim then rollback, in that order.
    expect(prisma.rewardTier.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'tier-1', claimedQty: { lt: 5 } },
      data: { claimedQty: { increment: 1 } },
    });
    expect(prisma.rewardTier.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'tier-1', claimedQty: { gt: 0 } },
      data: { claimedQty: { decrement: 1 } },
    });
  });

  it('includeFailed: an unlimited tier (limitQty null) re-claims without a guard', async () => {
    const p = adminPledge({ status: PledgeStatus.FAILED_CAPTURE });
    const prisma = makeOpsPrisma();
    prisma.pledge.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([p]);
    prisma.rewardTier.findUnique.mockResolvedValue({ limitQty: null });
    const moyasar = {
      capture: jest.fn().mockResolvedValue({ ok: true }),
      reauthorize: jest.fn().mockResolvedValue({ ok: true }),
    } as any;
    const { svc } = buildSvc(prisma, moyasar);

    const r = await svc.retryCaptureCohort('proj-1', { includeFailed: true });

    expect(r).toEqual({ attempted: 1, captured: 1, stillFailed: 0 });
    expect(prisma.rewardTier.update).toHaveBeenCalledWith({
      where: { id: 'tier-1' },
      data: { claimedQty: { increment: 1 } },
    });
    expect(prisma.rewardTier.updateMany).not.toHaveBeenCalled();
  });
});

/* ═══ Batch OPS-PRO Phase 1 — dispute resolution + single-pledge revive ═══ */

describe('EscrowService.resolveDispute', () => {
  it('WON: DISPUTED→CAPTURED, dispute fields set, a positive DISPUTE ledger note, and NO counter change', async () => {
    const p = adminPledge({ status: PledgeStatus.DISPUTED });
    const prisma = makeOpsPrisma();
    prisma.pledge.findUniqueOrThrow = jest.fn().mockResolvedValue(p);
    const moyasar = { void: jest.fn(), refund: jest.fn(), capture: jest.fn() } as any;
    const { svc } = buildSvc(prisma, moyasar);

    const r = await svc.resolveDispute('pl-1', 'WON');

    expect(r).toEqual({
      ok: true,
      outcome: 'WON',
      status: PledgeStatus.CAPTURED,
      amountHalalas: 12_000n,
    });
    expect(prisma.pledge.update).toHaveBeenCalledWith({
      where: { id: 'pl-1' },
      data: expect.objectContaining({
        status: PledgeStatus.CAPTURED,
        disputeOutcome: 'WON',
        disputeResolvedAt: expect.any(Date),
      }),
    });
    expect(prisma.ledgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entryType: 'DISPUTE',
        amountHalalas: 12_000n,
        pspRef: 'ref-pl-1',
        source: 'dispute-won',
      }),
    });
    // Funds retained — the webhook never decremented, so WON must not either.
    expect(prisma.project.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.rewardTier.updateMany).not.toHaveBeenCalled();
    // Chargeback already moved money externally — never a PSP call.
    expect(moyasar.void).not.toHaveBeenCalled();
    expect(moyasar.refund).not.toHaveBeenCalled();
  });

  it('LOST: DISPUTED→REFUNDED with the SAME captured-branch compensation (raised + realized + backersCount + tier + totalPledged), NO PSP call', async () => {
    const p = adminPledge({ status: PledgeStatus.DISPUTED });
    const prisma = makeOpsPrisma();
    prisma.pledge.findUniqueOrThrow = jest.fn().mockResolvedValue(p);
    prisma.pledge.count.mockResolvedValue(0); // last active pledge → backersCount drops
    const moyasar = { void: jest.fn(), refund: jest.fn(), capture: jest.fn() } as any;
    const { svc } = buildSvc(prisma, moyasar);

    const r = await svc.resolveDispute('pl-1', 'LOST');

    expect(r).toEqual({
      ok: true,
      outcome: 'LOST',
      status: PledgeStatus.REFUNDED,
      amountHalalas: 12_000n,
    });
    expect(prisma.pledge.update).toHaveBeenCalledWith({
      where: { id: 'pl-1' },
      data: expect.objectContaining({
        status: PledgeStatus.REFUNDED,
        disputeOutcome: 'LOST',
        refundedAt: expect.any(Date),
      }),
    });
    expect(prisma.ledgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entryType: 'REFUND', source: 'dispute-lost' }),
    });
    // Captured money left externally: BOTH raised and realized decrement.
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      data: {
        raisedHalalas: { decrement: 12_000n },
        realizedHalalas: { decrement: 12_000n },
        backersCount: { decrement: 1 },
      },
    });
    expect(prisma.rewardTier.updateMany).toHaveBeenCalledWith({
      where: { id: 'tier-1', claimedQty: { gt: 0 } },
      data: { claimedQty: { decrement: 1 } },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'backer-1' },
      data: { totalPledgedHalalas: { decrement: 12_000n } },
    });
    expect(moyasar.void).not.toHaveBeenCalled();
    expect(moyasar.refund).not.toHaveBeenCalled();
  });

  it('LOST: backersCount is kept when the backer still holds another active pledge', async () => {
    const p = adminPledge({ status: PledgeStatus.DISPUTED, tierId: null });
    const prisma = makeOpsPrisma();
    prisma.pledge.findUniqueOrThrow = jest.fn().mockResolvedValue(p);
    prisma.pledge.count.mockResolvedValue(1); // another active pledge remains
    const moyasar = { void: jest.fn(), refund: jest.fn() } as any;
    const { svc } = buildSvc(prisma, moyasar);

    await svc.resolveDispute('pl-1', 'LOST');

    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      data: {
        raisedHalalas: { decrement: 12_000n },
        realizedHalalas: { decrement: 12_000n },
      },
    });
    expect(prisma.rewardTier.updateMany).not.toHaveBeenCalled(); // no tier
  });
});

describe('EscrowService.reviveFailedPledge', () => {
  it('ok path: atomic tier re-claim → reauthorize + capture → markCaptured (CAPTURED + REALIZED + CAPTURE ledger)', async () => {
    const p = adminPledge({ status: PledgeStatus.FAILED_CAPTURE });
    const prisma = makeOpsPrisma();
    prisma.pledge.findUniqueOrThrow = jest.fn().mockResolvedValue(p);
    prisma.rewardTier.findUnique.mockResolvedValue({ limitQty: 5 });
    prisma.rewardTier.updateMany.mockResolvedValue({ count: 1 }); // re-claim wins
    const moyasar = {
      reauthorize: jest.fn().mockResolvedValue({ ok: true }),
      capture: jest.fn().mockResolvedValue({ ok: true }),
    } as any;
    const { svc, ledger } = buildSvc(prisma, moyasar);

    const r = await svc.reviveFailedPledge('pl-1');

    expect(r).toEqual({ ok: true, status: PledgeStatus.CAPTURED });
    // Stock claimed with the sold-out guard BEFORE any PSP call.
    expect(prisma.rewardTier.updateMany).toHaveBeenCalledWith({
      where: { id: 'tier-1', claimedQty: { lt: 5 } },
      data: { claimedQty: { increment: 1 } },
    });
    expect(moyasar.reauthorize).toHaveBeenCalledWith('ref-pl-1');
    expect(moyasar.capture).toHaveBeenCalledWith('ref-pl-1');
    expect(prisma.pledge.update).toHaveBeenCalledWith({
      where: { id: 'pl-1' },
      data: expect.objectContaining({ status: PledgeStatus.CAPTURED }),
    });
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      data: { realizedHalalas: { increment: 12_000n } },
    });
    expect(ledger.record).toHaveBeenCalledWith(
      expect.objectContaining({ entryType: 'CAPTURE', amountHalalas: 12_000n }),
    );
  });

  it('tier-stock-exhausted: short-circuits with NO PSP call and NO rollback', async () => {
    const p = adminPledge({ status: PledgeStatus.FAILED_CAPTURE });
    const prisma = makeOpsPrisma();
    prisma.pledge.findUniqueOrThrow = jest.fn().mockResolvedValue(p);
    prisma.rewardTier.findUnique.mockResolvedValue({ limitQty: 5 });
    prisma.rewardTier.updateMany.mockResolvedValue({ count: 0 }); // sold out
    const moyasar = { reauthorize: jest.fn(), capture: jest.fn() } as any;
    const { svc } = buildSvc(prisma, moyasar);

    const r = await svc.reviveFailedPledge('pl-1');

    expect(r).toEqual({
      ok: false,
      reason: 'tier-stock-exhausted',
      status: PledgeStatus.FAILED_CAPTURE,
    });
    expect(moyasar.reauthorize).not.toHaveBeenCalled();
    expect(moyasar.capture).not.toHaveBeenCalled();
    // Exactly the one failed claim — never a compensating rollback decrement.
    expect(prisma.rewardTier.updateMany).toHaveBeenCalledTimes(1);
  });

  it('PSP refusal after the re-claim rolls the stock back and leaves FAILED_CAPTURE', async () => {
    const p = adminPledge({ status: PledgeStatus.FAILED_CAPTURE });
    const prisma = makeOpsPrisma();
    prisma.pledge.findUniqueOrThrow = jest.fn().mockResolvedValue(p);
    prisma.rewardTier.findUnique.mockResolvedValue({ limitQty: 5 });
    prisma.rewardTier.updateMany.mockResolvedValue({ count: 1 });
    const moyasar = {
      reauthorize: jest.fn().mockResolvedValue({ ok: false }), // issuer refuses
      capture: jest.fn(),
    } as any;
    const { svc } = buildSvc(prisma, moyasar);

    const r = await svc.reviveFailedPledge('pl-1');

    expect(r).toEqual({
      ok: false,
      reason: 'psp-declined',
      status: PledgeStatus.FAILED_CAPTURE,
    });
    expect(moyasar.capture).not.toHaveBeenCalled();
    expect(prisma.rewardTier.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'tier-1', claimedQty: { lt: 5 } },
      data: { claimedQty: { increment: 1 } },
    });
    expect(prisma.rewardTier.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'tier-1', claimedQty: { gt: 0 } },
      data: { claimedQty: { decrement: 1 } },
    });
  });
});
