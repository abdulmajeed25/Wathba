/* eslint-disable @typescript-eslint/no-explicit-any */
import { OperationsRegistry } from './operations.registry';
import { integrityOps } from './operations/integrity.ops';
import { LedgerService } from '../escrow-payments/ledger.service';
import type { OperationContext } from './operation.types';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Batch OPS-PRO Phase 1 — OPS-INTEGRITY: guard tests for the two repair ops.
 *   webhooks.replay        — event-missing + not-replayable(BNPL) refusals,
 *                            and delegation to WebhookService.replayStored.
 *   money.ledger.backfill  — duplicate-entry refusal, both-ids-missing zod
 *                            refusal, INSERT-only delegation (source
 *                            ops-backfill) and the dryRun row preview.
 */

type Mock = jest.Mock;

function model(): any {
  return {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'row-1', ...data })),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
    groupBy: jest.fn().mockResolvedValue([]),
    aggregate: jest.fn().mockResolvedValue({ _sum: {} }),
  };
}

function buildPrisma(): any {
  const prisma: any = {
    webhookEvent: model(),
    ledgerEntry: model(),
    pledge: model(),
    project: model(),
    operationExecution: model(),
    auditLog: model(),
  };
  prisma.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

const asPrisma = (db: any): PrismaService => db as unknown as PrismaService;

const ctx = (over: Partial<OperationContext> = {}): OperationContext => ({
  actor: { id: 'admin-1', type: 'HUMAN', roles: ['OWNER'], permissions: ['*'] },
  reason: 'سبب اختباري كافٍ للطول لعملية ترميم',
  idempotencyKey: `k-${Math.random()}`,
  stepUpVerifiedAt: new Date(),
  ...over,
});

function regWith(prisma: any, deps: { webhook?: any; ledger?: any } = {}): OperationsRegistry {
  const reg = new OperationsRegistry(asPrisma(prisma));
  reg.permissionPort = { has: () => true };
  for (const op of integrityOps({
    prisma: asPrisma(prisma),
    webhook: deps.webhook ?? { replayStored: jest.fn().mockResolvedValue({ outcome: 'applied' }) },
    ledger: deps.ledger ?? { backfill: jest.fn().mockResolvedValue({ id: 'led-1' }) },
  }))
    reg.register(op);
  return reg;
}

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

describe('webhooks.replay', () => {
  it('refuses when the stored event row is missing (event-missing)', async () => {
    const prisma = buildPrisma();
    prisma.webhookEvent.findUnique.mockResolvedValue(null);
    const reg = regWith(prisma);
    await expect(
      reg.execute('webhooks.replay', { webhookEventId: UUID_A }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'event-missing' }) });
  });

  it('refuses a non-Moyasar (BNPL) event (not-replayable)', async () => {
    const prisma = buildPrisma();
    // event exists but provider !== 'moyasar'
    prisma.webhookEvent.findUnique.mockResolvedValue({ id: UUID_A, provider: 'bnpl' });
    const reg = regWith(prisma);
    await expect(
      reg.execute('webhooks.replay', { webhookEventId: UUID_A }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'not-replayable' }) });
  });

  it('delegates to WebhookService.replayStored with the event id', async () => {
    const prisma = buildPrisma();
    prisma.webhookEvent.findUnique.mockResolvedValue({
      id: UUID_A, provider: 'moyasar', eventType: 'payment_paid', pspRef: 'pay_x', outcome: 'mismatch',
    });
    const webhook = { replayStored: jest.fn().mockResolvedValue({ outcome: 'applied' }) };
    const reg = regWith(prisma, { webhook });
    const out = await reg.execute<{ outcome: string }>(
      'webhooks.replay', { webhookEventId: UUID_A }, ctx(),
    );
    expect(webhook.replayStored).toHaveBeenCalledWith(UUID_A);
    expect(out.result!.outcome).toBe('applied');
  });
});

describe('money.ledger.backfill', () => {
  const goodInput = {
    projectId: UUID_A,
    entryType: 'REFUND',
    amountHalalas: '-12000',
    pspRef: 'pay_gap_1',
    evidenceUrl: 'https://evidence.example/refund/1',
    noteAr: 'قيد استرداد مفقود مؤكّد من كشف المزوّد',
  };

  it('refuses both-ids-missing at the zod gate', async () => {
    const prisma = buildPrisma();
    const reg = regWith(prisma);
    const { projectId: _omit, ...noIds } = goodInput;
    await expect(
      reg.execute('money.ledger.backfill', noIds, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ message: 'مدخلات غير صالحة' }) });
  });

  it('refuses when a matching pspRef+entryType row already exists (duplicate-entry)', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: UUID_A });
    prisma.ledgerEntry.findFirst.mockResolvedValue({ id: 'led-existing' });
    const reg = regWith(prisma);
    await expect(
      reg.execute('money.ledger.backfill', goodInput, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'duplicate-entry' }) });
  });

  it('inserts one bare ledger row via LedgerService.backfill (BigInt-coerced, negative allowed)', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: UUID_A });
    prisma.ledgerEntry.findFirst.mockResolvedValue(null); // no duplicate
    const ledger = { backfill: jest.fn().mockResolvedValue({ id: 'led-new' }) };
    const reg = regWith(prisma, { ledger });
    const out = await reg.execute<{ id: string }>('money.ledger.backfill', goodInput, ctx());
    expect(ledger.backfill).toHaveBeenCalledWith(
      expect.objectContaining({
        entryType: 'REFUND',
        amountHalalas: -12000n,
        pspRef: 'pay_gap_1',
        projectId: UUID_A,
      }),
    );
    expect(out.result!.id).toBe('led-new');
  });

  it('dryRun previews the exact row to be inserted (source ops-backfill) and confirms no duplicate', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: UUID_A });
    prisma.ledgerEntry.findFirst.mockResolvedValue(null);
    const reg = regWith(prisma);
    const dry = await reg.dryRun('money.ledger.backfill', goodInput, ctx());
    expect(dry.ok).toBe(true);
    expect(dry.preview!.after).toMatchObject({
      entryType: 'REFUND',
      amountHalalas: '-12000',
      pspRef: 'pay_gap_1',
      source: 'ops-backfill',
    });
    expect(dry.preview!.before).toMatchObject({ existingMatchingEntry: null });
    // dryRun is pure — it never inserts.
    expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
  });
});

describe('LedgerService.backfill — INSERT-only, source ops-backfill', () => {
  it('creates one LedgerEntry with source ops-backfill and never updates/deletes', async () => {
    const create: Mock = jest.fn().mockResolvedValue({ id: 'led-1' });
    const prisma: any = { ledgerEntry: { create } };
    const svc = new LedgerService(asPrisma(prisma));
    const out = await svc.backfill({
      entryType: 'REFUND' as any,
      amountHalalas: -12000n,
      pspRef: 'pay_gap_1',
      projectId: UUID_B,
    });
    expect(out.id).toBe('led-1');
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entryType: 'REFUND',
        amountHalalas: -12000n,
        pspRef: 'pay_gap_1',
        projectId: UUID_B,
        pledgeId: null,
        source: 'ops-backfill',
      }),
    });
  });
});
