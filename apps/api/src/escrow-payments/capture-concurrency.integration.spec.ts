import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { PrismaClient, type Pledge } from '@prisma/client';
import { EscrowService } from './escrow.service';
import { WebhookService } from './webhook.service';

const enabled = process.env.WATHBA_CONSENT_DB_TESTS === '1';
if (enabled) {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/wathba_audit') {
    throw new Error('Capture fixtures require the isolated local audit database');
  }
}
const suite = enabled ? describe : describe.skip;

suite('Capture confirmation — PostgreSQL atomicity', () => {
  const db = new PrismaClient();
  let pledge: Pledge;
  const makeService = (client: unknown = db, provider: unknown = {}) => new EscrowService(
    client as never, provider as never, {} as never, {} as never, {} as never,
    { get: async () => 72 } as never,
  );
  const makeWebhook = (client: unknown = db) => new WebhookService(
    client as never, {} as never, makeService(), { log: async () => {} } as never,
    { create: async () => {} } as never, { refundCompleted: async () => {} } as never,
    { get: () => 'local-test-secret' } as never,
  );
  beforeAll(async () => { await db.$connect(); });
  afterAll(async () => { await db.$disconnect(); });
  beforeEach(async () => {
    const user = await db.user.create({ data: { totalPledgedHalalas: 1200n, name: 'اختبار تحصيل معزول', email: `capture-${randomUUID()}@local.test` } });
    const project = await db.project.create({ data: {
      raisedHalalas: 1200n, backersCount: 1, titleAr: `اختبار التحصيل ${randomUUID()}`, shortDescAr: 'معزول', storyAr: 'لا اتصال بمزود دفع',
      createdById: user.id, fundingGoalHalalas: 100000n, durationDays: 30,
      deadline: new Date(Date.now() - 1000), status: 'SUCCESSFUL',
    } });
    pledge = await db.pledge.create({ data: {
      projectId: project.id, backerId: user.id, backerNo: 1,
      amountHalalas: 1000n, addOnsHalalas: 200n,
      paymentRef: `capture-local-${randomUUID()}`, status: 'HELD',
    } });
  });

  it('concurrent sync/webhook confirmations credit one balance and one journal row', async () => {
    const service = makeService();
    await Promise.all(Array.from({ length: 6 }, (_, i) => service.markCaptured(pledge,
      { source: i % 2 ? 'webhook' : 'sync-path' })));
    expect(await db.pledge.findUnique({ where: { id: pledge.id } })).toMatchObject({ status: 'CAPTURED' });
    expect((await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).realizedHalalas).toBe(1200n);
    const rows = await db.ledgerEntry.findMany({ where: { pledgeId: pledge.id, entryType: 'CAPTURE' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amountHalalas).toBe(1200n);
  });

  it.each(['PENDING_REAUTH', 'CAPTURE_GRACE'] as const)('retains the existing %s confirmation path', async status => {
    await db.pledge.update({ where: { id: pledge.id }, data: { status } });
    await makeService().markCaptured(pledge);
    expect((await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).realizedHalalas).toBe(1200n);
  });

  it('a stale confirmation cannot overwrite a voided pledge or a replaced payment reference', async () => {
    await db.pledge.update({ where: { id: pledge.id }, data: { status: 'REFUNDED' } });
    await expect(makeService().markCaptured(pledge)).rejects.toBeInstanceOf(ConflictException);
    await db.pledge.update({ where: { id: pledge.id }, data: { status: 'HELD', paymentRef: `replacement-${randomUUID()}` } });
    await expect(makeService().markCaptured(pledge)).rejects.toBeInstanceOf(ConflictException);
    expect((await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).realizedHalalas).toBe(0n);
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id } })).toBe(0);
  });

  it('a late duplicate after capture and refund does not restore the refunded balance', async () => {
    const service = makeService();
    await service.markCaptured(pledge);
    await db.$transaction(async tx => {
      await tx.pledge.update({ where: { id: pledge.id }, data: { status: 'REFUNDED', refundedAt: new Date() } });
      await tx.project.update({ where: { id: pledge.projectId }, data: { realizedHalalas: { decrement: 1200n } } });
    });
    await service.markCaptured(pledge);
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).status).toBe('REFUNDED');
    expect((await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).realizedHalalas).toBe(0n);
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'CAPTURE' } })).toBe(1);
  });

  it('journal failure rolls back status and balance, without misreporting provider success as grace', async () => {
    const client = {
      pledge: db.pledge,
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => db.$transaction(tx => fn({
        $queryRaw: tx.$queryRaw.bind(tx),
        pledge: tx.pledge, project: tx.project,
        ledgerEntry: { create: async () => { throw new Error('journal unavailable'); } },
      })),
    };
    expect(await makeService(client, { capture: async () => ({ ok: true }) }).captureAllHeld(pledge.projectId))
      .toEqual({ captured: 0, failed: 1 });
    expect(await db.pledge.findUnique({ where: { id: pledge.id } })).toMatchObject({ status: 'HELD', capturedAt: null, graceStartedAt: null });
    expect((await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).realizedHalalas).toBe(0n);
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id } })).toBe(0);
    await makeService().markCaptured(pledge);
    expect((await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).realizedHalalas).toBe(1200n);
  });

  it('a late failed provider attempt cannot move a concurrently confirmed capture into grace', async () => {
    const service = makeService(db, { capture: async () => {
      await makeService().markCaptured(pledge, { source: 'webhook' });
      return { ok: false };
    } });
    await service.captureAllHeld(pledge.projectId);
    expect(await db.pledge.findUnique({ where: { id: pledge.id } })).toMatchObject({ status: 'CAPTURED', graceStartedAt: null });
    expect((await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).realizedHalalas).toBe(1200n);
  });

  it.each(['payment_failed', 'payment_voided'])('%s cannot overwrite a capture committed after its initial read', async type => {
    const client = {
      webhookEvent: db.webhookEvent,
      pledge: {
        findUnique: db.pledge.findUnique.bind(db.pledge),
        updateMany: db.pledge.updateMany.bind(db.pledge),
        findFirst: async () => {
          const stale = await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } });
          await makeService().markCaptured(stale);
          return stale;
        },
      },
      $transaction: db.$transaction.bind(db),
    };
    const result = await makeWebhook(client).process({ id: randomUUID(), type, data: { id: pledge.paymentRef, status: 'voided', amount: 1200, captured: 0, refunded: 0, currency: 'SAR' } });
    expect(result.outcome).toBe('mismatch');
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).status).toBe('CAPTURED');
    expect((await db.project.findUniqueOrThrow({ where: { id: pledge.projectId } })).realizedHalalas).toBe(1200n);
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'VOID' } })).toBe(0);
  });

  it('concurrent void events with distinct event IDs write only one VOID journal entry', async () => {
    const service = makeWebhook();
    const results = await Promise.all(Array.from({ length: 4 }, () => service.process({
      id: randomUUID(), type: 'payment_voided', data: { id: pledge.paymentRef, status: 'voided', amount: 1200, captured: 0, refunded: 0, currency: 'SAR' },
    })));
    expect(results.filter(r => r.outcome === 'applied')).toHaveLength(1);
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).status).toBe('REFUNDED');
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'VOID' } })).toBe(1);
  });

  it('void journal failure rolls back the transition and a stored-event replay can finish it', async () => {
    const client = {
      pledge: db.pledge, webhookEvent: db.webhookEvent,
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => db.$transaction(tx => fn({
        $queryRaw: tx.$queryRaw.bind(tx),
        pledge: tx.pledge,
        ledgerEntry: { create: async () => { throw new Error('void journal unavailable'); } },
      })),
    };
    const id = randomUUID();
    await expect(makeWebhook(client).process({ id, type: 'payment_voided', data: { id: pledge.paymentRef, status: 'voided', amount: 1200, captured: 0, refunded: 0, currency: 'SAR' } }))
      .rejects.toThrow('void journal unavailable');
    expect((await db.pledge.findUniqueOrThrow({ where: { id: pledge.id } })).status).toBe('HELD');
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id } })).toBe(0);
    const event = await db.webhookEvent.findUniqueOrThrow({ where: { dedupKey: `moyasar:${id}` } });
    expect(event.processedAt).toBeNull();
    expect((await makeWebhook().replayStored(event.id)).outcome).toBe('applied');
    expect(await db.ledgerEntry.count({ where: { pledgeId: pledge.id, entryType: 'VOID' } })).toBe(1);
  });
});
