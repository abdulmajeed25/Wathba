import { OperationsRegistry } from '../operations.registry';
import { maintenanceOps } from './maintenance.ops';
import type { OperationContext } from '../operation.types';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Batch OPS-PRO Phase 1 — maintenance ops guard tests: faq.question.hide
 * preconditions + transition, and search.reindex issuing REINDEX INDEX
 * CONCURRENTLY on both GIN indexes via a mocked $executeRawUnsafe (the
 * orchestrated path runs on the raw client, outside any transaction).
 */

type Mock = jest.Mock;
function model() {
  return {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'exec-1', ...data })),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
  };
}

function buildPrisma() {
  const prisma = {
    faqQuestion: model(),
    operationExecution: model(),
    auditLog: model(),
    operationProposal: model(),
    $transaction: jest.fn() as Mock,
    $executeRawUnsafe: jest.fn().mockResolvedValue(0) as Mock,
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

function regWith(prisma: ReturnType<typeof buildPrisma>): OperationsRegistry {
  const reg = new OperationsRegistry(prisma as unknown as PrismaService);
  for (const op of maintenanceOps({ prisma: prisma as unknown as PrismaService }))
    reg.register(op);
  return reg;
}

const ADMIN: OperationContext['actor'] = { id: 'admin-1', type: 'HUMAN', roles: ['ADMIN'] };
const ctx = (over: Partial<OperationContext> = {}): OperationContext => ({
  actor: ADMIN,
  stepUpVerifiedAt: new Date(),
  ...over,
});

const QUESTION_ID = '11111111-1111-4111-8111-111111111111';

describe('faq.question.hide', () => {
  it('refuses a missing question', async () => {
    const prisma = buildPrisma();
    prisma.faqQuestion.findUnique.mockResolvedValue(null);
    await expect(
      regWith(prisma).execute('faq.question.hide', { questionId: QUESTION_ID }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'question-missing' }) });
  });

  it('refuses an already-hidden question', async () => {
    const prisma = buildPrisma();
    prisma.faqQuestion.findUnique.mockResolvedValue({ id: QUESTION_ID, status: 'HIDDEN' });
    await expect(
      regWith(prisma).execute('faq.question.hide', { questionId: QUESTION_ID }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'already-hidden' }) });
  });

  it('hides: PENDING→HIDDEN', async () => {
    const prisma = buildPrisma();
    prisma.faqQuestion.findUnique.mockResolvedValue({ id: QUESTION_ID, status: 'PENDING' });
    prisma.faqQuestion.update.mockResolvedValue({ id: QUESTION_ID, status: 'HIDDEN' });
    const out = await regWith(prisma).execute(
      'faq.question.hide',
      { questionId: QUESTION_ID },
      ctx(),
    );
    expect(out.result).toEqual({ id: QUESTION_ID, status: 'HIDDEN' });
    expect(prisma.faqQuestion.update).toHaveBeenCalledWith({
      where: { id: QUESTION_ID }, data: { status: 'HIDDEN' },
    });
  });
});

describe('search.reindex', () => {
  it('dryRun names both indexes without issuing any SQL', async () => {
    const prisma = buildPrisma();
    const dry = await regWith(prisma).dryRun('search.reindex', {}, ctx());
    expect(dry.ok).toBe(true);
    expect(dry.preview?.after).toEqual({
      reindexed: ['Project_searchVector_gin', 'Project_titleAr_trgm'],
    });
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('reindexes: issues REINDEX INDEX CONCURRENTLY on both GIN indexes', async () => {
    const prisma = buildPrisma();
    prisma.operationExecution.findUnique.mockResolvedValue(null);
    const out = await regWith(prisma).execute('search.reindex', {}, ctx());
    expect(out.result).toEqual({
      reindexed: ['Project_searchVector_gin', 'Project_titleAr_trgm'],
    });
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      'REINDEX INDEX CONCURRENTLY "Project_searchVector_gin"',
    );
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      'REINDEX INDEX CONCURRENTLY "Project_titleAr_trgm"',
    );
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
  });
});
