import { randomUUID } from 'node:crypto';
import { PrismaClient, type Pledge } from '@prisma/client';
import { EscrowService } from './escrow.service';
import { WebhookService } from './webhook.service';

const enabled = process.env.WATHBA_CONSENT_DB_TESTS === '1';
if (enabled) {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/wathba_audit') {
    throw new Error('Webhook recovery fixtures require the isolated local audit database');
  }
}
const suite = enabled ? describe : describe.skip;

suite('Webhook redelivery and journal recovery — isolated PostgreSQL', () => {
  const db = new PrismaClient();
  let pledge: Pledge;
  const escrow = () => new EscrowService(db as never, {} as never, {} as never,
    {} as never, {} as never, { get: async () => 72 } as never);
  const webhook = (client: unknown = db) => new WebhookService(client as never,
    {} as never, escrow(), { log: async () => {} } as never,
    { create: async () => {} } as never, { refundCompleted: async () => {} } as never,
    { get: () => 'isolated-webhook-secret' } as never);
  const payload = (type: string, id = randomUUID()) => ({ id, type, data: { id: pledge.paymentRef,
    ...(type === 'payment_refunded' ? { status: 'refunded', amount: 1200, captured: 1200, refunded: 1200, currency: 'SAR' } : { status: type === 'payment_paid' ? 'paid' : 'voided', amount: 1200, captured: type === 'payment_paid' ? 1200 : 0, refunded: 0, currency: 'SAR' }) } });

  beforeAll(async () => { await db.$connect(); });
  afterAll(async () => { await db.$disconnect(); });
  beforeEach(async () => {
    const user = await db.user.create({ data: { totalPledgedHalalas: 1200n, name: 'اختبار استئناف الإشعار', email: `webhook-${randomUUID()}@local.test` } });
    const project = await db.project.create({ data: {
      raisedHalalas: 1200n, backersCount: 1, titleAr: `اختبار الإشعار ${randomUUID()}`, shortDescAr: 'بيانات اختبار معزولة', storyAr: 'لا اتصال بمزود دفع',
      createdById: user.id, fundingGoalHalalas: 100000n, durationDays: 30,
      deadline: new Date(Date.now() - 1000), status: 'SUCCESSFUL',
    } });
    pledge = await db.pledge.create({ data: {
      projectId: project.id, backerId: user.id, backerNo: 1, amountHalalas: 1000n,
      addOnsHalalas: 200n, paymentRef: `recovery-local-${randomUUID()}`, status: 'HELD',
    } });
  });

  it.each([
    ['payment_voided', 'VOID', 'REFUNDED', false],
    ['payment_refunded', 'REFUND', 'REFUNDED', true],
    ['payment_disputed', 'DISPUTE', 'DISPUTED', true],
  ] as const)('%s rolls back a failed journal and finishes on ordinary redelivery', async (type, entryType, target, captured) => {
    if (captured) await escrow().markCaptured(pledge);
    const event = payload(type);
    const client = {
      pledge: db.pledge, webhookEvent: db.webhookEvent,
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => db.$transaction(tx => fn({
        $queryRaw: tx.$queryRaw.bind(tx),
        pledge: tx.pledge,
        ledgerEntry: { create: async () => { throw new Error('test journal unavailable'); } },
      })),
    };
    await expect(webhook(client).process(event)).rejects.toThrow('test journal unavailable');
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).status).toBe(captured ? 'CAPTURED' : 'HELD');
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType } })).toBe(0);
    expect((await db.webhookEvent.findUniqueOrThrow({ where: { dedupKey: `moyasar:${event.id}` } })).processedAt).toBeNull();
    expect(await webhook().process(event)).toEqual({ outcome: 'applied' });
    expect(await webhook().process(event)).toEqual({ outcome: 'duplicate' });
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).status).toBe(target);
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType } })).toBe(1);
  });

  it('recovers a capture when persisting the outcome failed after the financial commit', async () => {
    const event = payload('payment_paid');
    const client = { pledge: db.pledge, webhookEvent: {
      create: db.webhookEvent.create.bind(db.webhookEvent),
      update: async () => { throw new Error('outcome store unavailable'); },
      updateMany: async () => { throw new Error('outcome store unavailable'); },
    } };
    await expect(webhook(client).process(event)).rejects.toThrow('outcome store unavailable');
    expect(await webhook().process(event)).toEqual({ outcome: 'ignored' });
    expect((await db.webhookEvent.findUniqueOrThrow({ where: { dedupKey: `moyasar:${event.id}` } })).processedAt).not.toBeNull();
    expect((await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).realizedHalalas).toBe(1200n);
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'CAPTURE' } })).toBe(1);
  });

  it.each(['payment_refunded', 'payment_disputed'] as const)('%s concurrent deliveries write one transition and one journal entry', async type => {
    await escrow().markCaptured(pledge);
    let reads = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const client = { webhookEvent: db.webhookEvent, $transaction: db.$transaction.bind(db),
      pledge: { findUnique: db.pledge.findUnique.bind(db.pledge), findFirst: async () => {
        const snapshot = await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } });
        if (++reads === 4) release();
        await gate;
        return snapshot;
      } },
    };
    const results = await Promise.all(Array.from({ length: 4 }, () => webhook(client).process(payload(type))));
    expect(results.filter(r => r.outcome === 'applied')).toHaveLength(1);
    expect(results.filter(r => r.outcome === 'ignored')).toHaveLength(3);
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: type === 'payment_refunded' ? 'REFUND' : 'DISPUTE' } })).toBe(1);
  });

  it('uses the saved event identity when an incomplete event is redelivered with a different body', async () => {
    const event = payload('payment_voided');
    await db.webhookEvent.create({ data: { dedupKey: `moyasar:${event.id}`, eventType: event.type,
      pspRef: pledge.paymentRef, payload: event } });
    expect(await webhook().process({ ...event, type: 'payment_paid', data: { id: 'another-payment' } })).toEqual({ outcome: 'applied' });
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).status).toBe('REFUNDED');
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'CAPTURE' } })).toBe(0);
  });

  it('same-event concurrency and a later replay retain the applied outcome and a single journal', async () => {
    const event = payload('payment_voided');
    await Promise.all(Array.from({ length: 4 }, () => webhook().process(event)));
    const saved = await db.webhookEvent.findUniqueOrThrow({ where: { dedupKey: `moyasar:${event.id}` } });
    expect(saved.outcome).toBe('applied');
    expect(saved.processedAt).not.toBeNull();
    expect(await webhook().replayStored(saved.id)).toEqual({ outcome: 'ignored' });
    expect((await db.webhookEvent.findUniqueOrThrow({ where: { id: saved.id } })).outcome).toBe('applied');
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'VOID' } })).toBe(1);
  });

  it('a completed mismatch remains a duplicate until an explicit replay is requested', async () => {
    const event = payload('payment_refunded'); // HELD has not been captured.
    expect(await webhook().process(event)).toEqual({ outcome: 'mismatch' });
    await escrow().markCaptured(pledge);
    expect(await webhook().process(event)).toEqual({ outcome: 'duplicate' });
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).status).toBe('CAPTURED');
    const saved = await db.webhookEvent.findUniqueOrThrow({ where: { dedupKey: `moyasar:${event.id}` } });
    expect(await webhook().replayStored(saved.id)).toEqual({ outcome: 'applied' });
  });

  it('ordinary redelivery recovers a failure reading the pledge after the event was stored', async () => {
    const event = payload('payment_voided');
    const client = { webhookEvent: db.webhookEvent, pledge: {
      findFirst: async () => { throw new Error('pledge read unavailable'); },
    } };
    await expect(webhook(client).process(event)).rejects.toThrow('pledge read unavailable');
    expect(await webhook().process(event)).toEqual({ outcome: 'applied' });
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'VOID' } })).toBe(1);
  });

  it.each(['payment_refunded', 'payment_disputed'] as const)('%s does not overwrite a replacement payment reference', async type => {
    await escrow().markCaptured(pledge);
    const replacement = `replacement-${randomUUID()}`;
    const client = { webhookEvent: db.webhookEvent, $transaction: db.$transaction.bind(db), pledge: {
      findUnique: db.pledge.findUnique.bind(db.pledge),
      findFirst: async () => {
        const snapshot = await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } });
        await db.pledge.update({ where: { id: pledge.id }, data: { paymentRef: replacement } });
        return snapshot;
      },
    } };
    expect(await webhook(client).process(payload(type))).toEqual({ outcome: 'mismatch' });
    expect(await db.pledge.findUnique({ where: { id: pledge.id } })).toMatchObject({ status: 'CAPTURED', paymentRef: replacement });
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: { in: ['REFUND', 'DISPUTE'] } } })).toBe(0);
  });

  it.each(['PENDING_REAUTH', 'CAPTURE_GRACE'] as const)('accepts a confirmed capture from %s exactly once', async status => {
    await db.pledge.update({ where: { id: pledge.id }, data: { status } });
    const event = payload('payment_paid');
    expect(await webhook().process(event)).toEqual({ outcome: 'applied' });
    expect(await webhook().process(event)).toEqual({ outcome: 'duplicate' });
    expect((await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).realizedHalalas).toBe(1200n);
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'CAPTURE' } })).toBe(1);
  });
  it('late capture after failed expiry remains unresolved rather than crediting a released reward', async () => {
    await db.pledge.update({ where: { id: pledge.id }, data: { status: 'FAILED_CAPTURE' } });
    const event = payload('payment_paid');
    await expect(webhook().process(event)).rejects.toThrow('Capture confirmation no longer matches');
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).status).toBe('FAILED_CAPTURE');
    expect((await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).realizedHalalas).toBe(0n);
    expect((await db.webhookEvent.findUniqueOrThrow({ where: { dedupKey: `moyasar:${event.id}` } })).processedAt).toBeNull();
  });

});
