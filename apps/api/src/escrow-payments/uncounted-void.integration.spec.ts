import { randomUUID } from 'node:crypto';
import { PrismaClient, type Pledge } from '@prisma/client';
import { EscrowService } from './escrow.service';
import { WebhookService } from './webhook.service';
import { finalizePledge } from '../funding/pledge-finalization';

const enabled = process.env.WATHBA_CONSENT_DB_TESTS === '1';
if (enabled) {
  const u = new URL(process.env.DATABASE_URL ?? '');
  if (u.hostname !== '127.0.0.1' || u.port !== '55432' || u.pathname !== '/wathba_audit') throw new Error('Isolated local database only');
}
(enabled ? describe : describe.skip)('Uncounted void recovery — isolated PostgreSQL', () => {
  const db = new PrismaClient(); let p: Pledge;
  const provider = { void: jest.fn(), fetchPayment: jest.fn(), refund: jest.fn(), capture: jest.fn() };
  const service = (client: unknown = db) => new EscrowService(client as never, provider as never, {} as never, {} as never, {} as never, {} as never);
  const webhook = () => new WebhookService(db as never, {} as never, service(), { log: async () => {} } as never,
    {} as never, {} as never, { get: () => 'local-secret' } as never);
  const evidence = (over: Record<string, unknown> = {}) => ({ id: p.paymentRef, amount: 1800, captured: 0, refunded: 0, currency: 'SAR', status: 'voided', ...over });
  const row = () => db.pledge.findUniqueOrThrow({ where: { id: p.id } });
  const journal = () => db.ledgerEntry.count({ where: { pledgeId: p.id, entryType: 'VOID' } });
  const pending = () => db.pledge.update({ where: { id: p.id }, data: { authorizationIssue: 'void-outcome-unknown' } });
  beforeAll(async () => db.$connect()); afterAll(async () => db.$disconnect());
  beforeEach(async () => {
    jest.resetAllMocks();
    const user = await db.user.create({ data: { name: 'فك محلي', email: `void-${randomUUID()}@local.test` } });
    const project = await db.project.create({ data: { createdById: user.id, titleAr: 'حجز غير محتسب', shortDescAr: 'اختبار', storyAr: 'محلي',
      fundingGoalHalalas: 10000n, durationDays: 30, deadline: new Date(Date.now() + 86400000), status: 'LIVE' } });
    p = await db.pledge.create({ data: { projectId: project.id, backerId: user.id, backerNo: 1, amountHalalas: 1200n, addOnsHalalas: 600n,
      paymentRef: `void-${randomUUID()}`, status: 'PENDING_AUTH' } });
    provider.void.mockResolvedValue({ ok: true }); provider.fetchPayment.mockResolvedValue({ raw: evidence() });
  });
  afterEach(async () => {
    expect(provider.refund).not.toHaveBeenCalled(); expect(provider.capture).not.toHaveBeenCalled();
    expect(await db.project.findUniqueOrThrow({ where: { id: p.projectId } })).toMatchObject({ raisedHalalas: 0n, realizedHalalas: 0n, backersCount: 0 });
    expect((await db.user.findUniqueOrThrow({ where: { id: p.backerId } })).totalPledgedHalalas).toBe(0n);
  });
  it('records claim before one remote call and concurrent cancellations do not resend', async () => {
    provider.void.mockImplementation(async () => {
      expect((await row()).authorizationIssue).toBe('void-awaiting-confirmation'); return { ok: true };
    });
    const results = await Promise.all(Array.from({ length: 4 }, () => service().voidUncountedAuthorization(p)));
    expect(results.filter(Boolean)).toHaveLength(1); expect(provider.void).toHaveBeenCalledTimes(1);
    expect(provider.void).toHaveBeenCalledWith(p.paymentRef, 1800n); expect(await journal()).toBe(1);
  });
  it.each(['timeout', 'unconfirmed'])('%s survives recreation without another request; GET completes', async mode => {
    if (mode === 'timeout') provider.void.mockRejectedValueOnce(new Error('private-provider-error'));
    else provider.void.mockResolvedValueOnce({ ok: false });
    expect(await service().voidUncountedAuthorization(p)).toBe(false);
    expect((await row()).authorizationIssue).toBe('void-outcome-unknown');
    expect(await service().voidUncountedAuthorization(await row())).toBe(false);
    expect(provider.void).toHaveBeenCalledTimes(1); expect(await journal()).toBe(0);
    expect((await service().reconcileUncountedVoid(p.id)).outcome).toBe('confirmed');
    expect((await row()).status).toBe('REFUNDED'); expect(await journal()).toBe(1);
  });
  it('a delayed finalization cannot count a pledge after void was claimed', async () => {
    provider.void.mockResolvedValueOnce({ ok: false }); await service().voidUncountedAuthorization(p);
    const project = await db.project.findUniqueOrThrow({ where: { id: p.projectId } });
    await expect(db.$transaction(tx => finalizePledge(tx, { pledgeId: p.id, backerId: p.backerId, paymentRef: p.paymentRef,
      project, tier: null, total: 1800n, amountHalalas: 1200, addOns: [], isBnpl: false }))).rejects.toThrow();
    expect((await row()).status).toBe('PENDING_AUTH');
  });
  it('does not void a finalization whose outcome is unknown', async () => {
    await db.pledge.update({ where: { id: p.id }, data: { authorizationIssue: 'finalization-outcome-unknown' } });
    expect(await service().voidUncountedAuthorization(p)).toBe(false); expect(provider.void).not.toHaveBeenCalled();
    await expect(service().reconcileUncountedVoid(p.id)).rejects.toThrow(); expect(provider.fetchPayment).not.toHaveBeenCalled();
  });
  it('authorized GET stays uncounted and cannot enable another void', async () => {
    await pending(); provider.fetchPayment.mockResolvedValue({ raw: evidence({ status: 'authorized' }) });
    expect((await service().reconcileUncountedVoid(p.id)).outcome).toBe('pending');
    expect((await row()).authorizationIssue).toBe('void-not-confirmed'); expect(await journal()).toBe(0);
    expect(await service().voidUncountedAuthorization(await row())).toBe(false); expect(provider.void).not.toHaveBeenCalled();
  });
  it.each(['currency', 'captured', 'outage', 'stub'])('rejects %s without a local success', async mode => {
    await pending();
    if (mode === 'outage') provider.fetchPayment.mockRejectedValue(new Error('network-secret'));
    else provider.fetchPayment.mockResolvedValue(mode === 'stub' ? {} : { raw: evidence(mode === 'currency' ? { currency: 'USD' } : { captured: 1800 }) });
    await expect(service().reconcileUncountedVoid(p.id)).rejects.not.toThrow('network-secret');
    expect((await row()).status).toBe('PENDING_AUTH'); expect(await journal()).toBe(0);
  });
  it('journal failure rolls back and GET recovers without another void', async () => {
    const broken = { pledge: db.pledge, $transaction: (fn: (tx: unknown) => Promise<unknown>) => db.$transaction(tx => fn(new Proxy(tx, {
      get(target, key) { if (key === 'ledgerEntry') return { create: async () => { throw new Error('journal failure'); } }; return Reflect.get(target, key); },
    }))) };
    expect(await service(broken).voidUncountedAuthorization(p)).toBe(false);
    expect(await row()).toMatchObject({ status: 'PENDING_AUTH', authorizationIssue: 'void-outcome-unknown' }); expect(await journal()).toBe(0);
    await service().reconcileUncountedVoid(p.id); expect(await journal()).toBe(1); expect(provider.void).toHaveBeenCalledTimes(1);
  });
  it('concurrent GET and webhook complete a failed campaign once without counter compensation', async () => {
    await pending(); await db.project.update({ where: { id: p.projectId }, data: { status: 'FAILED' } });
    const event = { id: randomUUID(), type: 'payment_voided', data: evidence() };
    await Promise.allSettled([service().reconcileUncountedVoid(p.id), webhook().process(event), webhook().process(event)]);
    expect((await row()).status).toBe('REFUNDED'); expect(await journal()).toBe(1);
    expect((await db.project.findUniqueOrThrow({ where: { id: p.projectId } })).status).toBe('REFUNDED');
    expect(provider.void).not.toHaveBeenCalled();
  });
  it('a void label alone cannot finalize an uncounted authorization by webhook or replay', async () => {
    await pending(); const event = { id: randomUUID(), type: 'payment_voided', data: { id: p.paymentRef } };
    expect(await webhook().process(event)).toEqual({ outcome: 'mismatch' });
    const saved = await db.webhookEvent.findUniqueOrThrow({ where: { dedupKey: `moyasar:${event.id}` } });
    expect(await webhook().replayStored(saved.id)).toEqual({ outcome: 'mismatch' }); expect(await journal()).toBe(0);
  });
  it('late pending GET cannot overwrite a completed void', async () => {
    await pending(); let ready!: () => void, finish!: () => void;
    const started = new Promise<void>(r => { ready = r; }); const gate = new Promise<void>(r => { finish = r; });
    provider.fetchPayment.mockImplementationOnce(async () => { ready(); await gate; return { raw: evidence({ status: 'authorized' }) }; });
    const stale = expect(service().reconcileUncountedVoid(p.id)).rejects.toThrow(); await started;
    try { await service().reconcileUncountedVoid(p.id); } finally { finish(); }
    await stale; expect(await journal()).toBe(1); expect((await row()).authorizationIssue).toBeNull();
  });
  it('changed reference during GET refuses stale proof', async () => {
    await pending(); provider.fetchPayment.mockImplementationOnce(async () => {
      await db.pledge.update({ where: { id: p.id }, data: { paymentRef: `replacement-${randomUUID()}` } }); return { raw: evidence() };
    });
    await expect(service().reconcileUncountedVoid(p.id)).rejects.toThrow(); expect(await journal()).toBe(0);
  });
  it('does not release reward or addon stock that the uncounted pledge never claimed', async () => {
    const tier = await db.rewardTier.create({ data: { projectId: p.projectId, titleAr: 'مكافأة', descAr: 'اختبار',
      estDeliveryDate: new Date(), amountHalalas: 1200n, claimedQty: 0 } });
    const addon = await db.addOn.create({ data: { projectId: p.projectId, titleAr: 'إضافة', descAr: 'اختبار', amountHalalas: 600n, claimedQty: 0 } });
    p = await db.pledge.update({ where: { id: p.id }, data: { tierId: tier.id } });
    await db.pledgeAddOn.create({ data: { pledgeId: p.id, addOnId: addon.id, qty: 1, amountHalalas: 600n } });
    await pending(); await service().reconcileUncountedVoid(p.id);
    expect((await db.rewardTier.findUniqueOrThrow({ where: { id: tier.id } })).claimedQty).toBe(0);
    expect((await db.addOn.findUniqueOrThrow({ where: { id: addon.id } })).claimedQty).toBe(0); expect(await journal()).toBe(1);
  });
});
