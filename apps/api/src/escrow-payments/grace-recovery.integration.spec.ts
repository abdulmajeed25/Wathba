import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { PrismaClient, type Pledge } from '@prisma/client';
import { EscrowService } from './escrow.service';
import { GraceScheduler } from '../funding/grace.scheduler';
import { heldAction } from './held-payment-action';

const enabled = process.env.WATHBA_CONSENT_DB_TESTS === '1';
if (enabled) {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/wathba_audit') throw new Error('Isolated audit DB required');
}
const suite = enabled ? describe : describe.skip;
suite('Grace recovery and replacement card — PostgreSQL, simulated provider', () => {
  const db = new PrismaClient(); let p: Pledge;
  const provider = { hold: jest.fn(), capture: jest.fn(), fetchPayment: jest.fn(), reauthorize: jest.fn(), assertReauthorizationAvailable: jest.fn() };
  const service = (client: unknown = db) => new EscrowService(client as never, provider as never, {} as never, {} as never, {} as never, {} as never);
  const current = () => db.pledge.findUniqueOrThrow({ where: { id: p.id } });
  const tier = () => db.rewardTier.findUniqueOrThrow({ where: { id: p.tierId! } });
  const evidence = (status: string, ref = p.paymentRef) => ({ id: ref, status, amount: 1800, currency: 'SAR', captured: ['paid', 'captured'].includes(status) ? 1800 : 0, refunded: 0 });
  const expired = () => db.pledge.update({ where: { id: p.id }, data: { graceExpiresAt: new Date(Date.now() - 1000) } });
  const failed = async () => {
    p = await db.pledge.update({ where: { id: p.id }, data: { status: 'FAILED_CAPTURE' } });
    await db.rewardTier.update({ where: { id: p.tierId! }, data: { claimedQty: 0 } });
  };
  const scheduler = () => new GraceScheduler({ pledge: {
    findMany: (args: any) => db.pledge.findMany({ ...args, where: { ...args.where, id: p.id } }),
  } } as never, service(), provider as never, { captureFailed: async () => {} } as never,
    { create: async () => {} } as never, { log: async () => {} } as never);
  beforeAll(async () => { await db.$connect(); }); afterAll(async () => { await db.$disconnect(); });
  beforeEach(async () => {
    Object.values(provider).forEach(fn => fn.mockReset());
    const u = await db.user.create({ data: { name: 'اختبار مهلة الدفع', email: `grace-${randomUUID()}@local.test`, totalPledgedHalalas: 1800n } });
    const c = await db.project.create({ data: { createdById: u.id, titleAr: `اختبار ${randomUUID()}`, shortDescAr: 'معزول', storyAr: 'لا أموال حقيقية', status: 'SUCCESSFUL',
      deadline: new Date(Date.now() - 86400000), durationDays: 30, fundingGoalHalalas: 1000n, raisedHalalas: 1800n, backersCount: 1 } });
    const t = await db.rewardTier.create({ data: { projectId: c.id, titleAr: 'مكافأة', descAr: 'اختبار', amountHalalas: 1800n,
      claimedQty: 1, limitQty: 1, estDeliveryDate: new Date() } });
    p = await db.pledge.create({ data: { projectId: c.id, backerId: u.id, tierId: t.id, backerNo: 1, status: 'CAPTURE_GRACE',
      paymentMethod: 'CARD', amountHalalas: 1200n, addOnsHalalas: 600n, paymentRef: `grace-local-${randomUUID()}`,
      graceStartedAt: new Date(Date.now() - 7 * 3600000), graceExpiresAt: new Date(Date.now() + 86400000), captureAttempts: 1 } });
    provider.fetchPayment.mockImplementation(async (ref: string) => ({ raw: evidence('authorized', ref) }));
    provider.capture.mockResolvedValue({ ok: true }); provider.reauthorize.mockResolvedValue({ ok: true });
    provider.hold.mockImplementation(async (r: { givenId: string }) => ({ paymentRef: r.givenId, status: 'authorized', raw: evidence('authorized', r.givenId) }));
  });

  it('scheduler and admin recovery race sends one capture and preserves stock', async () => {
    await Promise.all([scheduler().run(), service().retryCaptureCohort(p.projectId, { includeFailed: false })]);
    expect(provider.capture).toHaveBeenCalledTimes(1); expect((await current()).status).toBe('CAPTURED'); expect((await tier()).claimedQty).toBe(1);
    expect(await db.ledgerEntry.count({ where: { pledgeId: p.id, entryType: 'CAPTURE' } })).toBe(1);
  });

  it.each(['timeout', 'false'])('ambiguous capture %s survives scheduler restart and expiry without release', async mode => {
    if (mode === 'timeout') provider.capture.mockRejectedValue(new Error('lost response')); else provider.capture.mockResolvedValue({ ok: false });
    expect(await service().captureGracePledge(p)).toBe(false);
    await scheduler().run(); await expired(); await scheduler().run();
    expect(provider.capture).toHaveBeenCalledTimes(1); expect(heldAction((await current()).authorizationIssue)).toBe('CAPTURE'); expect((await tier()).claimedQty).toBe(1);
    provider.fetchPayment.mockResolvedValue({ raw: evidence('paid') });
    expect((await service().reconcileHeldPayment(p.id)).outcome).toBe('confirmed'); expect((await current()).status).toBe('CAPTURED');
  });

  it.each(['authorized', 'initiated', 'expired'])('deadline alone and %s do not prove expiry', async status => {
    const row = await expired(); provider.fetchPayment.mockResolvedValue({ raw: evidence(status) });
    expect(await service().expireGracePledge(row, new Date())).toBe(false); expect((await tier()).claimedQty).toBe(1); expect((await current()).status).toBe('CAPTURE_GRACE');
  });

  it('two verified expiry sweeps release exactly one tier and preserve historical funding counters', async () => {
    const row = await expired(); provider.fetchPayment.mockResolvedValue({ raw: evidence('failed') });
    expect((await Promise.all([service().expireGracePledge(row, new Date()), service().expireGracePledge(row, new Date())])).filter(Boolean)).toHaveLength(1);
    expect((await current()).status).toBe('FAILED_CAPTURE'); expect((await tier()).claimedQty).toBe(0);
    expect((await db.project.findUniqueOrThrow({ where: { id: p.projectId } })).raisedHalalas).toBe(1800n);
    await expect(service().markCaptured(p)).rejects.toBeInstanceOf(ConflictException);
  });

  it('late captured evidence credits the pledge instead of freeing its reward', async () => {
    const row = await expired(); provider.fetchPayment.mockResolvedValue({ raw: evidence('paid') });
    expect(await service().expireGracePledge(row, new Date())).toBe(false); expect((await current()).status).toBe('CAPTURED'); expect((await tier()).claimedQty).toBe(1);
  });

  it('missing inventory rolls back expiry rather than going negative', async () => {
    const row = await expired(); await db.rewardTier.update({ where: { id: p.tierId! }, data: { claimedQty: 0 } });
    provider.fetchPayment.mockResolvedValue({ raw: evidence('voided') });
    await expect(service().expireGracePledge(row, new Date())).rejects.toBeInstanceOf(ConflictException); expect((await current()).status).toBe('CAPTURE_GRACE');
  });

  it('new card stores a known reference and audit before POST, then captures the full amount once', async () => {
    provider.fetchPayment.mockResolvedValue({ raw: evidence('failed') });
    provider.hold.mockImplementationOnce(async (r: { givenId: string; source: string }) => {
      expect(await current()).toMatchObject({ paymentRef: r.givenId, authorizationIssue: `payment:AUTHORIZE:${r.givenId}` });
      const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: p.id, action: 'payment.source-replacement.started' } });
      expect(audit.detail).toMatchObject({ previousPaymentRef: p.paymentRef, paymentRef: r.givenId });
      expect(JSON.stringify(audit.detail)).not.toContain('secret-test-token');
      return { paymentRef: r.givenId, status: 'authorized', raw: evidence('authorized', r.givenId) };
    });
    expect(await service().captureWithNewSource(p, 'secret-test-token', 'اختبار')).toBe(true);
    expect(provider.capture).toHaveBeenCalledWith((await current()).paymentRef, 1800n); expect(provider.hold).toHaveBeenCalledTimes(1);
    expect((await current()).status).toBe('CAPTURED'); expect((await tier()).claimedQty).toBe(1);
  });

  it('double card submission and a simultaneous capture cannot send two payments', async () => {
    provider.fetchPayment.mockResolvedValue({ raw: evidence('failed') });
    await Promise.all([service().captureWithNewSource(p, 'a', 'test'), service().captureWithNewSource(p, 'b', 'test'), service().captureGracePledge(p)]);
    expect(provider.hold).toHaveBeenCalledTimes(1); expect(provider.capture).toHaveBeenCalledTimes(1);
  });

  it.each(['authorized', 'paid', 'initiated', 'expired'])('does not charge a replacement over an old %s payment', async status => {
    provider.fetchPayment.mockResolvedValue({ raw: evidence(status) });
    expect(await service().captureWithNewSource(p, 'a', 'test')).toBe(false);
    expect(provider.hold).not.toHaveBeenCalled(); expect((await current()).paymentRef).toBe(p.paymentRef);
  });

  it('lost authorization response retains its reference and resumes with GET plus one governed capture', async () => {
    provider.fetchPayment.mockResolvedValue({ raw: evidence('failed') }); provider.hold.mockRejectedValueOnce(new Error('lost response'));
    expect(await service().captureWithNewSource(p, 'a', 'test')).toBe(false);
    const row = await current(); expect(heldAction(row.authorizationIssue)).toBe('AUTHORIZE');
    expect(await service().captureWithNewSource(row, 'b', 'test')).toBe(false); expect(provider.hold).toHaveBeenCalledTimes(1);
    provider.fetchPayment.mockResolvedValue({ raw: evidence('authorized', row.paymentRef) });
    expect((await service().reconcileHeldPayment(p.id)).outcome).toBe('pending'); expect(provider.capture).not.toHaveBeenCalled();
    const result = await Promise.allSettled([service().resumeReplacementCapture(p.id), service().resumeReplacementCapture(p.id)]);
    expect(result.some(r => r.status === 'fulfilled')).toBe(true); expect(provider.capture).toHaveBeenCalledTimes(1); expect((await current()).status).toBe('CAPTURED');
  });

  it('failed replacement GET clears only its known uncharged attempt for a later user choice', async () => {
    provider.fetchPayment.mockResolvedValue({ raw: evidence('failed') }); provider.hold.mockRejectedValue(new Error('lost'));
    await service().captureWithNewSource(p, 'a', 'test'); const row = await current();
    provider.fetchPayment.mockResolvedValue({ raw: evidence('failed', row.paymentRef) });
    expect((await service().reconcileHeldPayment(p.id)).outcome).toBe('uncharged'); expect((await current()).authorizationIssue).toBeNull();
    expect(provider.capture).not.toHaveBeenCalled(); expect((await tier()).claimedQty).toBe(1);
  });

  it('authorization success followed by lost capture response is recoverable without a new card request', async () => {
    provider.fetchPayment.mockResolvedValue({ raw: evidence('failed') }); provider.capture.mockRejectedValue(new Error('lost capture'));
    expect(await service().captureWithNewSource(p, 'a', 'test')).toBe(false); const row = await current();
    expect(heldAction(row.authorizationIssue)).toBe('CAPTURE'); provider.fetchPayment.mockResolvedValue({ raw: evidence('paid', row.paymentRef) });
    expect((await service().reconcileHeldPayment(p.id)).outcome).toBe('confirmed'); expect(provider.hold).toHaveBeenCalledTimes(1); expect(provider.capture).toHaveBeenCalledTimes(1);
  });

  it('expired grace refuses a new card before provider access', async () => {
    const row = await expired(); expect(await service().captureWithNewSource(row, 'a', 'test')).toBe(false); expect(provider.fetchPayment).not.toHaveBeenCalled(); expect(provider.hold).not.toHaveBeenCalled();
  });

  it('unsupported revival does not reserve inventory or call the provider', async () => {
    await failed(); provider.assertReauthorizationAvailable.mockImplementation(() => { throw new Error('not supported'); });
    expect((await service().reviveFailedPledge(p.id)).reason).toBe('renewal-integration-unavailable'); expect((await tier()).claimedQty).toBe(0); expect(provider.reauthorize).not.toHaveBeenCalled();
  });

  it('concurrent supported revivals reserve one reward and send one renewal/capture', async () => {
    await failed(); await Promise.all([service().reviveFailedPledge(p.id), service().reviveFailedPledge(p.id)]);
    expect(provider.reauthorize).toHaveBeenCalledTimes(1); expect(provider.capture).toHaveBeenCalledTimes(1); expect((await tier()).claimedQty).toBe(1); expect((await current()).status).toBe('CAPTURED');
  });

  it('sold-out reward rolls back revival before any provider call', async () => {
    await failed(); await db.rewardTier.update({ where: { id: p.tierId! }, data: { claimedQty: 1 } });
    expect((await service().reviveFailedPledge(p.id)).reason).toBe('tier-stock-exhausted'); expect((await current()).status).toBe('FAILED_CAPTURE'); expect(provider.reauthorize).not.toHaveBeenCalled();
  });

  it('unknown renewal retains inventory and blocks the next scheduler, revive and card request', async () => {
    await failed(); provider.reauthorize.mockRejectedValue(new Error('lost renewal'));
    expect((await service().reviveFailedPledge(p.id)).status).toBe('CAPTURE_GRACE'); expect((await tier()).claimedQty).toBe(1);
    await scheduler().run(); await service().reviveFailedPledge(p.id); await service().captureWithNewSource(await current(), 'a', 'test');
    expect(provider.reauthorize).toHaveBeenCalledTimes(1); expect(provider.hold).not.toHaveBeenCalled(); expect(provider.capture).not.toHaveBeenCalled();
  });
  it.each(['wrong-ref', 'wrong-amount', 'initiated', 'missing-proof'])('replacement %s never proceeds to capture', async mode => {
    provider.fetchPayment.mockResolvedValue({ raw: evidence('failed') });
    provider.hold.mockImplementation(async (r: { givenId: string }) => ({ raw: mode === 'missing-proof' ? {} : {
      ...evidence(mode === 'initiated' ? 'initiated' : 'authorized', mode === 'wrong-ref' ? 'other' : r.givenId),
      ...(mode === 'wrong-amount' ? { amount: 1700 } : {}),
    } }));
    expect(await service().captureWithNewSource(p, 'a', 'test')).toBe(false);
    expect(provider.capture).not.toHaveBeenCalled(); expect(heldAction((await current()).authorizationIssue)).toBe('AUTHORIZE');
  });

  it('failure to persist the replacement audit rolls back its reference before any POST', async () => {
    provider.fetchPayment.mockResolvedValue({ raw: evidence('failed') });
    const client = { $transaction: (fn: (tx: unknown) => Promise<unknown>) => db.$transaction(tx => fn({
      $queryRaw: tx.$queryRaw.bind(tx), pledge: tx.pledge, auditLog: { create: async () => { throw new Error('audit unavailable'); } },
    })) };
    await expect(service(client).captureWithNewSource(p, 'a', 'test')).rejects.toThrow('audit unavailable');
    expect(provider.hold).not.toHaveBeenCalled(); expect((await current()).paymentRef).toBe(p.paymentRef); expect((await current()).authorizationIssue).toBeNull();
  });

  it('journal failure after authorization is recovered by GET and one continuation capture', async () => {
    provider.fetchPayment.mockResolvedValue({ raw: evidence('failed') });
    const client = { $transaction: (fn: (tx: unknown) => Promise<unknown>) => db.$transaction(tx => fn({
      $queryRaw: tx.$queryRaw.bind(tx), pledge: tx.pledge, auditLog: tx.auditLog,
      ledgerEntry: { create: async () => { throw new Error('journal unavailable'); } },
    })) };
    expect(await service(client).captureWithNewSource(p, 'a', 'test')).toBe(false); const row = await current();
    expect(heldAction(row.authorizationIssue)).toBe('AUTHORIZE'); expect(provider.capture).not.toHaveBeenCalled();
    provider.fetchPayment.mockResolvedValue({ raw: evidence('authorized', row.paymentRef) });
    await service().resumeReplacementCapture(p.id);
    expect(provider.hold).toHaveBeenCalledTimes(1); expect(provider.capture).toHaveBeenCalledTimes(1);
    expect(await db.ledgerEntry.count({ where: { pledgeId: p.id, entryType: 'HOLD_AUTHORIZED' } })).toBe(1);
    expect((await current()).status).toBe('CAPTURED');
  });

  it('an unlimited reward can be reclaimed once during supported revival', async () => {
    await failed(); await db.rewardTier.update({ where: { id: p.tierId! }, data: { limitQty: null } });
    expect((await service().reviveFailedPledge(p.id)).ok).toBe(true); expect((await tier()).claimedQty).toBe(1);
  });

});
