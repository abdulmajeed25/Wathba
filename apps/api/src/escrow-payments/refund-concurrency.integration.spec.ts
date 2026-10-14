import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { PrismaClient, type Pledge } from '@prisma/client';
import { EscrowService } from './escrow.service';
import { WebhookService } from './webhook.service';
import { FundingService } from '../funding/funding.service';
import { finalizeRefund } from './refund-finalization';
import { completeProjectRefund } from '../funding/refund-completion';

const enabled = process.env.WATHBA_CONSENT_DB_TESTS === '1';
if (enabled) {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/wathba_audit') {
    throw new Error('Refund fixtures require the isolated local audit database');
  }
}
const suite = enabled ? describe : describe.skip;

suite('Full refund accounting — isolated PostgreSQL', () => {
  const db = new PrismaClient();
  let pledge: Pledge, addOnId: string;
  const provider = { fetchPayment: jest.fn(), void: jest.fn(async () => ({ ok: true })), refund: jest.fn(async () => ({ ok: true })) };
  const escrow = (client: unknown = db) => new EscrowService(client as never, provider as never,
    {} as never, { create: async () => {} } as never, { refundCompleted: async () => {} } as never,
    { get: async () => 72 } as never);
  const webhook = () => new WebhookService(db as never, {} as never, escrow(),
    { log: async () => {} } as never, { create: async () => {} } as never,
    { refundCompleted: async () => {} } as never, { get: () => 'isolated-refund-secret' } as never);
  const funding = () => new FundingService(db as never, escrow(), {} as never,
    { emitTick: () => {} } as never, {} as never, {} as never,
    { log: async () => {} } as never, {} as never, { create: async () => {} } as never,
    {} as never, {} as never);
  const event = (type: string) => ({ id: randomUUID(), type, data: { id: pledge.paymentRef,
    ...(type === 'payment_refunded' ? { status: 'refunded', amount: Number(pledge.amountHalalas + pledge.addOnsHalalas),
      captured: Number(pledge.amountHalalas + pledge.addOnsHalalas), refunded: Number(pledge.amountHalalas + pledge.addOnsHalalas), currency: 'SAR' } : { status: 'voided', amount: 1800, captured: 0, refunded: 0, currency: 'SAR' }) } });
  const apply = (p = pledge) => db.$transaction(tx => finalizeRefund(tx, p, { source: 'isolated-test' }));
  const state = async () => {
    const p = await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } });
    const u = await db.user.findUniqueOrThrow({ where: { id: pledge.backerId } });
    const t = await db.rewardTier.findUniqueOrThrow({ where: { id: pledge.tierId! } });
    const a = await db.addOn.findUniqueOrThrow({ where: { id: addOnId } });
    return { raised: p.raisedHalalas, realized: p.realizedHalalas, backers: p.backersCount,
      user: u.totalPledgedHalalas, tier: t.claimedQty, addOn: a.claimedQty };
  };
  const empty = { raised: 0n, realized: 0n, backers: 0, user: 0n, tier: 0, addOn: 0 };
  beforeAll(async () => { await db.$connect(); });
  afterAll(async () => { await db.$disconnect(); });
  beforeEach(async () => {
    provider.void.mockReset().mockResolvedValue({ ok: true });
    provider.refund.mockReset().mockResolvedValue({ ok: true });
    const user = await db.user.create({ data: { name: 'اختبار استرداد',
      email: `refund-${randomUUID()}@local.test`, totalPledgedHalalas: 1800n } });
    const project = await db.project.create({ data: { titleAr: `اختبار استرداد ${randomUUID()}`,
      shortDescAr: 'اختبار محلي', storyAr: 'مزود محاكى، لا أموال حقيقية', createdById: user.id,
      fundingGoalHalalas: 100000n, durationDays: 30, deadline: new Date(Date.now() + 7 * 86400000),
      status: 'LIVE', raisedHalalas: 1800n, backersCount: 1 } });
    const tier = await db.rewardTier.create({ data: { projectId: project.id, titleAr: 'مكافأة', descAr: 'اختبار',
      amountHalalas: 1000n, claimedQty: 1, limitQty: 1, estDeliveryDate: new Date() } });
    const addOn = await db.addOn.create({ data: { projectId: project.id, titleAr: 'إضافة', descAr: 'اختبار',
      amountHalalas: 200n, claimedQty: 3, limitQty: 3 } });
    addOnId = addOn.id;
    pledge = await db.pledge.create({ data: { projectId: project.id, backerId: user.id, tierId: tier.id,
      backerNo: 1, amountHalalas: 1200n, shippingHalalas: 200n, addOnsHalalas: 600n,
      paymentRef: `refund-local-${randomUUID()}`, status: 'HELD',
      addOns: { create: { addOnId, qty: 3, amountHalalas: 600n } } } });
  });

  it.each(['HELD', 'CAPTURED', 'PENDING_REAUTH'] as const)('%s admin refund releases every counter once, including shipping and add-on quantities', async status => {
    if (status === 'CAPTURED') await escrow().markCaptured(pledge);
    else await db.pledge.update({ where: { id: pledge.id }, data: { status } });
    expect((await escrow().adminRefundPledge(pledge.id)).ok).toBe(true);
    expect(await state()).toEqual(empty);
    expect((await escrow().adminRefundPledge(pledge.id)).ok).toBe(false);
    expect(await state()).toEqual(empty);
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: { in: ['VOID', 'REFUND'] } } })).toBe(1);
    expect(status === 'CAPTURED' ? provider.refund : provider.void).toHaveBeenCalledTimes(1);
  });

  it.each(['HELD', 'PENDING_BNPL'] as const)('%s backer cancellation compensates once without a second funding-side decrement', async status => {
    await db.pledge.update({ where: { id: pledge.id }, data: { status } });
    await expect(funding().cancelPledge(pledge.backerId, pledge.id)).resolves.toEqual({ ok: true });
    expect(await state()).toEqual(empty);
    expect(provider.void).toHaveBeenCalledTimes(status === 'HELD' ? 1 : 0);
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id } })).toBe(status === 'HELD' ? 1 : 0);
  });

  it('admin refund racing its provider webhook commits one journal and one compensation', async () => {
    await escrow().markCaptured(pledge);
    provider.refund.mockImplementationOnce(async () => {
      expect(await webhook().process(event('payment_refunded'))).toEqual({ outcome: 'applied' });
      return { ok: true };
    });
    expect((await escrow().adminRefundPledge(pledge.id)).ok).toBe(true);
    expect(await state()).toEqual(empty);
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'REFUND' } })).toBe(1);
  });

  it('concurrent duplicate cancellations cannot decrement twice', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => apply()));
    expect(results.filter(x => x === 'applied')).toHaveLength(1);
    expect(results.filter(x => x === 'duplicate')).toHaveLength(3);
    expect(await state()).toEqual(empty);
  });

  it('two pledges by one backer refund concurrently and decrement the backer count once', async () => {
    const second = await db.pledge.create({ data: { projectId: pledge.projectId, backerId: pledge.backerId,
      backerNo: 2, amountHalalas: 700n, status: 'HELD', paymentRef: `second-${randomUUID()}` } });
    await db.project.update({ where: { id: pledge.projectId }, data: { raisedHalalas: { increment: 700n } } });
    await db.user.update({ where: { id: pledge.backerId }, data: { totalPledgedHalalas: { increment: 700n } } });
    expect(await Promise.all([apply(), apply(second)])).toEqual(['applied', 'applied']);
    expect(await state()).toEqual(empty);
  });

  it('journal failure rolls back all local effects; a webhook can finish after provider success', async () => {
    const before = await state();
    const broken = { pledge: db.pledge, $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      db.$transaction(tx => fn(new Proxy(tx, { get(target, key) {
        if (key === 'ledgerEntry') return { create: async () => { throw new Error('test journal failure'); } };
        return Reflect.get(target, key);
      } }))) };
    await expect(escrow(broken).adminRefundPledge(pledge.id)).rejects.toThrow('test journal failure');
    expect(await state()).toEqual(before);
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).status).toBe('HELD');
    expect(await webhook().process(event('payment_voided'))).toEqual({ outcome: 'applied' });
    expect(await state()).toEqual(empty);
  });

  it('missing counted inventory blocks local completion without manufacturing negative stock', async () => {
    await db.addOn.update({ where: { id: addOnId }, data: { claimedQty: 2 } });
    const before = await state();
    await expect(apply()).rejects.toBeInstanceOf(ConflictException);
    expect(await state()).toEqual(before);
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).status).toBe('HELD');
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id } })).toBe(0);
  });

  it('external capture conflicting with an in-flight void is retained for manual reconciliation', async () => {
    provider.void.mockImplementationOnce(async () => { await escrow().markCaptured(pledge); return { ok: true }; });
    expect(await escrow().voidPledge(pledge)).toBe(false);
    expect((await state()).realized).toBe(0n);
    expect(await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).toMatchObject({ status: 'HELD', authorizationIssue: expect.stringContaining('payment:VOID:') });
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'VOID' } })).toBe(0);
  });

  it('a void winning before a stale capture prevents a new credit', async () => {
    expect(await apply()).toBe('applied');
    await expect(escrow().markCaptured(pledge)).rejects.toBeInstanceOf(ConflictException);
    expect(await state()).toEqual(empty);
  });

  it('stale reference and uncounted authorization cannot release counted resources', async () => {
    const before = await state();
    expect(await apply({ ...pledge, paymentRef: 'stale-local-reference' })).toBe('mismatch');
    expect(await apply({ ...pledge, status: 'PENDING_AUTH' })).toBe('mismatch');
    expect(await state()).toEqual(before);
  });

  it('a failed-campaign sweep releases BNPL intent without any provider request', async () => {
    await db.pledge.update({ where: { id: pledge.id }, data: { status: 'PENDING_BNPL' } });
    expect(await escrow().refundAllHeld(pledge.projectId)).toEqual({ refunded: 1, failed: 0 });
    expect(await state()).toEqual(empty);
    expect(provider.void).not.toHaveBeenCalled();
    expect(provider.refund).not.toHaveBeenCalled();
  });

  it('dispute LOST releases the captured balances and inventory; repeated resolution is rejected', async () => {
    await escrow().markCaptured(pledge);
    await db.pledge.update({ where: { id: pledge.id }, data: { status: 'DISPUTED' } });
    await escrow().resolveDispute(pledge.id, 'LOST');
    await expect(escrow().resolveDispute(pledge.id, 'LOST')).rejects.toBeInstanceOf(ConflictException);
    await expect(escrow().resolveDispute(pledge.id, 'WON')).rejects.toBeInstanceOf(ConflictException);
    expect(await state()).toEqual(empty);
    expect(provider.refund).not.toHaveBeenCalled();
  });

  it('creator cancellation remains pending without resending void and completes on matching GET proof', async () => {
    provider.void.mockResolvedValue({ ok: false });
    expect((await funding().cancelCampaign(pledge.backerId, pledge.projectId)).outcome).toBe('refund_pending');
    expect((await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).status).toBe('FAILED');
    expect((await state()).raised).toBe(1800n);
    expect((await funding().resettleResidue(pledge.projectId)).refundsComplete).toBe(false);
    expect(provider.void).toHaveBeenCalledTimes(1);
    provider.fetchPayment.mockResolvedValue({ raw: event('payment_voided').data });
    expect((await escrow().reconcileHeldPayment(pledge.id)).outcome).toBe('confirmed');
    expect((await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).status).toBe('REFUNDED');
    expect(await state()).toEqual(empty);
  });

  it('an uncounted authorization prevents a blanket refund-complete claim until it is voided', async () => {
    const pending = await db.pledge.create({ data: { projectId: pledge.projectId, backerId: pledge.backerId,
      backerNo: 2, amountHalalas: 700n, status: 'PENDING_AUTH', paymentRef: `pending-${randomUUID()}` } });
    expect((await funding().cancelCampaign(pledge.backerId, pledge.projectId)).outcome).toBe('refund_pending');
    expect(await state()).toEqual(empty);
    expect((await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).status).toBe('FAILED');
    expect(await escrow().voidUncountedAuthorization(pending)).toBe(true);
    expect((await funding().resettleResidue(pledge.projectId)).refundsComplete).toBe(true);
    expect(await state()).toEqual(empty);
  });

  it('historical counter differences prevent completion without silently rewriting them', async () => {
    await apply();
    await db.project.update({ where: { id: pledge.projectId }, data: { status: 'FAILED', backersCount: 1 } });
    expect(await completeProjectRefund(db, pledge.projectId)).toBe(false);
    expect((await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).status).toBe('FAILED');
    expect((await state()).backers).toBe(1);
  });
});
