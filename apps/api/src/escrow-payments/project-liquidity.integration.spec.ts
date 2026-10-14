import { randomUUID } from 'node:crypto';
import { PrismaClient, type Pledge } from '@prisma/client';
import { EscrowService } from './escrow.service';
import { moneyOps } from '../ops/operations/money.ops';
import { finalizeRefund } from './refund-finalization';
import { availableProjectFunds } from './project-liquidity';

const enabled = process.env.WATHBA_CONSENT_DB_TESTS === '1';
if (enabled) {
  const u = new URL(process.env.DATABASE_URL ?? '');
  if (u.hostname !== '127.0.0.1' || u.port !== '55432' || u.pathname !== '/wathba_audit') throw new Error('Isolated local database only');
}
const suite = enabled ? describe : describe.skip;
suite('Refund reservations versus milestone release — isolated PostgreSQL', () => {
  const db = new PrismaClient();
  let pledge: Pledge, milestoneId: string;
  const provider = { refund: jest.fn(async () => ({ ok: true })), void: jest.fn() };
  const service = (client: unknown = db) => new EscrowService(client as never, provider as never, {} as never,
    { create: async () => {} } as never, { refundCompleted: async () => {} } as never, {} as never);
  const release = (id = milestoneId) => {
    const op = moneyOps({ prisma: db, funding: {}, disburser: {}, escrow: {}, moyasar: {}, zatca: {}, notifications: {}, email: {} } as never)
      .find(o => o.key === 'money.milestone.release')!;
    return db.$transaction(tx => op.execute(tx, op.inputSchema.parse({ projectId: pledge.projectId, milestoneId: id }), {} as never));
  };
  const row = () => db.pledge.findUniqueOrThrow({ where: { id: pledge.id } });
  const journal = () => db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'REFUND' } });
  beforeAll(async () => db.$connect());
  afterAll(async () => db.$disconnect());
  beforeEach(async () => {
    provider.refund.mockReset().mockResolvedValue({ ok: true }); provider.void.mockReset();
    const user = await db.user.create({ data: { name: 'اختبار سيولة', email: `liquidity-${randomUUID()}@local.test`, totalPledgedHalalas: 10000n } });
    const project = await db.project.create({ data: { createdById: user.id, titleAr: 'سيولة محلية', shortDescAr: 'اختبار', storyAr: 'محاكاة دون أموال حقيقية',
      fundingGoalHalalas: 10000n, durationDays: 30, deadline: new Date(), status: 'FUNDED', raisedHalalas: 10000n, realizedHalalas: 10000n, backersCount: 1 } });
    pledge = await db.pledge.create({ data: { projectId: project.id, backerId: user.id, backerNo: 1, amountHalalas: 10000n,
      paymentRef: `liquidity-${randomUUID()}`, status: 'CAPTURED', capturedAt: new Date() } });
    const milestone = await db.milestone.create({ data: { projectId: project.id, order: 1, titleAr: 'مرحلة', releasePct: 100, evidenceRequired: 'اختبار', status: 'APPROVED' } });
    milestoneId = milestone.id;
  });
  it('a refund reserves funds BEFORE waiting on the provider; release cannot use them', async () => {
    let started!: () => void, finish!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const gate = new Promise<void>(resolve => { finish = resolve; });
    provider.refund.mockImplementationOnce(async () => { started(); await gate; return { ok: true }; });
    const refund = service().adminRefundPledge(pledge.id);
    await ready;
    try {
      expect((await row()).refundReservedHalalas).toBe(10000n);
      expect(await availableProjectFunds(db, pledge.projectId)).toBe(0n);
      await expect(release()).rejects.toMatchObject({ response: expect.objectContaining({ code: 'insufficient-unreserved-funds' }) });
      expect(await db.payout.count({ where: { projectId: pledge.projectId } })).toBe(0);
    } finally { finish(); }
    expect((await refund).ok).toBe(true);
    expect(await row()).toMatchObject({ status: 'REFUNDED', refundReservedHalalas: 0n, refundIssue: null });
    expect(await journal()).toBe(1);
  });
  it('release winning first prevents captured refund before the provider call', async () => {
    await release();
    expect(await service().adminRefundPledge(pledge.id)).toMatchObject({ ok: false, failureReason: 'insufficient-unreserved-funds' });
    expect(provider.refund).not.toHaveBeenCalled(); expect((await row()).refundRequestedAt).toBeNull();
  });
  it('concurrent duplicate refunds make one provider call and one accounting change', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => service().adminRefundPledge(pledge.id)));
    expect(results.filter(r => r.ok)).toHaveLength(1); expect(provider.refund).toHaveBeenCalledTimes(1);
    expect(await journal()).toBe(1); expect((await row()).refundReservedHalalas).toBe(0n);
  });
  it.each(['timeout', 'unconfirmed'])('%s retains the reservation across service recreation and never auto retries', async mode => {
    if (mode === 'timeout') provider.refund.mockRejectedValueOnce(new Error('timeout'));
    else provider.refund.mockResolvedValueOnce({ ok: false });
    expect((await service().adminRefundPledge(pledge.id)).ok).toBe(false);
    expect(await row()).toMatchObject({ status: 'CAPTURED', refundReservedHalalas: 10000n, refundIssue: 'refund-outcome-unknown' });
    expect((await service().adminRefundPledge(pledge.id)).ok).toBe(false);
    await expect(release()).rejects.toMatchObject({ response: expect.objectContaining({ code: 'insufficient-unreserved-funds' }) });
    expect(provider.refund).toHaveBeenCalledTimes(1); expect(await journal()).toBe(0);
    expect(await db.$transaction(tx => finalizeRefund(tx, pledge, { source: 'confirmed-provider-test' }))).toBe('applied');
    expect((await row()).refundReservedHalalas).toBe(0n); expect(await journal()).toBe(1);
  });
  it('provider success followed by journal failure keeps its reservation for reconciliation', async () => {
    let transactions = 0;
    const broken = { pledge: db.pledge, $transaction: (fn: (tx: unknown) => Promise<unknown>) => {
      transactions++;
      return db.$transaction(tx => fn(transactions === 2 ? new Proxy(tx, { get(target, key) {
        if (key === 'ledgerEntry') return { create: async () => { throw new Error('journal failure'); } };
        return Reflect.get(target, key);
      } }) : tx));
    } };
    await expect(service(broken).adminRefundPledge(pledge.id)).rejects.toThrow('journal failure');
    expect(await row()).toMatchObject({ status: 'CAPTURED', refundReservedHalalas: 10000n });
    await expect(release()).rejects.toThrow(); expect(await journal()).toBe(0);
    await db.$transaction(tx => finalizeRefund(tx, pledge, { source: 'confirmed-provider-test' }));
    expect((await row()).refundReservedHalalas).toBe(0n); expect(await journal()).toBe(1);
    expect(provider.refund).toHaveBeenCalledTimes(1);
  });
  it('same milestone released concurrently creates exactly one payout', async () => {
    const results = await Promise.allSettled([release(), release(), release()]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.payout.count({ where: { projectId: pledge.projectId } })).toBe(1);
  });
  it('two approved 60% milestones cannot spend 120% of realized funds', async () => {
    await db.milestone.update({ where: { id: milestoneId }, data: { releasePct: 60 } });
    const second = await db.milestone.create({ data: { projectId: pledge.projectId, order: 2, titleAr: 'ثانية', releasePct: 60, evidenceRequired: 'محلي', status: 'APPROVED' } });
    const results = await Promise.allSettled([release(), release(second.id)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await availableProjectFunds(db, pledge.projectId)).toBe(4000n);
  });
  it('parallel refunds of distinct pledges compete for the same remaining liquidity', async () => {
    await db.pledge.update({ where: { id: pledge.id }, data: { amountHalalas: 5000n } });
    const second = await db.pledge.create({ data: { projectId: pledge.projectId, backerId: pledge.backerId, backerNo: 2,
      amountHalalas: 5000n, status: 'CAPTURED', capturedAt: new Date(), paymentRef: `second-${randomUUID()}` } });
    await db.milestone.update({ where: { id: milestoneId }, data: { releasePct: 50 } });
    await release();
    const results = await Promise.all([service().adminRefundPledge(pledge.id), service().adminRefundPledge(second.id)]);
    expect(results.filter(r => r.ok)).toHaveLength(1); expect(provider.refund).toHaveBeenCalledTimes(1);
    expect(await availableProjectFunds(db, pledge.projectId)).toBe(0n);
  });
  it('payout creation failure rolls back the milestone so a valid retry remains possible', async () => {
    const op = moneyOps({ prisma: db } as never).find(o => o.key === 'money.milestone.release')!;
    await expect(db.$transaction(tx => op.execute(new Proxy(tx, { get(target, key) {
      if (key === 'payout') return { ...target.payout, create: async () => { throw new Error('payout write failed'); } };
      return Reflect.get(target, key);
    } }), op.inputSchema.parse({ projectId: pledge.projectId, milestoneId }), {} as never))).rejects.toThrow('payout write failed');
    expect((await db.milestone.findUniqueOrThrow({ where: { id: milestoneId } })).status).toBe('APPROVED');
    expect(await availableProjectFunds(db, pledge.projectId)).toBe(10000n);
    await release(); expect(await db.payout.count({ where: { projectId: pledge.projectId } })).toBe(1);
  });
});
