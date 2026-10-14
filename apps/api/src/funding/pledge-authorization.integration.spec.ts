import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { FundingService } from './funding.service';
import { EscrowService } from '../escrow-payments/escrow.service';
import { WebhookService } from '../escrow-payments/webhook.service';
import { LedgerService } from '../escrow-payments/ledger.service';
import { finalizePledge } from './pledge-finalization';
import { FundingController } from './funding.controller';
import { BnplService } from '../escrow-payments/bnpl.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtStrategy } from '../identity/jwt.strategy';
import { SubjectThrottlerGuard } from '../common/subject-throttler.guard';

const enabled = process.env.WATHBA_CONSENT_DB_TESTS === '1';
if (enabled) {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/wathba_audit') {
    throw new Error('Authorization fixtures require the isolated local audit database');
  }
}
const suite = enabled ? describe : describe.skip;
suite('Pledge authorization — PostgreSQL finalization', () => {
  const db = new PrismaClient();
  let userId: string, projectId: string;
  const settings = { get: async (key: string) => ({
    'pledges.minHalalas': 1000, 'pledges.maxHalalas': null,
    'payments.methodsEnabled': { card: true, bnpl: true },
  })[key] };
  const create = (hold: (input: { pledgeId: string; givenId?: string; amountHalalas?: number }) => Promise<unknown>, voidOk = true, client: unknown = db) => {
    const provider = { hold: jest.fn(hold), void: jest.fn(async () => ({ ok: voidOk })), capture: jest.fn(), fetchPayment: jest.fn() };
    const ledger = new LedgerService(db as never);
    const notifications = { create: jest.fn(async () => {}), filterAllowed: async () => [] };
    const escrow = new EscrowService(db as never, provider as never, ledger, {} as never, {} as never, settings as never);
    const svc = new FundingService(client as never, escrow, { inferType: () => 'DONATION' } as never,
      { emitTick: () => {} } as never, { materializeFromPledge: async () => {} } as never,
      ledger, { log: async () => {} } as never, { pledgeReceipt: async () => {} } as never,
      notifications as never, { assertHuman: async () => {} } as never, settings as never);
    return { svc, escrow, provider, notifications };
  };
  const authorized = async (p: { pledgeId: string; givenId?: string; amountHalalas?: number }) => ({ paymentRef: p.givenId, status: 'authorized', raw: { id: p.givenId, status: 'authorized', amount: p.amountHalalas, currency: 'SAR', captured: 0, refunded: 0 } });
  const dto = () => ({ projectId, amountHalalas: 2000, source: 'local-token' });
  beforeAll(async () => { await db.$connect(); });
  afterAll(async () => { await db.$disconnect(); });
  beforeEach(async () => {
    const user = await db.user.create({ data: { name: 'اختبار حجز معزول', email: `authorization-${randomUUID()}@local.test`, nafathVerified: true } });
    userId = user.id;
    const project = await db.project.create({ data: {
      titleAr: `اختبار الحجز ${randomUUID()}`, shortDescAr: 'معزول', storyAr: 'مزود محاكى دون مال حقيقي',
      createdById: user.id, fundingGoalHalalas: 100000n, durationDays: 30,
      deadline: new Date(Date.now() + 86400000), status: 'LIVE',
    } });
    projectId = project.id;
  });

  it('an in-flight hold cannot be captured or counted before finalization', async () => {
    const { svc, escrow, provider } = create(async input => {
      expect((await db.pledge.findUniqueOrThrow({ where: { id: input.pledgeId } })).status).toBe('PENDING_AUTH');
      expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(0n);
      expect(await escrow.captureAllHeld(projectId)).toEqual({ captured: 0, failed: 0 });
      return authorized(input);
    });
    const p = await svc.pledge(userId, dto());
    expect(p.status).toBe('HELD');
    expect(provider.capture).not.toHaveBeenCalled();
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(2000n);
  });

  it('replays a saved result after closure without a second hold or receipt', async () => {
    const { svc, provider, notifications } = create(authorized);
    const input = { ...dto(), requestKey: randomUUID() };
    const first = await svc.pledge(userId, input);
    await db.project.update({ where: { id: projectId }, data: { status: 'PAUSED' } });
    const replay = await svc.pledge(userId, { ...input, source: 'replacement-token', captchaToken: 'expired-token' });
    expect(replay).toMatchObject({ id: first.id, status: 'HELD', replayed: true });
    expect(provider.hold).toHaveBeenCalledTimes(1);
    expect(notifications.create).not.toHaveBeenCalled();
    expect(await db.notification.count({ where: { userId, kind: 'PLEDGE_RECEIVED' } })).toBe(1);
    expect(await db.pledge.count({ where: { projectId } })).toBe(1);
  });

  it('counts a repeat backer once while retaining both independent commitments', async () => {
    const { svc } = create(authorized);
    const first = await svc.pledge(userId, { ...dto(), requestKey: randomUUID() });
    const second = await svc.pledge(userId, { ...dto(), requestKey: randomUUID() });
    expect(first.id).not.toBe(second.id);
    const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
    expect(project.raisedHalalas).toBe(4000n);
    expect(project.backersCount).toBe(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).totalPledgedHalalas).toBe(4000n);
  });

  it('replays unknown authorization without contacting the provider again', async () => {
    const { svc, provider } = create(async () => { throw new Error('lost response'); });
    const input = { ...dto(), requestKey: randomUUID() };
    await expect(svc.pledge(userId, input)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(await svc.pledge(userId, input)).toMatchObject({ status: 'PENDING_AUTH', replayed: true });
    expect(provider.hold).toHaveBeenCalledTimes(1);
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(0n);
  });

  it('rejects changed financial intent under the same key', async () => {
    const { svc, provider } = create(authorized);
    const input = { ...dto(), requestKey: randomUUID() };
    await svc.pledge(userId, input);
    for (const change of [{ amountHalalas: 2100 }, { paymentMethod: 'TABBY' }, { projectId: randomUUID() }]) {
      await expect(svc.pledge(userId, { ...input, ...change })).rejects.toBeInstanceOf(ConflictException);
    }
    expect(provider.hold).toHaveBeenCalledTimes(1);
  });

  const address = { name: 'داعم اختبار', address: 'عنوان محلي للاختبار', city: 'الرياض', country: 'SA', postal: '12345' };
  const shippingTier = (shippingHalalas: bigint | null) => db.rewardTier.create({ data: {
    projectId, titleAr: 'مكافأة شحن', descAr: 'مكافأة اختبار تكلفة الشحن', amountHalalas: 2005n,
    requiresShipping: true, shippingHalalas, shipsTo: ['SA'], estDeliveryDate: new Date(Date.now() + 86400000),
  } });
  it('authorizes the displayed total once and freezes its shipping component on the pledge', async () => {
    const tier = await shippingTier(750n);
    const { svc, provider } = create(authorized);
    const input = { ...dto(), requestKey: randomUUID(), tierId: tier.id, amountHalalas: 2755, shippingHalalas: 750, shipping: address };
    const p = await svc.pledge(userId, input);
    expect(p).toMatchObject({ amountHalalas: 2755n, shippingHalalas: 750n });
    expect(provider.hold).toHaveBeenCalledWith(expect.objectContaining({ amountHalalas: 2755 }));
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(2755n);
    // Simulate a future offer version: replay still reads the agreed snapshot.
    await db.rewardTier.update({ where: { id: tier.id }, data: { shippingHalalas: 900n } });
    expect(await svc.pledge(userId, input)).toMatchObject({ id: p.id, shippingHalalas: 750n, replayed: true });
    expect(provider.hold).toHaveBeenCalledTimes(1);
  });
  it('rejects unknown shipping, stale fees and underpayment before authorization', async () => {
    const tier = await shippingTier(null);
    const { svc, provider } = create(authorized);
    const input = { ...dto(), tierId: tier.id, amountHalalas: 2755, shippingHalalas: 750, shipping: address };
    await expect(svc.pledge(userId, input)).rejects.toThrow('لم يحدد');
    await db.rewardTier.update({ where: { id: tier.id }, data: { shippingHalalas: 750n } });
    await expect(svc.pledge(userId, { ...input, shippingHalalas: 800 })).rejects.toThrow('تغيرت تكلفة الشحن');
    await expect(svc.pledge(userId, { ...input, amountHalalas: 2005 })).rejects.toThrow('below the tier minimum');
    expect(provider.hold).not.toHaveBeenCalled();
  });
  it('rejects shipping repricing during authorization and voids without counting support', async () => {
    const tier = await shippingTier(750n);
    const { svc, provider } = create(async input => {
      await db.rewardTier.update({ where: { id: tier.id }, data: { shippingHalalas: 950n } });
      return authorized(input);
    });
    await expect(svc.pledge(userId, { ...dto(), tierId: tier.id, amountHalalas: 2755, shippingHalalas: 750, shipping: address })).rejects.toBeInstanceOf(ConflictException);
    expect(provider.void).toHaveBeenCalledTimes(1);
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(0n);
  });

  it('looks up a result directly by stable ID or reference and denies other backers', async () => {
    const { svc } = create(authorized);
    const first = await svc.pledge(userId, { ...dto(), requestKey: randomUUID() });
    expect((await svc.myResult(userId, { pledgeId: first.id, paymentRef: 'stale-ref' })).id).toBe(first.id);
    expect((await svc.myResult(userId, { paymentRef: first.paymentRef })).id).toBe(first.id);
    await expect(svc.myResult(randomUUID(), { pledgeId: first.id })).rejects.toMatchObject({ status: 404 });
    await expect(svc.myResult(randomUUID(), { paymentRef: first.paymentRef })).rejects.toMatchObject({ status: 404 });
    await expect(svc.myResult(userId, {})).rejects.toMatchObject({ status: 400 });
  });

  it('rejects unknown destinations and unsupported countries before contacting the provider', async () => {
    const tier = await shippingTier(750n);
    const { svc, provider } = create(authorized);
    const input = { ...dto(), tierId: tier.id, amountHalalas: 2755, shippingHalalas: 750, shipping: { ...address, country: 'AE' } };
    await expect(svc.pledge(userId, input)).rejects.toThrow('لا تُشحن');
    await db.rewardTier.update({ where: { id: tier.id }, data: { shipsTo: [] } });
    await expect(svc.pledge(userId, input)).rejects.toThrow('وجهات شحن');
    expect(provider.hold).not.toHaveBeenCalled();
    expect(await db.pledge.count({ where: { projectId } })).toBe(0);
  });

  it('voids an uncounted authorization when shipping destinations change while waiting', async () => {
    const tier = await shippingTier(750n);
    const { svc, provider } = create(async input => {
      await db.rewardTier.update({ where: { id: tier.id }, data: { shipsTo: ['AE'] } });
      return authorized(input);
    });
    await expect(svc.pledge(userId, { ...dto(), tierId: tier.id, amountHalalas: 2755, shippingHalalas: 750, shipping: address })).rejects.toBeInstanceOf(ConflictException);
    expect(provider.void).toHaveBeenCalledTimes(1);
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(0n);
    expect((await db.rewardTier.findUniqueOrThrow({ where: { id: tier.id } })).claimedQty).toBe(0);
  });

  it('scopes the key to its backer without exposing another backer record', async () => {
    const other = await db.user.create({ data: { name: 'داعم اختبار آخر', email: `${randomUUID()}@local.test`, nafathVerified: true } });
    const { svc, provider } = create(authorized);
    const input = { ...dto(), requestKey: randomUUID() };
    const first = await svc.pledge(userId, input);
    const second = await svc.pledge(other.id, input);
    expect(second.id).not.toBe(first.id);
    expect(second.backerId).toBe(other.id);
    expect(provider.hold).toHaveBeenCalledTimes(2);
  });

  it('concurrent inserts sharing a key authorize once, including the unique-constraint loser', async () => {
    let arrivals = 0, release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const client = { project: db.project, user: db.user,
      pledge: { findUnique: db.pledge.findUnique.bind(db.pledge), aggregate: db.pledge.aggregate.bind(db.pledge),
        update: db.pledge.update.bind(db.pledge), updateMany: db.pledge.updateMany.bind(db.pledge),
        create: async (args: Parameters<typeof db.pledge.create>[0]) => {
          if (++arrivals === 2) release();
          await barrier;
          return db.pledge.create(args);
        } },
      $transaction: db.$transaction.bind(db),
    };
    const { svc, provider } = create(authorized, true, client);
    const input = { ...dto(), requestKey: randomUUID() };
    const results = await Promise.all([svc.pledge(userId, input), svc.pledge(userId, input)]);
    expect(results[0].id).toBe(results[1].id);
    expect(provider.hold).toHaveBeenCalledTimes(1);
    expect(await db.pledge.count({ where: { projectId } })).toBe(1);
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(2000n);
  });

  it.each(['status', 'goal', 'deadline'] as const)('a changed %s after authorization prevents funding and voids the uncounted hold', async field => {
    const { svc, provider } = create(async input => {
      await db.project.update({ where: { id: projectId }, data: field === 'status' ? { status: 'PAUSED' }
        : field === 'goal' ? { fundingGoalHalalas: 50000n } : { deadline: new Date(Date.now() - 1000) } });
      return authorized(input);
    });
    await expect(svc.pledge(userId, dto())).rejects.toBeInstanceOf(ConflictException);
    const p = await db.pledge.findFirstOrThrow({ where: { projectId } });
    expect(p.status).toBe('REFUNDED');
    expect(provider.void).toHaveBeenCalledTimes(1);
    expect(await db.project.findUnique({ where: { id: projectId } })).toMatchObject({ raisedHalalas: 0n, backersCount: 0 });
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).totalPledgedHalalas).toBe(0n);
    expect(await db.ledgerEntry.count({ where: { pledgeId: p.id, entryType: 'VOID' } })).toBe(1);
  });

  it('an ambiguous provider response stays uncounted and does not fabricate failure', async () => {
    const { svc, provider } = create(async () => { throw new Error('response lost'); });
    await expect(svc.pledge(userId, dto())).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(await db.pledge.findFirst({ where: { projectId } })).toMatchObject({ status: 'PENDING_AUTH', authorizationIssue: 'authorization-outcome-unknown' });
    expect(provider.void).not.toHaveBeenCalled();
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(0n);
    expect((await svc.listMine(userId, { phase: 'active' })).items).toHaveLength(1);
    expect((await svc.listMine(userId, { phase: 'past' })).items).toHaveLength(0);
  });

  it('a failed void preserves the real payment reference and a visible reconciliation reason', async () => {
    const { svc } = create(async input => {
      await db.project.update({ where: { id: projectId }, data: { status: 'PAUSED' } });
      return authorized(input);
    }, false);
    await expect(svc.pledge(userId, dto())).rejects.toBeInstanceOf(ServiceUnavailableException);
    const p = await db.pledge.findFirstOrThrow({ where: { projectId } });
    expect(p).toMatchObject({ status: 'PENDING_AUTH', authorizationIssue: 'void-outcome-unknown', paymentRef: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(0n);
  });

  it.each(['tier', 'addon'] as const)('two authorized requests cannot consume the last %s unit twice', async kind => {
    const tier = kind === 'tier' ? await db.rewardTier.create({ data: { projectId, titleAr: 'آخر مكافأة', descAr: 'وحدة واحدة للاختبار', estDeliveryDate: new Date(Date.now() + 86400000), amountHalalas: 2000n, limitQty: 1 } }) : null;
    const addon = kind === 'addon' ? await db.addOn.create({ data: { projectId, titleAr: 'آخر إضافة', descAr: 'وحدة واحدة للاختبار', amountHalalas: 500n, limitQty: 1 } }) : null;
    let releaseFirst!: () => void, firstReady!: () => void;
    const gate = new Promise<void>(resolve => { releaseFirst = resolve; });
    const entered = new Promise<void>(resolve => { firstReady = resolve; });
    let arrivals = 0;
    const { svc, provider } = create(async input => {
      arrivals++;
      if (arrivals === 1) { firstReady(); await gate; } else releaseFirst();
      return authorized(input);
    });
    const input = { ...dto(), ...(tier ? { tierId: tier.id } : { addOns: [{ addOnId: addon!.id, qty: 1 }] }) };
    const first = svc.pledge(userId, input);
    await entered;
    const second = svc.pledge(userId, input);
    const results = await Promise.allSettled([first, second]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(provider.void).toHaveBeenCalledTimes(1);
    expect(await db.project.findUnique({ where: { id: projectId } })).toMatchObject({ raisedHalalas: tier ? 2000n : 2500n, backersCount: 1 });
    const stock = tier ? await db.rewardTier.findUniqueOrThrow({ where: { id: tier.id } }) : await db.addOn.findUniqueOrThrow({ where: { id: addon!.id } });
    expect(stock.claimedQty).toBe(1);
  });

  it('does not void a hold when the database committed but its acknowledgement was lost', async () => {
    const client = { project: db.project, pledge: db.pledge, user: db.user,
      $transaction: async (fn: Parameters<typeof db.$transaction>[0]) => {
        await db.$transaction(fn as never);
        throw new Error('commit acknowledgement lost');
      },
    };
    const { svc, provider } = create(authorized, true, client);
    const input = { ...dto(), requestKey: randomUUID() };
    await expect(svc.pledge(userId, input)).rejects.toThrow('commit acknowledgement lost');
    expect(await svc.pledge(userId, input)).toMatchObject({ status: 'HELD', replayed: true });
    expect(provider.hold).toHaveBeenCalledTimes(1);
    expect(provider.void).not.toHaveBeenCalled();
    expect((await db.pledge.findFirstOrThrow({ where: { projectId } })).status).toBe('HELD');
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(2000n);
  });

  it('BNPL intent uses the same guarded finalization but creates no fictitious authorization journal', async () => {
    const { svc, provider } = create(authorized);
    const p = await svc.pledge(userId, { ...dto(), paymentMethod: 'TABBY' });
    expect(p.status).toBe('PENDING_BNPL');
    expect(provider.hold).not.toHaveBeenCalled();
    expect(await db.ledgerEntry.count({ where: { pledgeId: p.id, entryType: 'HOLD_AUTHORIZED' } })).toBe(0);
  });

  it('checks the deadline after waiting for the project lock, not before it', async () => {
    const p = await db.pledge.create({ data: { projectId, backerId: userId, backerNo: 1,
      amountHalalas: 2000n, status: 'PENDING_AUTH', paymentRef: `lock-test-${randomUUID()}` } });
    let attempt!: Promise<unknown>;
    await db.$transaction(async lock => {
      const snapshot = await lock.project.update({ where: { id: projectId },
        data: { deadline: new Date(Date.now() + 500) } });
      attempt = db.$transaction(tx => finalizePledge(tx, {
        pledgeId: p.id, backerId: userId, paymentRef: p.paymentRef, total: 2000n,
        project: snapshot, tier: null, amountHalalas: 2000, addOns: [], isBnpl: false,
      })).catch(error => error);
      await new Promise(resolve => setTimeout(resolve, 800));
    });
    expect(await attempt).toBeInstanceOf(ConflictException);
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(0n);
    expect((await db.pledge.findUniqueOrThrow({ where: { id: p.id } })).status).toBe('PENDING_AUTH');
  });

  it('does not tell a backer their money was captured after their uncounted hold was voided', async () => {
    const { svc, notifications } = create(async input => {
      await db.project.update({ where: { id: projectId }, data: { status: 'PAUSED' } });
      return authorized(input);
    });
    await expect(svc.pledge(userId, dto())).rejects.toBeInstanceOf(ConflictException);
    const notify = svc as unknown as { notifyBackersOfOutcome: (project: { id: string; titleAr: string }, funded: boolean) => Promise<void> };
    await notify.notifyBackersOfOutcome({ id: projectId, titleAr: 'حملة الاختبار' }, true);
    expect(notifications.create).not.toHaveBeenCalled();
  });
  const rawPayment = (ref: string, status = 'authorized', amount = 2000) => ({ id: ref, status, amount, currency: 'SAR', captured: 0, refunded: 0 });
  const pending = async (method: 'timeout' | 'challenge' = 'timeout', input = dto()) => {
    const parts = create(async req => {
      if (method === 'timeout') throw new Error('lost response');
      return { paymentRef: req.givenId, status: 'failed', raw: { ...rawPayment(req.givenId!, 'initiated', req.amountHalalas), source: { transaction_url: 'https://api.moyasar.com/v1/transaction_auths/local-test' } } };
    });
    if (method === 'timeout') await expect(parts.svc.pledge(userId, input)).rejects.toBeInstanceOf(ServiceUnavailableException);
    else expect((await parts.svc.pledge(userId, input)).status).toBe('PENDING_AUTH');
    const pledge = await db.pledge.findFirstOrThrow({ where: { projectId } });
    parts.provider.fetchPayment.mockResolvedValue({ raw: rawPayment(pledge.paymentRef, 'authorized', Number(pledge.amountHalalas + pledge.addOnsHalalas)) });
    return { ...parts, pledge };
  };

  it('persists the given payment reference and financial snapshot before the initial POST', async () => {
    const { svc } = create(async req => {
      const row = await db.pledge.findUniqueOrThrow({ where: { id: req.pledgeId } });
      expect(row.paymentRef).toBe(req.givenId); expect(row.authorizationContext).toMatchObject({ version: 1, amountHalalas: '2000', project: { id: projectId, fundingGoalHalalas: '100000' } });
      expect(JSON.stringify(row.authorizationContext)).not.toContain('local-token');
      return authorized(req);
    });
    expect((await svc.pledge(userId, dto())).status).toBe('HELD');
  });

  it('lost POST response is completed by GET once, without another payment or duplicate receipt', async () => {
    const { svc, provider, pledge, notifications } = await pending();
    const results = await Promise.all([svc.verifyAuthorization(userId, pledge.id), svc.verifyAuthorization(userId, pledge.id)]);
    expect(results.every(r => r.outcome === 'confirmed')).toBe(true); expect(results.filter(r => r.applied)).toHaveLength(1);
    expect(provider.hold).toHaveBeenCalledTimes(1); expect(provider.capture).not.toHaveBeenCalled(); expect(provider.void).not.toHaveBeenCalled();
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(2000n);
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'HOLD_AUTHORIZED' } })).toBe(1);
    expect(notifications.create).not.toHaveBeenCalled();
    expect(await db.notification.count({ where: { userId, kind: 'PLEDGE_RECEIVED' } })).toBe(1);
  });

  it('recovery racing with the original POST completion credits once and never voids the winner', async () => {
    let ready!: () => void, release!: () => void;
    const started = new Promise<void>(resolve => { ready = resolve; }); const gate = new Promise<void>(resolve => { release = resolve; });
    const { svc, provider, notifications } = create(async req => { ready(); await gate; return authorized(req); });
    const original = svc.pledge(userId, dto()); await started;
    const row = await db.pledge.findFirstOrThrow({ where: { projectId } });
    provider.fetchPayment.mockResolvedValue({ raw: rawPayment(row.paymentRef) });
    expect((await svc.verifyAuthorization(userId, row.id)).outcome).toBe('confirmed'); release();
    expect(await original).toMatchObject({ status: 'HELD', replayed: true });
    expect(provider.void).not.toHaveBeenCalled(); expect(notifications.create).not.toHaveBeenCalled();
    expect(await db.notification.count({ where: { userId, kind: 'PLEDGE_RECEIVED' } })).toBe(1);
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(2000n);
    expect(await db.ledgerEntry.count({ where: { pledgeId: row.id, entryType: 'HOLD_AUTHORIZED' } })).toBe(1);
  });

  it('3DS stays uncounted until server-side authorization proof, regardless of the browser return', async () => {
    const { svc, provider, pledge } = await pending('challenge');
    provider.fetchPayment.mockResolvedValue({ raw: { ...rawPayment(pledge.paymentRef, 'initiated'), source: { transaction_url: 'https://api.moyasar.com/v1/transaction_auths/local-test' } } });
    expect(await svc.verifyAuthorization(userId, pledge.id)).toMatchObject({ outcome: 'challenge', transactionUrl: expect.stringContaining('api.moyasar.com') });
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(0n);
    provider.fetchPayment.mockResolvedValue({ raw: rawPayment(pledge.paymentRef) });
    expect((await svc.verifyAuthorization(userId, pledge.id)).outcome).toBe('confirmed'); expect(provider.hold).toHaveBeenCalledTimes(1);
  });

  it.each(['goal', 'deadline', 'status'])('changed campaign %s prevents recovery under newer terms', async field => {
    const { svc, provider, pledge } = await pending();
    await db.project.update({ where: { id: projectId }, data: field === 'goal' ? { fundingGoalHalalas: 50000n } : field === 'deadline' ? { deadline: new Date(Date.now() - 1000) } : { status: 'PAUSED' } });
    expect((await svc.verifyAuthorization(userId, pledge.id)).outcome).toBe('needs-review');
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(0n);
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).authorizationIssue).toBe('authorization-terms-changed');
    expect(provider.void).not.toHaveBeenCalled(); expect(provider.capture).not.toHaveBeenCalled();
  });

  it.each(['amount', 'shipping', 'stock'])('changed reward %s is checked against the saved authorization context', async field => {
    const tier = await db.rewardTier.create({ data: { projectId, titleAr: 'شروط محفوظة', descAr: 'اختبار', amountHalalas: 1500n, requiresShipping: true, shippingHalalas: 500n, shipsTo: ['SA'], limitQty: 1, estDeliveryDate: new Date() } });
    const { svc, pledge } = await pending('timeout', { ...dto(), tierId: tier.id, shippingHalalas: 500, shipping: { name: 'LOCAL', address: 'test', city: 'test', country: 'SA', postal: '00000' } } as ReturnType<typeof dto>);
    await db.rewardTier.update({ where: { id: tier.id }, data: field === 'amount' ? { amountHalalas: 1600n } : field === 'shipping' ? { shippingHalalas: 600n } : { claimedQty: 1 } });
    expect((await svc.verifyAuthorization(userId, pledge.id)).outcome).toBe('needs-review');
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(0n);
    expect((await db.rewardTier.findUniqueOrThrow({ where: { id: tier.id } })).claimedQty).toBe(field === 'stock' ? 1 : 0);
  });

  it.each(['failed', 'voided'])('GET %s with matched zero-charge proof closes an uncounted attempt without compensation', async status => {
    const { svc, provider, pledge } = await pending(); provider.fetchPayment.mockResolvedValue({ raw: rawPayment(pledge.paymentRef, status) });
    expect((await svc.verifyAuthorization(userId, pledge.id)).outcome).toBe('uncharged');
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).status).toBe('FAILED');
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).totalPledgedHalalas).toBe(0n);
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id } })).toBe(0); expect(provider.void).not.toHaveBeenCalled();
  });

  it('ownership is enforced before provider access and contexts are not exposed publicly', async () => {
    const { svc, provider, pledge } = await pending();
    await expect(svc.verifyAuthorization(randomUUID(), pledge.id)).rejects.toThrow('لم يُعثر'); expect(provider.fetchPayment).not.toHaveBeenCalled();
    expect(svc.toPublic(pledge)).toMatchObject({ authorizationRecoverable: true }); expect(svc.toPublic(pledge)).not.toHaveProperty('authorizationContext');
  });

  it.each(['missing-context', 'void-awaiting-confirmation', 'void-outcome-unknown'])('does not recover %s by inventing terms or overriding another operation', async mode => {
    const { svc, provider, pledge } = await pending();
    if (mode === 'missing-context') await db.$executeRaw`UPDATE "Pledge" SET "authorizationContext" = NULL WHERE "id" = ${pledge.id}::uuid`;
    else await db.pledge.update({ where: { id: pledge.id }, data: { authorizationIssue: mode } });
    await expect(svc.verifyAuthorization(userId, pledge.id)).rejects.toBeInstanceOf(ConflictException); expect(provider.fetchPayment).not.toHaveBeenCalled();
  });

  it('a failed authorization journal is retried without a second provider POST', async () => {
    const { svc, escrow, provider } = create(authorized);
    jest.spyOn(escrow, 'recordInitialAuthorization').mockRejectedValueOnce(new Error('journal down'));
    await expect(svc.pledge(userId, dto())).rejects.toThrow('journal down');
    const pledge = await db.pledge.findFirstOrThrow({ where: { projectId } }); provider.fetchPayment.mockResolvedValue({ raw: rawPayment(pledge.paymentRef) });
    expect((await svc.verifyAuthorization(userId, pledge.id)).outcome).toBe('confirmed'); expect(provider.hold).toHaveBeenCalledTimes(1);
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'HOLD_AUTHORIZED' } })).toBe(1);
  });

  it('mismatched GET evidence cannot move funding or replace the saved reference', async () => {
    const { svc, provider, pledge } = await pending(); provider.fetchPayment.mockResolvedValue({ raw: rawPayment(randomUUID()) });
    await expect(svc.verifyAuthorization(userId, pledge.id)).rejects.toBeInstanceOf(ConflictException);
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).paymentRef).toBe(pledge.paymentRef);
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(0n);
  });

  it.each(['version', 'amount', 'project', 'addon-total'])('rejects corrupt saved %s before contacting the provider', async field => {
    const { svc, provider, pledge } = await pending();
    const context = JSON.parse(JSON.stringify(pledge.authorizationContext));
    if (field === 'version') context.version = 2;
    if (field === 'amount') context.amountHalalas = '2500';
    if (field === 'project') context.project.id = randomUUID();
    if (field === 'addon-total') context.addOns = [{ addOnId: randomUUID(), qty: 2, unitPrice: '100', amountHalalas: '200', limitQty: null }];
    await db.pledge.update({ where: { id: pledge.id }, data: { authorizationContext: context } });
    await expect(svc.verifyAuthorization(userId, pledge.id)).rejects.toBeInstanceOf(ConflictException);
    expect(provider.fetchPayment).not.toHaveBeenCalled();
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(0n);
  });

  async function rejectedAuthorization() {
    const fixture = await pending();
    await db.project.update({ where: { id: projectId }, data: { fundingGoalHalalas: 50000n } });
    expect((await fixture.svc.verifyAuthorization(userId, fixture.pledge.id)).outcome).toBe('needs-review');
    fixture.provider.fetchPayment.mockClear();
    return fixture;
  }

  it('explicit rejected-authorization release is single-flight and never compensates uncredited totals', async () => {
    const { escrow, provider, pledge } = await rejectedAuthorization();
    const results = await Promise.allSettled([escrow.releaseRejectedAuthorization(pledge.id), escrow.releaseRejectedAuthorization(pledge.id)]);
    expect(results.some(r => r.status === 'fulfilled')).toBe(true);
    expect(provider.void).toHaveBeenCalledTimes(1); expect(provider.capture).not.toHaveBeenCalled();
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'VOID' } })).toBe(1);
    expect(await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).toMatchObject({ status: 'REFUNDED' });
    expect(await db.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ raisedHalalas: 0n, backersCount: 0 });
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).totalPledgedHalalas).toBe(0n);
  });

  it('an already voided rejected authorization completes without another void POST', async () => {
    const { escrow, provider, pledge } = await rejectedAuthorization();
    provider.fetchPayment.mockResolvedValue({ raw: rawPayment(pledge.paymentRef, 'voided') });
    expect(await escrow.releaseRejectedAuthorization(pledge.id)).toEqual({ ok: true });
    expect(provider.void).not.toHaveBeenCalled();
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'VOID' } })).toBe(1);
  });

  it('lost release result remains reserved and is resolved by GET without another void', async () => {
    const { escrow, provider, pledge } = await rejectedAuthorization();
    provider.void.mockRejectedValueOnce(new Error('lost reply'));
    await expect(escrow.releaseRejectedAuthorization(pledge.id)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).authorizationIssue).toBe('void-outcome-unknown');
    await expect(escrow.releaseRejectedAuthorization(pledge.id)).rejects.toBeInstanceOf(ConflictException);
    provider.fetchPayment.mockResolvedValue({ raw: rawPayment(pledge.paymentRef, 'voided') });
    expect((await escrow.reconcileUncountedVoid(pledge.id)).outcome).toBe('confirmed');
    expect(provider.void).toHaveBeenCalledTimes(1);
  });

  it.each(['wrong-ref', 'charged', 'challenge', 'outage'])('never releases a rejected authorization on %s evidence', async mode => {
    const { escrow, provider, pledge } = await rejectedAuthorization();
    if (mode === 'outage') provider.fetchPayment.mockRejectedValueOnce(new Error('private-network-detail'));
    else provider.fetchPayment.mockResolvedValue({ raw: mode === 'wrong-ref' ? rawPayment(randomUUID()) :
      mode === 'charged' ? { ...rawPayment(pledge.paymentRef), captured: 2000 } : rawPayment(pledge.paymentRef, 'initiated') });
    await expect(escrow.releaseRejectedAuthorization(pledge.id)).rejects.toThrow();
    expect(provider.void).not.toHaveBeenCalled();
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).authorizationIssue).toBe('authorization-terms-changed');
  });

  it('recovery winning during the pre-release GET prevents a void of the now-counted pledge', async () => {
    const { escrow, provider, pledge } = await rejectedAuthorization();
    await db.project.update({ where: { id: projectId }, data: { fundingGoalHalalas: 100000n } });
    provider.fetchPayment.mockImplementationOnce(async () => {
      expect((await escrow.reconcileInitialAuthorization(pledge.id)).outcome).toBe('confirmed');
      return { raw: rawPayment(pledge.paymentRef) };
    });
    await expect(escrow.releaseRejectedAuthorization(pledge.id)).rejects.toThrow();
    expect(provider.void).not.toHaveBeenCalled();
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).status).toBe('HELD');
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(2000n);
  });

  it('unknown initial outcome cannot be released as though its terms were rejected', async () => {
    const { escrow, provider, pledge } = await pending();
    await expect(escrow.releaseRejectedAuthorization(pledge.id)).rejects.toBeInstanceOf(ConflictException);
    expect(provider.fetchPayment).not.toHaveBeenCalled(); expect(provider.void).not.toHaveBeenCalled();
  });

  const webhookFor = (escrow: EscrowService) => new WebhookService(db as never, {} as never, escrow,
    { log: async () => {} } as never, {} as never, {} as never, { get: () => 'isolated-hook-secret' } as never);
  const eventFor = (ref: string, type = 'payment_authorized') => ({ id: randomUUID(), type,
    data: rawPayment(ref, type === 'payment_failed' ? 'failed' : 'authorized') });

  it('provider webhook recovers an abandoned initial challenge and duplicate delivery does not recount', async () => {
    const { escrow, provider, pledge } = await pending('challenge');
    const hook = webhookFor(escrow), event = eventFor(pledge.paymentRef);
    expect(await hook.process(event)).toEqual({ outcome: 'applied' });
    expect(await hook.process(event)).toEqual({ outcome: 'duplicate' });
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).status).toBe('HELD');
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(2000n);
    expect(provider.hold).toHaveBeenCalledTimes(1); expect(provider.fetchPayment).toHaveBeenCalledTimes(1);
    expect(provider.capture).not.toHaveBeenCalled(); expect(provider.void).not.toHaveBeenCalled();
  });

  it('webhook GET outage keeps the event retryable; redelivery completes the same authorization', async () => {
    const { escrow, provider, pledge } = await pending(); const hook = webhookFor(escrow), event = eventFor(pledge.paymentRef);
    provider.fetchPayment.mockRejectedValueOnce(new Error('temporary-provider-outage'));
    await expect(hook.process(event)).rejects.toBeInstanceOf(ServiceUnavailableException);
    const record = await db.webhookEvent.findUniqueOrThrow({ where: { dedupKey: `moyasar:${event.id}` } });
    expect(record.processedAt).toBeNull();
    expect(await hook.process(event)).toEqual({ outcome: 'applied' });
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'HOLD_AUTHORIZED' } })).toBe(1);
  });

  it('a delayed failure event uses current provider truth instead of overriding a valid authorization', async () => {
    const { escrow, provider, pledge } = await pending();
    expect(await webhookFor(escrow).process(eventFor(pledge.paymentRef, 'payment_failed'))).toEqual({ outcome: 'applied' });
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).status).toBe('HELD');
    expect(provider.fetchPayment).toHaveBeenCalledTimes(1);
  });

  it('a failed initial payment is closed without changing funding or stock', async () => {
    const { escrow, provider, pledge } = await pending(); provider.fetchPayment.mockResolvedValue({ raw: rawPayment(pledge.paymentRef, 'failed') });
    expect(await webhookFor(escrow).process(eventFor(pledge.paymentRef, 'payment_failed'))).toEqual({ outcome: 'applied' });
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).status).toBe('FAILED');
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(0n);
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id } })).toBe(0);
  });

  it('changed terms are a visible webhook mismatch and replay cannot force acceptance', async () => {
    const { escrow, provider, pledge } = await pending();
    await db.project.update({ where: { id: projectId }, data: { fundingGoalHalalas: 50000n } });
    const hook = webhookFor(escrow), event = eventFor(pledge.paymentRef);
    expect(await hook.process(event)).toEqual({ outcome: 'mismatch' });
    const record = await db.webhookEvent.findUniqueOrThrow({ where: { dedupKey: `moyasar:${event.id}` } });
    expect(await hook.replayStored(record.id)).toEqual({ outcome: 'mismatch' });
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(0n);
    expect(provider.void).not.toHaveBeenCalled(); expect(provider.capture).not.toHaveBeenCalled();
  });

  it('a legacy initial authorization without original terms is not guessed from a webhook', async () => {
    const { escrow, provider, pledge } = await pending();
    await db.pledge.update({ where: { id: pledge.id }, data: { authorizationContext: { version: 0 } } });
    expect(await webhookFor(escrow).process(eventFor(pledge.paymentRef))).toEqual({ outcome: 'mismatch' });
    expect(provider.fetchPayment).not.toHaveBeenCalled();
  });

  it('provider mismatch cannot finalize an initial authorization via webhook', async () => {
    const { escrow, provider, pledge } = await pending(); provider.fetchPayment.mockResolvedValue({ raw: rawPayment(randomUUID()) });
    expect(await webhookFor(escrow).process(eventFor(pledge.paymentRef))).toEqual({ outcome: 'mismatch' });
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).status).toBe('PENDING_AUTH');
  });

  it('browser recovery and webhook race produces one credited pledge and one authorization journal', async () => {
    const { svc, escrow, provider, pledge } = await pending();
    await Promise.all([svc.verifyAuthorization(userId, pledge.id), webhookFor(escrow).process(eventFor(pledge.paymentRef))]);
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(2000n);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).totalPledgedHalalas).toBe(2000n);
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'HOLD_AUTHORIZED' } })).toBe(1);
    expect(provider.hold).toHaveBeenCalledTimes(1);
  });

  it('late failure on a counted pledge remains a mismatch and preserves all funding counters', async () => {
    const { svc, escrow } = create(authorized); const pledge = await svc.pledge(userId, dto());
    expect(await webhookFor(escrow).process(eventFor(pledge.paymentRef, 'payment_failed'))).toEqual({ outcome: 'mismatch' });
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).status).toBe('HELD');
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(2000n);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).totalPledgedHalalas).toBe(2000n);
  });

  it.each(['CARD', 'TABBY'])('%s receipt preserves halalas and describes the actual commitment', async paymentMethod => {
    const { svc } = create(authorized);
    const p = await svc.pledge(userId, { ...dto(), amountHalalas: 2005, paymentMethod });
    const receipt = await db.notification.findUniqueOrThrow({ where: { dedupKey: `pledge-receipt:${p.id}` } });
    expect(receipt).toMatchObject({ userId, kind: 'PLEDGE_RECEIVED' });
    expect(receipt.payload).toMatchObject({ pledgeId: p.id, amountHalalas: '2005', deepLink: '/projects/me/pledges' });
    expect((receipt.payload as { body: string }).body).toContain('20.05');
    expect((receipt.payload as { body: string }).body).toContain(paymentMethod === 'CARD' ? 'لم يُحصّل' : 'لم يبدأ عقد');
    expect(JSON.stringify(receipt.payload)).not.toContain('local-token');
  });

  it.each(['ops', 'webhook'])('%s recovery creates a durable receipt without the backer endpoint', async source => {
    const { escrow, pledge } = await pending();
    if (source === 'ops') await escrow.reconcileInitialAuthorization(pledge.id);
    else await webhookFor(escrow).process(eventFor(pledge.paymentRef));
    expect(await db.notification.count({ where: { dedupKey: `pledge-receipt:${pledge.id}` } })).toBe(1);
    await escrow.reconcileInitialAuthorization(pledge.id);
    expect(await db.notification.count({ where: { dedupKey: `pledge-receipt:${pledge.id}` } })).toBe(1);
  });

  it('receipt failure rolls back counters and GET retry creates exactly one complete commitment', async () => {
    const client = { project: db.project, pledge: db.pledge, user: db.user,
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => db.$transaction(tx => fn(new Proxy(tx, {
        get(target, key) { if (key === 'notification') return { createMany: async () => { throw new Error('receipt storage unavailable'); } }; return Reflect.get(target, key); },
      }))),
    };
    const { svc, escrow, provider } = create(authorized, true, client);
    await expect(svc.pledge(userId, dto())).rejects.toThrow('receipt storage unavailable');
    const p = await db.pledge.findFirstOrThrow({ where: { projectId } });
    expect(p.status).toBe('PENDING_AUTH');
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(0n);
    expect(await db.notification.count({ where: { userId } })).toBe(0);
    provider.fetchPayment.mockResolvedValue({ raw: rawPayment(p.paymentRef) });
    expect((await escrow.reconcileInitialAuthorization(p.id)).outcome).toBe('confirmed');
    expect(await db.notification.count({ where: { dedupKey: `pledge-receipt:${p.id}` } })).toBe(1);
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).raisedHalalas).toBe(2000n);
    expect(provider.hold).toHaveBeenCalledTimes(1); expect(provider.void).not.toHaveBeenCalled();
  });

  async function httpFixture(svc: FundingService) {
    const secret = randomUUID() + randomUUID();
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])], controllers: [FundingController],
      providers: [{ provide: FundingService, useValue: svc }, { provide: BnplService, useValue: {} },
        { provide: PrismaService, useValue: db }, { provide: ConfigService, useValue: { get: () => secret } },
        JwtStrategy, { provide: APP_GUARD, useClass: SubjectThrottlerGuard }],
    }).compile();
    const app = module.createNestApplication(); app.setGlobalPrefix('v1');
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl(); const jwt = new JwtService({ secret });
    return { app, jwt, post: (id: string, token?: string) => fetch(`${url}/v1/pledges/${id}/verify-authorization`, {
      method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {},
    }) };
  }

  it('real HTTP route authenticates the session, validates UUID, and prevents another account from reading bank details', async () => {
    const { svc, provider, pledge } = await pending('challenge'); const http = await httpFixture(svc);
    try {
      expect((await http.post(pledge.id)).status).toBe(401);
      expect((await http.post(pledge.id, 'invalid-token')).status).toBe(401);
      expect((await http.post(pledge.id, http.jwt.sign({ sub: userId }, { expiresIn: -1 }))).status).toBe(401);
      const stranger = await db.user.create({ data: { name: 'مستخدم اختبار آخر', email: `other-${randomUUID()}@local.test` } });
      expect((await http.post(pledge.id, http.jwt.sign({ sub: stranger.id, roles: ['ADMIN'] }))).status).toBe(404);
      const token = http.jwt.sign({ sub: userId, roles: ['BACKER'] });
      expect((await http.post('not-a-uuid', token)).status).toBe(400);
      expect(provider.fetchPayment).not.toHaveBeenCalled();
      const response = await http.post(pledge.id, token); expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ outcome: 'confirmed' });
      expect(provider.fetchPayment).toHaveBeenCalledTimes(1); expect(provider.hold).toHaveBeenCalledTimes(1);
    } finally { await http.app.close(); }
  });

  it('real HTTP route checks live suspension even with an already-issued valid token', async () => {
    const { svc, provider, pledge } = await pending(); const http = await httpFixture(svc);
    try {
      const token = http.jwt.sign({ sub: userId, roles: ['OWNER'] });
      await db.user.update({ where: { id: userId }, data: { suspendedAt: new Date() } });
      expect((await http.post(pledge.id, token)).status).toBe(401);
      expect(provider.fetchPayment).not.toHaveBeenCalled();
    } finally { await http.app.close(); }
  });

  it('real HTTP route applies the ten-per-minute limit and never creates another payment', async () => {
    const { svc, provider, pledge } = await pending(); const http = await httpFixture(svc);
    try {
      const token = http.jwt.sign({ sub: userId });
      for (let i = 0; i < 10; i++) expect((await http.post(pledge.id, token)).status).toBe(200);
      expect((await http.post(pledge.id, token)).status).toBe(429);
      expect(provider.hold).toHaveBeenCalledTimes(1); expect(provider.fetchPayment).toHaveBeenCalledTimes(1);
    } finally { await http.app.close(); }
  });

});
