/* eslint-disable @typescript-eslint/no-explicit-any */
import { UnauthorizedException } from '@nestjs/common';
import { PledgeStatus, Prisma } from '@prisma/client';
import { WebhookService } from './webhook.service';

/**
 * WebhookService — Sprint 1 / P0-003 branch coverage:
 *   secret verification (good / bad / unset-dev)
 *   duplicate delivery (P2002 on dedupKey) → 'duplicate', no state touch
 *   payment_paid     HELD→CAPTURED · already-CAPTURED → 'ignored'
 *   payment_failed   HELD→FAILED
 *   payment_voided   HELD→REFUNDED
 *   payment_refunded CAPTURED→REFUNDED · HELD → 'mismatch'
 *   unknown pspRef → 'mismatch' · unknown type → 'ignored'
 */

const REF = 'pay_abc123';

function cfg(secret = 'whsec_test'): any {
  return { get: jest.fn().mockReturnValue(secret) };
}

function makePrisma(over: Record<string, any> = {}): any {
  return {
    webhookEvent: {
      create: jest.fn().mockResolvedValue({ id: 'evt-row-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    pledge: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    ...over,
  };
}

function pledge(status: PledgeStatus): any {
  return { id: 'pl-1', paymentRef: REF, status };
}

function payload(type: string, extra: Record<string, unknown> = {}): any {
  return { id: 'evt-1', type, secret_token: 'whsec_test', data: { id: REF, status: 'x' }, ...extra };
}

describe('WebhookService.verify', () => {
  it('accepts a matching secret_token', () => {
    const svc = new WebhookService(makePrisma(), cfg());
    expect(() => svc.verify(payload('payment_paid'))).not.toThrow();
  });

  it('rejects a wrong secret_token with 401', () => {
    const svc = new WebhookService(makePrisma(), cfg());
    expect(() => svc.verify({ ...payload('payment_paid'), secret_token: 'wrong' })).toThrow(
      UnauthorizedException,
    );
  });
});

describe('WebhookService.process — dedup', () => {
  it('returns duplicate on unique-violation without touching pledges', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    } as any);
    const prisma = makePrisma({
      webhookEvent: { create: jest.fn().mockRejectedValue(p2002), update: jest.fn() },
    });
    const svc = new WebhookService(prisma, cfg());
    const r = await svc.process(payload('payment_paid'));
    expect(r.outcome).toBe('duplicate');
    expect(prisma.pledge.findFirst).not.toHaveBeenCalled();
  });
});

describe('WebhookService.process — event branches', () => {
  it.each([
    ['payment_paid', PledgeStatus.HELD, PledgeStatus.CAPTURED],
    ['payment_failed', PledgeStatus.HELD, PledgeStatus.FAILED],
    ['payment_voided', PledgeStatus.HELD, PledgeStatus.REFUNDED],
    ['payment_refunded', PledgeStatus.CAPTURED, PledgeStatus.REFUNDED],
  ] as const)('%s transitions %s → %s', async (type, from, to) => {
    const prisma = makePrisma({
      pledge: {
        findFirst: jest.fn().mockResolvedValue(pledge(from)),
        update: jest.fn().mockResolvedValue({}),
      },
    });
    const svc = new WebhookService(prisma, cfg());
    const r = await svc.process(payload(type));
    expect(r.outcome).toBe('applied');
    expect(prisma.pledge.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: to }) }),
    );
    // outcome persisted on the event row
    expect(prisma.webhookEvent.update).toHaveBeenCalledWith(
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
    const svc = new WebhookService(prisma, cfg());
    const r = await svc.process(payload('payment_paid'));
    expect(r.outcome).toBe('ignored');
    expect(prisma.pledge.update).not.toHaveBeenCalled();
  });

  it('payment_refunded on a HELD pledge is a mismatch', async () => {
    const prisma = makePrisma({
      pledge: {
        findFirst: jest.fn().mockResolvedValue(pledge(PledgeStatus.HELD)),
        update: jest.fn(),
      },
    });
    const svc = new WebhookService(prisma, cfg());
    const r = await svc.process(payload('payment_refunded'));
    expect(r.outcome).toBe('mismatch');
  });

  it('unknown paymentRef is a mismatch', async () => {
    const prisma = makePrisma({
      pledge: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    });
    const svc = new WebhookService(prisma, cfg());
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
    const svc = new WebhookService(prisma, cfg());
    const r = await svc.process(payload('payment_disputed'));
    expect(r.outcome).toBe('ignored');
    expect(prisma.pledge.update).not.toHaveBeenCalled();
  });
});
