/* eslint-disable @typescript-eslint/no-explicit-any */
import { UnauthorizedException } from '@nestjs/common';
import { PledgeStatus, Prisma } from '@prisma/client';
import { WebhookService } from './webhook.service';

function ledgerMock(): any {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

function auditMock(): any {
  return { log: jest.fn().mockResolvedValue(undefined) };
}

function escrowMock(): any {
  return { markCaptured: jest.fn().mockResolvedValue(undefined) };
}

/**
 * WebhookService — Sprint 1 / P0-003 branch coverage:
 *   secret verification (good / bad / unset-dev)
 *   duplicate delivery (P2002 on dedupKey) → 'duplicate', no state touch
 *   payment_paid     HELD→CAPTURED via escrow.markCaptured (OPS-0 #1) · already-CAPTURED → 'ignored'
 *   payment_failed   counted pledge stays unchanged and requires review
 *   payment_voided   HELD→REFUNDED
 *   payment_refunded CAPTURED→REFUNDED · HELD → 'mismatch'
 *   unknown pspRef → 'mismatch' · unknown type → 'ignored'
 */

const REF = 'pay_abc123';

function cfg(secret = 'whsec_test'): any {
  return { get: jest.fn().mockReturnValue(secret) };
}

function makePrisma(over: Record<string, any> = {}): any {
  const prisma: any = {
    webhookEvent: {
      create: jest.fn().mockResolvedValue({ id: 'evt-row-1' }),
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
    pledge: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    ...over,
  };
  prisma.webhookEvent.updateMany ??= jest.fn().mockResolvedValue({ count: 1 });
  prisma.pledge.updateMany ??= jest.fn().mockResolvedValue({ count: 1 });
  prisma.ledgerEntry ??= { create: jest.fn().mockResolvedValue({}) };
  prisma.$queryRaw = jest.fn().mockResolvedValue([]);
  prisma.pledge.count ??= jest.fn().mockResolvedValue(0);
  prisma.project ??= {};
  prisma.project.updateMany = jest.fn().mockResolvedValue({ count: 1 });
  prisma.user ??= {};
  prisma.user.updateMany = jest.fn().mockResolvedValue({ count: 1 });
  prisma.rewardTier ??= { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
  prisma.pledgeAddOn = { findMany: jest.fn().mockResolvedValue([]) };
  prisma.addOn = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
  prisma.$transaction = jest.fn(async (fn: (tx: any) => unknown) => fn(prisma));
  return prisma;
}

function notificationsMock(): any {
  return { create: jest.fn().mockResolvedValue({ id: 'n-1' }) };
}

function emailMock(): any {
  return { refundCompleted: jest.fn().mockResolvedValue({ sent: false, stubbed: true }) };
}

function pledge(status: PledgeStatus): any {
  return { id: 'pl-1', paymentRef: REF, status, amountHalalas: 10_000n, addOnsHalalas: 2_000n };
}

function payload(type: string, extra: Record<string, unknown> = {}): any {
  return { id: 'evt-1', type, secret_token: 'whsec_test', data: { id: REF, status: type === 'payment_refunded' ? 'refunded' : type === 'payment_voided' ? 'voided' : 'paid',
    amount: 12000, captured: type === 'payment_voided' ? 0 : 12000, refunded: type === 'payment_refunded' ? 12000 : 0, currency: 'SAR' }, ...extra };
}

describe('WebhookService.verify', () => {
  it('accepts a matching secret_token', () => {
    const svc = new WebhookService(makePrisma(), ledgerMock(), escrowMock(), auditMock(), notificationsMock(), emailMock(), cfg());
    expect(() => svc.verify(payload('payment_paid'))).not.toThrow();
  });

  it('rejects a wrong secret_token with 401', () => {
    const svc = new WebhookService(makePrisma(), ledgerMock(), escrowMock(), auditMock(), notificationsMock(), emailMock(), cfg());
    expect(() => svc.verify({ ...payload('payment_paid'), secret_token: 'wrong' })).toThrow(
      UnauthorizedException,
    );
  });
});

describe('WebhookService.process — dedup', () => {
  it('does not acknowledge an unrelated uniqueness failure as a duplicate', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('other constraint', { code: 'P2002', clientVersion: 'test' });
    const prisma = makePrisma();
    prisma.webhookEvent.create.mockRejectedValue(error);
    prisma.webhookEvent.findUnique.mockResolvedValue(null);
    const svc = new WebhookService(prisma, ledgerMock(), escrowMock(), auditMock(), notificationsMock(), emailMock(), cfg());
    await expect(svc.process(payload('payment_paid'))).rejects.toBe(error);
    expect(prisma.pledge.findFirst).not.toHaveBeenCalled();
  });
  it('returns duplicate on unique-violation without touching pledges', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    } as any);
    const prisma = makePrisma({
      webhookEvent: { create: jest.fn().mockRejectedValue(p2002), update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ processedAt: new Date() }) },
    });
    const svc = new WebhookService(prisma, ledgerMock(), escrowMock(), auditMock(), notificationsMock(), emailMock(), cfg());
    const r = await svc.process(payload('payment_paid'));
    expect(r.outcome).toBe('duplicate');
    expect(prisma.pledge.findFirst).not.toHaveBeenCalled();
  });
});

describe('WebhookService.process — event branches', () => {
  it.each([
    ['payment_voided', PledgeStatus.HELD, PledgeStatus.REFUNDED],
    ['payment_refunded', PledgeStatus.CAPTURED, PledgeStatus.REFUNDED],
  ] as const)('%s transitions %s → %s', async (type, from, to) => {
    const prisma = makePrisma({
      pledge: {
        findFirst: jest.fn().mockResolvedValue(pledge(from)),
        update: jest.fn().mockResolvedValue({}),
      },
    });
    const svc = new WebhookService(prisma, ledgerMock(), escrowMock(), auditMock(), notificationsMock(), emailMock(), cfg());
    const r = await svc.process(payload(type));
    expect(r.outcome).toBe('applied');
    expect(prisma.pledge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: to }) }),
    );
    // outcome persisted on the event row
    expect(prisma.webhookEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ outcome: 'applied' }) }),
    );
  });

  it('a failure notification cannot drop the state of an already-counted pledge', async () => {
    const prisma = makePrisma({ pledge: { findFirst: jest.fn().mockResolvedValue(pledge(PledgeStatus.HELD)), update: jest.fn() } });
    const svc = new WebhookService(prisma, ledgerMock(), escrowMock(), auditMock(), notificationsMock(), emailMock(), cfg());
    expect((await svc.process(payload('payment_failed'))).outcome).toBe('mismatch');
    expect(prisma.pledge.updateMany).not.toHaveBeenCalled();
    expect(prisma.pledge.update).not.toHaveBeenCalled();
  });

  it('OPS-0 correction #1: payment_paid routes through the markCaptured chokepoint (realized credited)', async () => {
    const escrow = escrowMock();
    const ledger = ledgerMock();
    const prisma = makePrisma({
      pledge: {
        findFirst: jest.fn().mockResolvedValue(pledge(PledgeStatus.HELD)),
        update: jest.fn(),
      },
    });
    const svc = new WebhookService(prisma, ledger, escrow, auditMock(), notificationsMock(), emailMock(), cfg());
    const r = await svc.process(payload('payment_paid'));
    expect(r.outcome).toBe('applied');
    // The chokepoint owns the CAPTURED flip, the realizedHalalas increment
    // AND the single CAPTURE ledger row — the webhook must not duplicate any.
    expect(escrow.markCaptured).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pl-1' }),
      { source: 'webhook' },
    );
    expect(prisma.pledge.update).not.toHaveBeenCalled();
    expect(ledger.record).not.toHaveBeenCalled();
    expect(prisma.webhookEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ outcome: 'applied' }) }),
    );
  });

  it('payment_paid on an already-CAPTURED pledge is ignored (idempotent)', async () => {
    const prisma = makePrisma({
      pledge: {
        findFirst: jest.fn().mockResolvedValue(pledge(PledgeStatus.CAPTURED)),
        update: jest.fn(),
      },
    });
    const escrow = escrowMock();
    const svc = new WebhookService(prisma, ledgerMock(), escrow, auditMock(), notificationsMock(), emailMock(), cfg());
    const r = await svc.process(payload('payment_paid'));
    expect(r.outcome).toBe('ignored');
    expect(prisma.pledge.update).not.toHaveBeenCalled();
    expect(escrow.markCaptured).not.toHaveBeenCalled();
  });

  it('payment_disputed on a CAPTURED pledge → DISPUTED + reversing DISPUTE ledger + audit', async () => {
    const ledger = ledgerMock();
    const audit = auditMock();
    const prisma = makePrisma({
      pledge: {
        findFirst: jest.fn().mockResolvedValue(pledge(PledgeStatus.CAPTURED)),
        update: jest.fn().mockResolvedValue({}),
      },
    });
    const svc = new WebhookService(prisma, ledger, escrowMock(), audit, notificationsMock(), emailMock(), cfg());
    const r = await svc.process(payload('payment_disputed'));
    expect(r.outcome).toBe('applied');
    expect(prisma.pledge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: PledgeStatus.DISPUTED }) }),
    );
    expect(prisma.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entryType: 'DISPUTE', source: 'webhook' }) }),
    );
    expect(ledger.record).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'pledge.disputed', entity: 'Pledge' }),
    );
  });

  it('payment_disputed on a HELD pledge is a mismatch (never captured)', async () => {
    const prisma = makePrisma({
      pledge: { findFirst: jest.fn().mockResolvedValue(pledge(PledgeStatus.HELD)), update: jest.fn() },
    });
    const svc = new WebhookService(prisma, ledgerMock(), escrowMock(), auditMock(), notificationsMock(), emailMock(), cfg());
    expect((await svc.process(payload('payment_disputed'))).outcome).toBe('mismatch');
  });

  it('payment_refunded on a HELD pledge is a mismatch', async () => {
    const prisma = makePrisma({
      pledge: {
        findFirst: jest.fn().mockResolvedValue(pledge(PledgeStatus.HELD)),
        update: jest.fn(),
      },
    });
    const svc = new WebhookService(prisma, ledgerMock(), escrowMock(), auditMock(), notificationsMock(), emailMock(), cfg());
    const r = await svc.process(payload('payment_refunded'));
    expect(r.outcome).toBe('mismatch');
  });

  it('unknown paymentRef is a mismatch', async () => {
    const prisma = makePrisma({
      pledge: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    });
    const svc = new WebhookService(prisma, ledgerMock(), escrowMock(), auditMock(), notificationsMock(), emailMock(), cfg());
    const r = await svc.process(payload('payment_paid'));
    expect(r.outcome).toBe('mismatch');
  });

  it('unknown event type is recorded and ignored', async () => {
    const prisma = makePrisma({
      pledge: {
        findFirst: jest.fn().mockResolvedValue(pledge(PledgeStatus.HELD)),
        update: jest.fn(),
      },
    });
    const svc = new WebhookService(prisma, ledgerMock(), escrowMock(), auditMock(), notificationsMock(), emailMock(), cfg());
    const r = await svc.process(payload('payment_some_future_event'));
    expect(r.outcome).toBe('ignored');
    expect(prisma.pledge.update).not.toHaveBeenCalled();
  });
});

/**
 * OPS-INTEGRITY — replayStored re-runs a STORED event through the FSM without
 * the dedup claim, healing a 'mismatch'-class event that is now applicable,
 * and stays idempotent once the transition has already been applied.
 */
describe('WebhookService.replayStored', () => {
  const storedEvent = { id: 'evt-row-1', provider: 'moyasar', eventType: 'payment_paid', pspRef: REF, payload: payload('payment_paid') };

  it('re-applies a stored mismatch event now that the pledge is HELD (heals + re-stamps outcome)', async () => {
    const escrow = escrowMock();
    const prisma = makePrisma({
      webhookEvent: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ ...storedEvent, outcome: 'mismatch' }),
      },
      pledge: {
        findFirst: jest.fn().mockResolvedValue(pledge(PledgeStatus.HELD)),
        update: jest.fn(),
      },
    });
    const svc = new WebhookService(prisma, ledgerMock(), escrow, auditMock(), notificationsMock(), emailMock(), cfg());
    const r = await svc.replayStored('evt-row-1');
    expect(r.outcome).toBe('applied');
    // Same chokepoint as the live path; no new dedup row is claimed on replay.
    expect(escrow.markCaptured).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pl-1' }),
      { source: 'webhook' },
    );
    expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
    expect(prisma.webhookEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt-row-1' },
        data: expect.objectContaining({ outcome: 'applied' }),
      }),
    );
  });

  it('is idempotent: replaying an already-CAPTURED pledge is ignored, no re-capture', async () => {
    const escrow = escrowMock();
    const prisma = makePrisma({
      webhookEvent: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ ...storedEvent, outcome: 'applied' }),
      },
      pledge: {
        findFirst: jest.fn().mockResolvedValue(pledge(PledgeStatus.CAPTURED)),
        update: jest.fn(),
      },
    });
    const svc = new WebhookService(prisma, ledgerMock(), escrow, auditMock(), notificationsMock(), emailMock(), cfg());
    const r = await svc.replayStored('evt-row-1');
    expect(r.outcome).toBe('ignored');
    expect(escrow.markCaptured).not.toHaveBeenCalled();
  });

  it('throws when the stored event row is gone', async () => {
    const prisma = makePrisma({
      webhookEvent: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
    });
    const svc = new WebhookService(prisma, ledgerMock(), escrowMock(), auditMock(), notificationsMock(), emailMock(), cfg());
    await expect(svc.replayStored('missing')).rejects.toThrow();
  });
});
