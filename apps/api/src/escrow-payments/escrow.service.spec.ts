/* eslint-disable @typescript-eslint/no-explicit-any */
import { PledgeStatus } from '@prisma/client';
import { EscrowService } from './escrow.service';

function ledgerMock(): any {
  return { record: jest.fn().mockResolvedValue(undefined) };
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
    const svc = new EscrowService(prisma, moyasar, ledgerMock());
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
    const svc = new EscrowService(prisma, moyasar, ledgerMock());
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
    const svc = new EscrowService(prisma, moyasar, ledgerMock());
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
    const svc = new EscrowService(prisma, moyasar, ledgerMock());
    const r = await svc.refundAllHeld('proj');
    expect(r).toEqual({ refunded: 2, failed: 1 });
    expect(prisma.pledge.update).toHaveBeenCalledTimes(2);
  });
});
