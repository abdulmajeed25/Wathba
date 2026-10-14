import { randomUUID } from 'node:crypto';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaClient, type Pledge } from '@prisma/client';
import { EscrowService } from './escrow.service';
import { WebhookService } from './webhook.service';
import { ReauthScheduler } from '../funding/reauth.scheduler';
import { FundingService } from '../funding/funding.service';
import { claimHeldAction, heldAction, type HeldAction } from './held-payment-action';

const enabled = process.env.WATHBA_CONSENT_DB_TESTS === '1';
if (enabled) {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/wathba_audit') {
    throw new Error('Held-action tests require the isolated local audit database');
  }
}
const suite = enabled ? describe : describe.skip;

suite('Held financial attempts — real PostgreSQL, simulated provider', () => {
  const db = new PrismaClient();
  let p: Pledge;
  const provider = { capture: jest.fn(), void: jest.fn(), fetchPayment: jest.fn(), reauthorize: jest.fn(), assertReauthorizationAvailable: jest.fn() };
  const notifications = { create: jest.fn() };
  const service = (client: unknown = db) => new EscrowService(client as never, provider as never, {} as never,
    notifications as never, {} as never, { get: async () => 72 } as never);
  const scheduler = () => new ReauthScheduler({
    $transaction: db.$transaction.bind(db),
    pledge: { updateMany: db.pledge.updateMany.bind(db.pledge), findMany: (args: any) =>
      db.pledge.findMany({ ...args, where: { ...args.where, id: p.id } }) },
  } as never, provider as never, notifications as never, { get: async () => 6 } as never);
  const webhook = () => new WebhookService(db as never, {} as never, service(),
    { log: async () => {} } as never, notifications as never, {} as never, { get: () => 'local-held-test' } as never);
  const current = () => db.pledge.findUniqueOrThrow({ where: { id: p.id } });
  const project = () => db.project.findUniqueOrThrow({ where: { id: p.projectId } });
  const proof = (status: 'authorized' | 'paid' | 'voided') => ({ id: p.paymentRef, status,
    amount: 1800, captured: status === 'paid' ? 1800 : 0, refunded: 0, currency: 'SAR' });
  const claim = (action: HeldAction) => db.$transaction(tx => claimHeldAction(tx, p, action));
  beforeAll(async () => { await db.$connect(); });
  afterAll(async () => { await db.$disconnect(); });
  beforeEach(async () => {
    Object.values(provider).forEach(fn => fn.mockReset()); notifications.create.mockReset();
    provider.capture.mockResolvedValue({ ok: false }); provider.void.mockResolvedValue({ ok: false });
    provider.reauthorize.mockResolvedValue({ ok: false });
    const user = await db.user.create({ data: { name: 'اختبار تعارض العمليات', email: `held-${randomUUID()}@local.test`, totalPledgedHalalas: 1800n } });
    const campaign = await db.project.create({ data: { titleAr: `اختبار محلي ${randomUUID()}`, shortDescAr: 'بيانات اختبار', storyAr: 'مزود محاكى فقط',
      createdById: user.id, fundingGoalHalalas: 100000n, durationDays: 30, deadline: new Date(Date.now() + 7 * 86400000),
      status: 'LIVE', raisedHalalas: 1800n, backersCount: 1 } });
    p = await db.pledge.create({ data: { projectId: campaign.id, backerId: user.id, backerNo: 1,
      amountHalalas: 1200n, addOnsHalalas: 600n, paymentRef: `held-local-${randomUUID()}`, status: 'HELD', createdAt: new Date(Date.now() - 8 * 86400000) } });
  });

  it('simultaneous capture, void and renewal produce exactly one remote request', async () => {
    await Promise.all([service().captureAllHeld(p.projectId), service().voidPledge(p), scheduler().run()]);
    expect(provider.capture.mock.calls.length + provider.void.mock.calls.length + provider.reauthorize.mock.calls.length).toBe(1);
    expect(heldAction((await current()).authorizationIssue)).not.toBeNull();
    expect((await current()).status).toBe('HELD');
    expect(await db.ledgerEntry.count({ where: { pledgeId: p.id } })).toBe(0);
  });

  it.each(['CAPTURE', 'VOID', 'REAUTHORIZE'] as const)('%s owns the pledge before HTTP; conflicting calls and restarts cannot retry', async action => {
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    const fn = action === 'CAPTURE' ? provider.capture : action === 'VOID' ? provider.void : provider.reauthorize;
    fn.mockImplementationOnce(async () => { entered(); await gate; throw new Error('simulated ambiguous timeout'); });
    const first = action === 'CAPTURE' ? service().captureAllHeld(p.projectId) : action === 'VOID' ? service().voidPledge(p) : scheduler().run();
    await started;
    try {
      expect(heldAction((await current()).authorizationIssue)).toBe(action);
      await Promise.all([service().captureAllHeld(p.projectId), service().adminRefundPledge(p.id), scheduler().run()]);
      expect(provider.capture.mock.calls.length + provider.void.mock.calls.length + provider.reauthorize.mock.calls.length).toBe(1);
    } finally { release(); }
    await first;
    await Promise.all([service().captureAllHeld(p.projectId), service().voidPledge(await current()), scheduler().run()]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect((await current()).status).toBe('HELD');
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it.each(['CAPTURE', 'VOID'] as const)('%s completes once using GET proof and concurrent verification', async action => {
    await claim(action); provider.fetchPayment.mockResolvedValue({ raw: proof(action === 'CAPTURE' ? 'paid' : 'voided') });
    const results = await Promise.all([service().reconcileHeldPayment(p.id), service().reconcileHeldPayment(p.id)]);
    expect(results.every(r => r.outcome === 'confirmed')).toBe(true);
    expect(await current()).toMatchObject({ status: action === 'CAPTURE' ? 'CAPTURED' : 'REFUNDED', authorizationIssue: null });
    expect(await db.ledgerEntry.count({ where: { pledgeId: p.id, entryType: action } })).toBe(1);
    expect((await project()).realizedHalalas).toBe(action === 'CAPTURE' ? 1800n : 0n);
    expect((await project()).raisedHalalas).toBe(action === 'CAPTURE' ? 1800n : 0n);
    expect((await db.user.findUniqueOrThrow({ where: { id: p.backerId } })).totalPledgedHalalas).toBe(action === 'CAPTURE' ? 1800n : 0n);
    expect(provider.capture).not.toHaveBeenCalled(); expect(provider.void).not.toHaveBeenCalled();
  });

  it.each(['CAPTURE', 'VOID', 'REAUTHORIZE'] as const)('%s authorized snapshot stays pending and never proves renewal', async action => {
    const key = await claim(action); provider.fetchPayment.mockResolvedValue({ raw: proof('authorized') });
    expect((await service().reconcileHeldPayment(p.id)).outcome).toBe('pending');
    expect(await current()).toMatchObject({ status: 'HELD', authorizationIssue: key, reauthorizedAt: null });
    expect(await db.ledgerEntry.count({ where: { pledgeId: p.id } })).toBe(0);
  });

  it.each([{ amount: 1799 }, { currency: 'USD' }, { id: 'another-payment' }, { captured: 500 }, { refunded: 1 }, { captured: undefined }])('rejects contradictory or incomplete GET proof %j', async patch => {
    const key = await claim('CAPTURE'); provider.fetchPayment.mockResolvedValue({ raw: { ...proof('paid'), ...patch } });
    await expect(service().reconcileHeldPayment(p.id)).rejects.toBeInstanceOf(ConflictException);
    expect((await current()).authorizationIssue).toBe(key); expect((await project()).realizedHalalas).toBe(0n);
  });

  it.each(['CAPTURE', 'VOID'] as const)('%s stale GET cannot complete a replaced attempt with the same payment', async action => {
    await claim(action); const replacement = `payment:${action}:${randomUUID()}`;
    provider.fetchPayment.mockImplementationOnce(async () => {
      await db.pledge.update({ where: { id: p.id }, data: { authorizationIssue: replacement } });
      return { raw: proof(action === 'CAPTURE' ? 'paid' : 'voided') };
    });
    await expect(service().reconcileHeldPayment(p.id)).rejects.toBeInstanceOf(ConflictException);
    expect((await current()).authorizationIssue).toBe(replacement); expect((await project()).realizedHalalas).toBe(0n);
  });

  it('known unsupported renewal is detected before claiming and does not block cancellation', async () => {
    provider.assertReauthorizationAvailable.mockImplementation(() => { throw new ServiceUnavailableException('not integrated'); });
    expect(await scheduler().run()).toEqual({ reauthorized: 0, parked: 1 });
    expect(provider.reauthorize).not.toHaveBeenCalled(); expect((await current()).authorizationIssue).toBeNull();
    provider.void.mockResolvedValue({ ok: true }); expect(await service().voidPledge(await current())).toBe(true);
  });

  it('supported renewal updates its own claim; a late response cannot clear a replacement', async () => {
    provider.reauthorize.mockImplementationOnce(async () => {
      await db.pledge.update({ where: { id: p.id }, data: { authorizationIssue: `payment:VOID:${randomUUID()}` } });
      return { ok: true };
    });
    expect((await scheduler().run()).reauthorized).toBe(0);
    expect((await current()).reauthorizedAt).toBeNull(); expect(heldAction((await current()).authorizationIssue)).toBe('VOID');
  });

  it('successful supported renewal releases only its claim', async () => {
    provider.reauthorize.mockResolvedValue({ ok: true }); const now = new Date();
    expect(await scheduler().run(now)).toEqual({ reauthorized: 1, parked: 0 });
    expect(await current()).toMatchObject({ authorizationIssue: null, reauthorizedAt: now });
    // A previously loaded settlement must not capture a freshly renewed hold.
    expect(await claim('CAPTURE')).toBeNull();
    expect(await claim('VOID')).toBeNull();
    expect(await db.$transaction(tx => claimHeldAction(tx, { ...p, reauthorizedAt: now }, 'VOID'))).not.toBeNull();
  });

  it('journal failure after remote capture retains the claim; GET later repairs the local transaction', async () => {
    provider.capture.mockResolvedValue({ ok: true });
    const broken = { pledge: db.pledge, $transaction: (fn: (tx: unknown) => Promise<unknown>) => db.$transaction(tx => fn(new Proxy(tx, {
      get(target, key) { if (key === 'ledgerEntry') return { create: async () => { throw new Error('test journal failure'); } }; return Reflect.get(target, key); },
    }))) };
    expect(await service(broken).captureAllHeld(p.projectId)).toEqual({ captured: 0, failed: 1 });
    expect((await project()).realizedHalalas).toBe(0n); expect(heldAction((await current()).authorizationIssue)).toBe('CAPTURE');
    provider.fetchPayment.mockResolvedValue({ raw: proof('paid') });
    expect((await service().reconcileHeldPayment(p.id)).outcome).toBe('confirmed');
    expect(provider.capture).toHaveBeenCalledTimes(1); expect((await project()).realizedHalalas).toBe(1800n);
  });

  it('void/failure webhooks cannot clear a capture attempt, and missing capture evidence cannot credit it', async () => {
    const key = await claim('CAPTURE');
    for (const [type, data] of [['payment_voided', proof('voided')], ['payment_failed', { id: p.paymentRef }], ['payment_paid', { id: p.paymentRef }]] as const) {
      expect(await webhook().process({ id: randomUUID(), type, data })).toEqual({ outcome: 'mismatch' });
    }
    expect((await current()).authorizationIssue).toBe(key); expect((await project()).realizedHalalas).toBe(0n);
    expect(await webhook().process({ id: randomUUID(), type: 'payment_paid', data: proof('paid') })).toEqual({ outcome: 'applied' });
    expect((await project()).realizedHalalas).toBe(1800n);
  });

  it('public projection exposes verification state without exposing internal attempt identity', async () => {
    await claim('VOID');
    const publicRow = FundingService.prototype.toPublic.call({}, await current());
    expect(publicRow.paymentVerificationPending).toBe(true); expect(publicRow).not.toHaveProperty('authorizationIssue');
  });

  it.each(['CAPTURE', 'VOID'] as const)('%s financial proof distinguishes no-ID partial and complete webhooks', async action => {
    await claim(action);
    const type = action === 'CAPTURE' ? 'payment_paid' : 'payment_voided';
    const complete = proof(action === 'CAPTURE' ? 'paid' : 'voided');
    expect(await webhook().process({ type, data: { ...complete, amount: 1700 } })).toEqual({ outcome: 'mismatch' });
    expect(await webhook().process({ type, data: complete })).toEqual({ outcome: 'applied' });
    expect(await db.ledgerEntry.count({ where: { pledgeId: p.id, entryType: action } })).toBe(1);
    expect(await db.webhookEvent.count({ where: { pspRef: p.paymentRef } })).toBe(2);
  });
});
