import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PledgeStatus, ProjectStatus } from '@prisma/client';

import { FundingService } from './funding.service';
import { GraceScheduler } from './grace.scheduler';
import { BnplService } from '../escrow-payments/bnpl.service';
import { feeFor } from '../config/fees';
import type { EscrowService } from '../escrow-payments/escrow.service';

/**
 * Batch PAY — state-machine coverage: the 48h cancellation lock, BNPL
 * deferred-initiation, the 72h grace machine, webhook idempotency/replay,
 * and BigInt fee math. Every transition + failure branch.
 */

const HOUR = 60 * 60 * 1000;

function fundingWith(overrides: { pledge?: any; prisma?: any; escrow?: any } = {}) {
  const prisma: any = {
    pledge: {
      findUnique: jest.fn().mockResolvedValue(overrides.pledge ?? null),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    project: { update: jest.fn().mockResolvedValue({ raisedHalalas: 0n, backersCount: 0 }) },
    rewardTier: { update: jest.fn().mockResolvedValue({}) },
    user: { update: jest.fn().mockResolvedValue({}) },
    ...overrides.prisma,
  };
  prisma.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
  const escrow = {
    voidPledge: jest.fn().mockResolvedValue(true),
    captureWithNewSource: jest.fn().mockResolvedValue(true),
    ...overrides.escrow,
  };
  const svc = new FundingService(
    prisma,
    escrow as unknown as EscrowService,
    {} as never, // contracts
    { emitTick: jest.fn() } as never,
    {} as never, // community
    { record: jest.fn() } as never,
    { log: jest.fn() } as never,
    {} as never, // email
    { create: jest.fn().mockResolvedValue(null) } as never,
    { assertHuman: jest.fn().mockResolvedValue(undefined) } as never,
    // Batch OPS (registry completion) — SettingsService stub, catalog defaults.
    {
      get: jest.fn(async (key: string) =>
        ({
          'pledges.minHalalas': 1000,
          'pledges.maxHalalas': null,
          'payments.methodsEnabled': { card: true, bnpl: true },
          'support.inboxEmail': 'support@wathba.sa',
          'funding.graceWindowHours': 72,
          'funding.pauseCapDays': 7,
        })[key],
      ),
      invalidate: jest.fn(),
    } as never,
  );
  return { svc, prisma, escrow };
}

function cancellablePledge(over: Record<string, unknown> = {}) {
  return {
    id: 'pl-1',
    backerId: 'backer-1',
    tierId: 'tier-1',
    status: PledgeStatus.HELD,
    amountHalalas: 10_000n,
    addOnsHalalas: 2_000n,
    paymentRef: 'ref-1',
    project: {
      id: 'proj-1',
      titleAr: 'مشروع',
      status: ProjectStatus.LIVE,
      deadline: new Date(Date.now() + 72 * HOUR), // comfortably outside the lock
      createdById: 'creator-1',
    },
    ...over,
  };
}

describe('Batch PAY — cancelPledge (48h lock)', () => {
  it('cancels a HELD pledge before the lock: voids + decrements counters', async () => {
    const { svc, prisma, escrow } = fundingWith({ pledge: cancellablePledge() });
    await expect(svc.cancelPledge('backer-1', 'pl-1')).resolves.toEqual({ ok: true });
    expect(escrow.voidPledge).toHaveBeenCalled();
    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          raisedHalalas: { decrement: 12_000n },
          backersCount: { decrement: 1 }, // no other active pledge
        }),
      }),
    );
    expect(prisma.rewardTier.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { claimedQty: { decrement: 1 } } }),
    );
  });

  it('refuses inside the final 48 hours with the Arabic lock message', async () => {
    const locked = cancellablePledge();
    locked.project.deadline = new Date(Date.now() + 47 * HOUR);
    const { svc, escrow } = fundingWith({ pledge: locked });
    await expect(svc.cancelPledge('backer-1', 'pl-1')).rejects.toMatchObject({
      constructor: ForbiddenException,
      message: expect.stringContaining('قُفلت التعهدات') as unknown,
    });
    expect(escrow.voidPledge).not.toHaveBeenCalled();
  });

  it('discards a BNPL intent without touching the PSP', async () => {
    const bnpl = cancellablePledge({ status: PledgeStatus.PENDING_BNPL, tierId: null });
    const { svc, prisma, escrow } = fundingWith({ pledge: bnpl });
    await expect(svc.cancelPledge('backer-1', 'pl-1')).resolves.toEqual({ ok: true });
    expect(escrow.voidPledge).not.toHaveBeenCalled();
    expect(prisma.pledge.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: PledgeStatus.REFUNDED }) }),
    );
  });

  it("rejects someone else's pledge and non-cancellable states", async () => {
    const { svc } = fundingWith({ pledge: cancellablePledge() });
    await expect(svc.cancelPledge('intruder', 'pl-1')).rejects.toBeInstanceOf(ForbiddenException);

    const captured = cancellablePledge({ status: PledgeStatus.CAPTURED });
    const { svc: svc2 } = fundingWith({ pledge: captured });
    await expect(svc2.cancelPledge('backer-1', 'pl-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps the backer counter when another active pledge remains', async () => {
    const { svc, prisma } = fundingWith({ pledge: cancellablePledge() });
    (prisma.pledge.count as jest.Mock).mockResolvedValue(1);
    await svc.cancelPledge('backer-1', 'pl-1');
    const data = (prisma.project.update as jest.Mock).mock.calls[0][0].data;
    expect(data.backersCount).toBeUndefined();
  });
});

describe('Batch PAY — grace machine (72h)', () => {
  function graceRow(over: Record<string, unknown> = {}) {
    const started = new Date(Date.now() - 7 * HOUR); // past the +6h mark
    return {
      id: 'pl-g',
      tierId: 'tier-1',
      paymentMethod: 'CARD',
      paymentRef: 'ref-g',
      amountHalalas: 5_000n,
      addOnsHalalas: 0n,
      captureAttempts: 1,
      graceStartedAt: started,
      graceExpiresAt: new Date(started.getTime() + 72 * HOUR),
      createdAt: started,
      backer: { id: 'b1', email: 'b@x.sa' },
      project: { id: 'p1', titleAr: 'مشروع', createdById: 'c1' },
      ...over,
    };
  }

  function schedulerWith(rows: { inGrace?: any[]; dead?: any[] }, captureOk = true) {
    const prisma: any = {
      pledge: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce(rows.inGrace ?? [])
          .mockResolvedValueOnce(rows.dead ?? []),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      rewardTier: { update: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
    const escrow = { markCaptured: jest.fn().mockResolvedValue(undefined) };
    const moyasar = { capture: jest.fn().mockResolvedValue({ ok: captureOk }) };
    const email = { captureFailed: jest.fn().mockResolvedValue({}) };
    const notifications = { create: jest.fn().mockResolvedValue(null) };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const sched = new GraceScheduler(
      prisma,
      escrow as never,
      moyasar as never,
      email as never,
      notifications as never,
      audit as never,
    );
    return { sched, prisma, escrow, moyasar, email, notifications };
  }

  it('retries a due CARD row and captures on success', async () => {
    const { sched, escrow, moyasar } = schedulerWith({ inGrace: [graceRow()] });
    const r = await sched.run();
    expect(moyasar.capture).toHaveBeenCalledWith('ref-g');
    expect(escrow.markCaptured).toHaveBeenCalled();
    expect(r.retried).toBe(1);
  });

  it('bumps the attempt counter when the retry declines again', async () => {
    const { sched, prisma, escrow } = schedulerWith({ inGrace: [graceRow()] }, false);
    await sched.run();
    expect(escrow.markCaptured).not.toHaveBeenCalled();
    expect(prisma.pledge.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { captureAttempts: { increment: 1 } } }),
    );
  });

  it('BNPL rows get reminders, never auto-capture', async () => {
    const bnpl = graceRow({ paymentMethod: 'TABBY' });
    const { sched, moyasar, notifications } = schedulerWith({ inGrace: [bnpl] });
    await sched.run();
    expect(moyasar.capture).not.toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ reminder: true }) }),
    );
  });

  it('expiry → FAILED_CAPTURE: idempotent claim + tier stock released + both sides told', async () => {
    const dead = graceRow({ graceExpiresAt: new Date(Date.now() - HOUR) });
    const { sched, prisma, email, notifications } = schedulerWith({ dead: [dead] });
    const r = await sched.run();
    expect(r.expired).toBe(1);
    expect(prisma.pledge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pl-g', status: PledgeStatus.CAPTURE_GRACE }, // status-guarded
        data: { status: PledgeStatus.FAILED_CAPTURE },
      }),
    );
    expect(prisma.rewardTier.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { claimedQty: { decrement: 1 } } }),
    );
    expect(email.captureFailed).toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalled();
  });

  it('a lost expiry race (claim count 0) sends nothing', async () => {
    const dead = graceRow({ graceExpiresAt: new Date(Date.now() - HOUR) });
    const { sched, prisma, email } = schedulerWith({ dead: [dead] });
    (prisma.pledge.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    await sched.run();
    expect(email.captureFailed).not.toHaveBeenCalled();
  });
});

describe('Batch PAY — BNPL webhooks (idempotent, replay-safe)', () => {
  function bnplWith(pledge: any) {
    const prisma: any = { pledge: { findUnique: jest.fn().mockResolvedValue(pledge) } };
    const escrow = { markCaptured: jest.fn().mockResolvedValue(undefined) };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    return { svc: new BnplService(prisma, escrow as never, audit as never), escrow };
  }
  const due = {
    id: 'pl-b', paymentMethod: 'TABBY', status: PledgeStatus.CAPTURE_GRACE,
    amountHalalas: 40_000n, addOnsHalalas: 0n, paymentRef: 'bnpl-intent-x', projectId: 'p1',
  };

  it('applies a captured event exactly once; the replay is ignored', async () => {
    const { svc, escrow } = bnplWith(due);
    const r1 = await svc.handleWebhook('TABBY', '{}', undefined, { pledgeId: 'pl-b', status: 'captured' });
    expect(r1.outcome).toBe('applied');
    expect(escrow.markCaptured).toHaveBeenCalledTimes(1);

    const { svc: svc2, escrow: escrow2 } = bnplWith({ ...due, status: PledgeStatus.CAPTURED });
    const r2 = await svc2.handleWebhook('TABBY', '{}', undefined, { pledgeId: 'pl-b', status: 'captured' });
    expect(r2.outcome).toBe('ignored');
    expect(escrow2.markCaptured).not.toHaveBeenCalled();
  });

  it('mismatched provider or state never captures', async () => {
    const { svc, escrow } = bnplWith({ ...due, paymentMethod: 'TAMARA' });
    const r = await svc.handleWebhook('TABBY', '{}', undefined, { pledgeId: 'pl-b', status: 'captured' });
    expect(r.outcome).toBe('mismatch');
    expect(escrow.markCaptured).not.toHaveBeenCalled();
  });

  it('rejects a bad signature when the secret is armed', async () => {
    process.env.TABBY_WEBHOOK_SECRET = 'shh';
    const { svc } = bnplWith(due);
    await expect(
      svc.handleWebhook('TABBY', '{"a":1}', 'wrong-signature', { pledgeId: 'pl-b', status: 'captured' }),
    ).rejects.toMatchObject({ message: expect.stringContaining('signature') as unknown });
    delete process.env.TABBY_WEBHOOK_SECRET;
  });

  it('installment disclosure is BigInt ceil-division', () => {
    const { svc } = bnplWith(due);
    const d = svc.installmentsFor('TABBY', 10_001n);
    expect(d.count).toBe(4);
    expect(d.perInstallmentHalalas).toBe(2_501n); // ceil(10001/4)
  });
});

describe('Batch PAY — fee math (BigInt, no floats)', () => {
  it('computes platform + processor fees per method', () => {
    const card = feeFor('CARD', 100_000n); // 1000 SAR
    expect(card.platformHalalas).toBe(5_000n); // 5%
    expect(card.processorHalalas).toBe(2_900n + 100n); // 2.9% + 1 SAR
    expect(card.netHalalas).toBe(100_000n - 5_000n - 3_000n);

    const tabby = feeFor('TABBY', 100_000n);
    expect(tabby.processorHalalas).toBe(6_500n + 150n); // BNPL costs more
    expect(tabby.netHalalas).toBeLessThan(card.netHalalas);
  });
});
