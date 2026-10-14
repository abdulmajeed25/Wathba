import { randomUUID } from 'node:crypto';
import { PrismaClient, type Pledge } from '@prisma/client';
import { EscrowService } from './escrow.service';
import { finalizeRefund } from './refund-finalization';
import { WebhookService } from './webhook.service';

const enabled = process.env.WATHBA_CONSENT_DB_TESTS === '1';
if (enabled) {
  const u = new URL(process.env.DATABASE_URL ?? '');
  if (u.hostname !== '127.0.0.1' || u.port !== '55432' || u.pathname !== '/wathba_audit') throw new Error('Isolated local database only');
}
const suite = enabled ? describe : describe.skip;
suite('Captured refund verification — isolated PostgreSQL and mock provider', () => {
  const db = new PrismaClient();
  let pledge: Pledge;
  const provider = { fetchPayment: jest.fn(), refund: jest.fn(), void: jest.fn() };
  const notifications = { create: jest.fn() };
  const email = { refundCompleted: jest.fn() };
  const service = (client: unknown = db) => new EscrowService(client as never, provider as never, {} as never, notifications as never, email as never, {} as never);
  const evidence = (over: Record<string, unknown> = {}) => ({ raw: { id: pledge.paymentRef, amount: 1800, captured: 1800, refunded: 1800,
    status: 'refunded', currency: 'SAR', source: { secret: 'never-return' }, ...over } });
  const row = () => db.pledge.findUniqueOrThrow({ where: { id: pledge.id } });
  const journal = () => db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'REFUND' } });
  const verify = () => service().reconcileCapturedRefund(pledge.id);
  const webhook = () => new WebhookService(db as never, {} as never, service(), { log: async () => {} } as never,
    notifications as never, email as never, { get: () => 'local-secret' } as never);
  beforeAll(async () => db.$connect());
  afterAll(async () => db.$disconnect());
  beforeEach(async () => {
    jest.clearAllMocks(); provider.fetchPayment.mockReset();
    const user = await db.user.create({ data: { name: 'اختبار مطابقة', email: `refund-get-${randomUUID()}@local.test`, totalPledgedHalalas: 1800n } });
    const project = await db.project.create({ data: { createdById: user.id, titleAr: 'مطابقة محلية', shortDescAr: 'اختبار', storyAr: 'دون أموال حقيقية',
      fundingGoalHalalas: 1800n, durationDays: 30, deadline: new Date(), status: 'FAILED', raisedHalalas: 1800n, realizedHalalas: 1800n, backersCount: 1 } });
    pledge = await db.pledge.create({ data: { projectId: project.id, backerId: user.id, backerNo: 1, amountHalalas: 1200n, addOnsHalalas: 600n,
      paymentRef: `refund-get-${randomUUID()}`, status: 'CAPTURED', capturedAt: new Date(), refundRequestedAt: new Date(),
      refundReservedHalalas: 1800n, refundIssue: 'refund-outcome-unknown' } });
    provider.fetchPayment.mockResolvedValue(evidence());
  });
  afterEach(() => { expect(provider.refund).not.toHaveBeenCalled(); expect(provider.void).not.toHaveBeenCalled(); });
  it('confirms matching full refund, releases reservation and closes failed project atomically', async () => {
    const result = await verify();
    expect(result).toMatchObject({ outcome: 'confirmed', refundedHalalas: '1800' });
    expect(JSON.stringify(result)).not.toContain('never-return');
    expect(provider.fetchPayment).toHaveBeenCalledWith(pledge.paymentRef);
    expect(await row()).toMatchObject({ status: 'REFUNDED', refundReservedHalalas: 0n, refundIssue: null });
    expect(await journal()).toBe(1);
    expect(await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).toMatchObject({ status: 'REFUNDED', raisedHalalas: 0n, realizedHalalas: 0n, backersCount: 0 });
    expect((await db.user.findUniqueOrThrow({ where: { id: pledge.backerId } })).totalPledgedHalalas).toBe(0n);
    expect(notifications.create).toHaveBeenCalledTimes(1); expect(email.refundCompleted).toHaveBeenCalledTimes(1);
  });
  it('concurrent reads and a later repeat cannot duplicate accounting or notification', async () => {
    const results = await Promise.allSettled(Array.from({ length: 4 }, verify));
    expect(results.some(r => r.status === 'fulfilled')).toBe(true);
    expect(await journal()).toBe(1); expect(notifications.create).toHaveBeenCalledTimes(1);
    const calls = provider.fetchPayment.mock.calls.length;
    await expect(verify()).rejects.toThrow(); expect(provider.fetchPayment).toHaveBeenCalledTimes(calls);
  });
  it.each([0, 500])('retains full reservation and counters when refunded=%s', async refunded => {
    provider.fetchPayment.mockResolvedValue(evidence({ status: 'paid', refunded }));
    expect((await verify()).outcome).toBe(refunded ? 'partial' : 'pending');
    expect(await row()).toMatchObject({ status: 'CAPTURED', refundReservedHalalas: 1800n,
      refundIssue: refunded ? 'refund-partial-needs-review' : 'refund-not-confirmed' });
    expect(await journal()).toBe(0); expect(notifications.create).not.toHaveBeenCalled();
    expect(await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).toMatchObject({ status: 'FAILED', raisedHalalas: 1800n, realizedHalalas: 1800n, backersCount: 1 });
  });
  it.each(['outage', 'stub', 'currency', 'amount'])('rejects %s without changing money or leaking provider content', async mode => {
    if (mode === 'outage') provider.fetchPayment.mockRejectedValue(new Error('private-provider-secret'));
    else provider.fetchPayment.mockResolvedValue(mode === 'stub' ? { status: null } : evidence(mode === 'currency' ? { currency: 'USD' } : { amount: 999 }));
    await expect(verify()).rejects.not.toThrow('private-provider-secret');
    expect(await row()).toMatchObject({ status: 'CAPTURED', refundReservedHalalas: 1800n, refundIssue: 'refund-outcome-unknown' });
    expect(await journal()).toBe(0);
  });
  it('a late pending read cannot overwrite a concurrently confirmed refund', async () => {
    let ready!: () => void, finish!: () => void;
    const started = new Promise<void>(r => { ready = r; }); const gate = new Promise<void>(r => { finish = r; });
    provider.fetchPayment.mockImplementationOnce(async () => { ready(); await gate; return evidence({ status: 'paid', refunded: 0 }); });
    const stale = verify(); const staleResult = expect(stale).rejects.toThrow();
    await started;
    try { await verify(); } finally { finish(); }
    await staleResult;
    expect(await row()).toMatchObject({ status: 'REFUNDED', refundIssue: null }); expect(await journal()).toBe(1);
  });
  it('a confirmed finalization during GET is not applied a second time', async () => {
    provider.fetchPayment.mockImplementationOnce(async () => {
      await db.$transaction(tx => finalizeRefund(tx, pledge, { source: 'confirmed-event-test' }));
      return evidence();
    });
    expect((await verify()).outcome).toBe('confirmed'); expect(await journal()).toBe(1);
    expect(notifications.create).not.toHaveBeenCalled();
  });
  it('journal failure rolls back status, counters and reservation; another GET can recover', async () => {
    const broken = { pledge: db.pledge, $transaction: (fn: (tx: unknown) => Promise<unknown>) => db.$transaction(tx => fn(new Proxy(tx, {
      get(target, key) { if (key === 'ledgerEntry') return { create: async () => { throw new Error('journal failed'); } }; return Reflect.get(target, key); },
    }))) };
    await expect(service(broken).reconcileCapturedRefund(pledge.id)).rejects.toThrow('journal failed');
    expect(await row()).toMatchObject({ status: 'CAPTURED', refundReservedHalalas: 1800n }); expect(await journal()).toBe(0);
    expect((await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).status).toBe('FAILED');
    await verify(); expect(await journal()).toBe(1);
  });
  it('rejects an attempt replaced during GET', async () => {
    provider.fetchPayment.mockImplementationOnce(async () => {
      await db.pledge.update({ where: { id: pledge.id }, data: { refundRequestedAt: new Date(pledge.refundRequestedAt!.getTime() + 1000) } });
      return evidence();
    });
    await expect(verify()).rejects.toThrow(); expect(await journal()).toBe(0); expect((await row()).refundReservedHalalas).toBe(1800n);
  });
  it('does not close a project with another outstanding pledge', async () => {
    await db.pledge.create({ data: { projectId: pledge.projectId, backerId: pledge.backerId, backerNo: 2, amountHalalas: 500n,
      paymentRef: `other-${randomUUID()}`, status: 'HELD' } });
    await verify(); expect((await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).status).toBe('FAILED');
  });
  it.each(['partial', 'missing', 'currency'])('webhook %s cannot bypass full-refund proof', async mode => {
    const data = mode === 'missing' ? { id: pledge.paymentRef } : evidence(mode === 'partial' ? { refunded: 500 } : { currency: 'USD' }).raw;
    const event = { id: randomUUID(), type: 'payment_refunded', data, secret_token: 'local-secret' };
    expect(await webhook().process(event)).toEqual({ outcome: 'mismatch' });
    expect(await row()).toMatchObject({ status: 'CAPTURED', refundReservedHalalas: 1800n }); expect(await journal()).toBe(0);
    const saved = await db.webhookEvent.findUniqueOrThrow({ where: { dedupKey: `moyasar:${event.id}` } });
    expect(JSON.stringify(saved.payload)).not.toContain('local-secret'); expect(JSON.stringify(saved.payload)).not.toContain('never-return');
    expect(await webhook().replayStored(saved.id)).toEqual({ outcome: 'mismatch' });
  });
  it('refund webhook completes accounting and the failed campaign, with no duplicate GET application', async () => {
    const event = { id: randomUUID(), type: 'payment_refunded', data: evidence().raw };
    provider.fetchPayment.mockImplementationOnce(async () => { await webhook().process(event); return evidence(); });
    expect((await verify()).outcome).toBe('confirmed'); expect(await journal()).toBe(1);
    expect((await row()).refundReservedHalalas).toBe(0n);
    expect((await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).status).toBe('REFUNDED');
    expect(await webhook().process(event)).toEqual({ outcome: 'duplicate' });
  });
  it('redelivery uses original stored financial evidence, never a substituted full-refund body', async () => {
    const event = { id: randomUUID(), type: 'payment_refunded', data: evidence({ refunded: 500 }).raw };
    await db.webhookEvent.create({ data: { dedupKey: `moyasar:${event.id}`, eventType: event.type, pspRef: pledge.paymentRef, payload: event } });
    expect(await webhook().process({ ...event, data: evidence().raw })).toEqual({ outcome: 'mismatch' });
    expect(await journal()).toBe(0); expect((await row()).refundReservedHalalas).toBe(1800n);
  });
  it('events without IDs distinguish partial and full refunds instead of deduplicating the final proof away', async () => {
    expect(await webhook().process({ type: 'payment_refunded', data: evidence({ refunded: 500 }).raw })).toEqual({ outcome: 'mismatch' });
    expect(await webhook().process({ type: 'payment_refunded', data: evidence().raw })).toEqual({ outcome: 'applied' });
    expect(await journal()).toBe(1);
  });
});
