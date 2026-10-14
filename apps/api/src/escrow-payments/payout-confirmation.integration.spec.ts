import { randomUUID } from 'node:crypto';
import { PrismaClient, type Payout } from '@prisma/client';
import { PayoutDisburser } from './payout.disburser';

const enabled = process.env.WATHBA_CONSENT_DB_TESTS === '1';
if (enabled) {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/wathba_audit') {
    throw new Error('Payout fixtures require the isolated local audit database');
  }
}
const suite = enabled ? describe : describe.skip;
suite('Payout confirmation — isolated PostgreSQL and simulated provider', () => {
  const db = new PrismaClient();
  let payout: Payout;
  const notify = { create: jest.fn() }, invoice = { generateForPayout: jest.fn(async () => ({ invoiceNumber: 'local' })) };
  let evidence: Record<string, unknown>;
  let network: jest.SpyInstance;
  const row = () => db.payout.findUniqueOrThrow({ where: { id: payout.id } });
  const entries = () => db.ledgerEntry.findMany({ where: { payoutId: payout.id } });
  function worker(breakJournal = false) {
    const client = { payout: { ...db.payout, findMany: (args: Parameters<typeof db.payout.findMany>[0]) =>
      db.payout.findMany({ ...args, where: { ...args?.where, id: payout.id } }) },
      project: db.project, user: db.user,
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => db.$transaction(tx => fn(breakJournal
        ? new Proxy(tx, { get(target, key) {
          if (key === 'ledgerEntry') return { create: async () => { throw new Error('journal unavailable'); } };
          return Reflect.get(target, key);
        } }) : tx)),
    };
    return new PayoutDisburser(client as never, {} as never, invoice as never, { beat: () => {} } as never,
      { resolveDestination: async () => ({ type: 'wallet', mobile: '0500000000' }) } as never,
      { get: (key: string) => key === 'PAYOUT_PROVIDER_KEY' ? 'isolated-key' : key === 'MOYASAR_PAYOUT_SOURCE_ID' ? 'isolated-source' : undefined } as never,
      { payoutSent: async () => {} } as never, notify as never, { log: async () => {} } as never);
  }
  beforeAll(async () => db.$connect());
  afterAll(async () => db.$disconnect());
  afterEach(() => jest.restoreAllMocks());
  beforeEach(async () => {
    notify.create.mockClear(); invoice.generateForPayout.mockClear();
    const user = await db.user.create({ data: { name: 'تحويل محلي', email: `payout-${randomUUID()}@local.test` } });
    const project = await db.project.create({ data: { createdById: user.id, titleAr: 'اختبار تأكيد تحويل',
      shortDescAr: 'محلي فقط', storyAr: 'لا توجد أموال أو اتصالات حقيقية', fundingGoalHalalas: 100000n,
      durationDays: 30, deadline: new Date(), status: 'FUNDED', realizedHalalas: 100000n } });
    const milestone = await db.milestone.create({ data: { projectId: project.id, order: 1, titleAr: 'دفعة تجريبية',
      releasePct: 100, evidenceRequired: 'اختبار', status: 'RELEASED' } });
    payout = await db.payout.create({ data: { projectId: project.id, creatorId: user.id, milestoneId: milestone.id, amountHalalas: 100000n } });
    evidence = {};
    network = jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.method === 'POST') evidence = { ...JSON.parse(String(init.body)), id: `local-${payout.id}`, status: 'queued' };
      return { ok: true, json: async () => ({ ...evidence }) } as Response;
    });
  });
  it('a deficit discovered before dispatch blocks a queued payout before POST', async () => {
    await db.project.update({ where: { id: payout.projectId }, data: { realizedHalalas: 99999n } });
    expect((await worker().disbursePending()).sent).toBe(0);
    expect(await row()).toMatchObject({ status: 'PENDING', failureReason: 'insufficient-unreserved-funds' });
    expect(network).not.toHaveBeenCalled(); expect(await entries()).toHaveLength(0);
  });
  it('queued then paid: one POST, a saved reference, GET reconciliation, one atomic journal pair', async () => {
    expect(await worker().disbursePending()).toEqual({ sent: 0, failed: 0, pending: 1 });
    expect(await row()).toMatchObject({ status: 'SENDING', providerStatus: 'queued', providerRef: `local-${payout.id}` });
    expect(await entries()).toHaveLength(0); expect(notify.create).not.toHaveBeenCalled();
    await worker().disbursePending(); expect(network).toHaveBeenCalledTimes(1);
    evidence.status = 'paid';
    expect(await worker().reconcilePayout(payout.id)).toEqual({ status: 'SENT', providerStatus: 'paid' });
    expect(network.mock.calls[1][0]).toBe(`https://api.moyasar.com/v1/payout/local-${payout.id}`);
    expect(network.mock.calls[1][1].method).toBeUndefined();
    const journal = await entries(); expect(journal).toHaveLength(2);
    expect(journal.reduce((sum, e) => sum + e.amountHalalas, 0n)).toBe(payout.amountHalalas);
    expect(notify.create).toHaveBeenCalledTimes(1); expect(invoice.generateForPayout).toHaveBeenCalledTimes(1);
  });
  it('concurrent verification cannot duplicate journals or notifications', async () => {
    await worker().disbursePending(); evidence.status = 'paid';
    const outcomes = await Promise.allSettled(Array.from({ length: 4 }, () => worker().reconcilePayout(payout.id)));
    expect(outcomes.some(x => x.status === 'fulfilled')).toBe(true);
    expect((await row()).status).toBe('SENT'); expect(await entries()).toHaveLength(2);
    expect(notify.create).toHaveBeenCalledTimes(1);
    expect(network.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });
  it('journal failure rolls back SENT and project stamp; saved paid evidence can finish through GET', async () => {
    await worker().disbursePending(); evidence.status = 'paid';
    await expect(worker(true).reconcilePayout(payout.id)).rejects.toThrow('journal unavailable');
    expect(await row()).toMatchObject({ status: 'SENDING', providerStatus: 'paid' });
    expect(await entries()).toHaveLength(0); expect(notify.create).not.toHaveBeenCalled();
    expect((await db.project.findUniqueOrThrow({ where: { id: payout.projectId } })).settledAt).toBeNull();
    await worker().reconcilePayout(payout.id);
    expect((await row()).status).toBe('SENT'); expect(await entries()).toHaveLength(2);
    expect(network.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });
  it('unknown outcome cannot re-enter POST queue or be verified without a saved reference', async () => {
    network.mockRejectedValue(new Error('connection ended'));
    await worker().disbursePending(); await worker().disbursePending();
    expect(network).toHaveBeenCalledTimes(1); expect((await row()).status).toBe('SENDING');
    await expect(worker().reconcilePayout(payout.id)).rejects.toThrow('saved provider reference');
    expect(await entries()).toHaveLength(0);
  });
  it.each(['amount', 'currency', 'sequence_number', 'source_id', 'id'])('rejects mismatched %s on verification', async field => {
    await worker().disbursePending(); evidence.status = 'paid'; evidence[field] = field === 'amount' ? 1 : 'mismatch';
    await expect(worker().reconcilePayout(payout.id)).rejects.toThrow('does not match');
    expect((await row()).status).toBe('SENDING'); expect(await entries()).toHaveLength(0);
  });
  it('a stale queued response cannot downgrade stored paid evidence after journal failure', async () => {
    await worker().disbursePending(); evidence.status = 'paid';
    await expect(worker(true).reconcilePayout(payout.id)).rejects.toThrow();
    evidence.status = 'queued'; await worker().reconcilePayout(payout.id);
    expect(await row()).toMatchObject({ status: 'SENDING', providerStatus: 'paid' });
    evidence.status = 'paid'; await worker().reconcilePayout(payout.id);
    expect((await row()).status).toBe('SENT'); expect(await entries()).toHaveLength(2);
  });
});
