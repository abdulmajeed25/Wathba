import { OperationsRegistry } from '../operations.registry';
import { maintenanceOps } from './maintenance.ops';
import type { OperationContext } from '../operation.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';

/**
 * Batch OPS-PRO Phase 1 — maintenance ops guard tests: faq.question.hide
 * preconditions + transition, and search.reindex issuing REINDEX INDEX
 * CONCURRENTLY on both GIN indexes via a mocked $executeRawUnsafe (the
 * orchestrated path runs on the raw client, outside any transaction).
 *
 * OPS-360 Unit 6 — notifications.resend: missing-notification refusal, dryRun
 * shape/purity, and execute re-delivering a NEW row (same kind + payload) via
 * the notifications outbox on the registry tx.
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
    notification: model(),
    operationExecution: model(),
    auditLog: model(),
    operationProposal: model(),
    $transaction: jest.fn() as Mock,
    $executeRawUnsafe: jest.fn().mockResolvedValue(0) as Mock,
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

const notifications = { create: jest.fn().mockResolvedValue({ id: 'notif-new' }) };

function regWith(prisma: ReturnType<typeof buildPrisma>): OperationsRegistry {
  const reg = new OperationsRegistry(prisma as unknown as PrismaService);
  for (const op of maintenanceOps({
    prisma: prisma as unknown as PrismaService,
    notifications: notifications as unknown as NotificationsService,
  }))
    reg.register(op);
  return reg;
}

beforeEach(() => {
  notifications.create.mockClear();
  notifications.create.mockResolvedValue({ id: 'notif-new' });
});

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

describe('notifications.resend', () => {
  const NOTIF_ID = '22222222-2222-4222-8222-222222222222';
  const USER_ID = '33333333-3333-4333-8333-333333333333';
  // requiresReason: true — the registry enforces a written reason before
  // preconditions run, so every execute path here carries one.
  const reason = 'إعادة إرسال إشعار صرف فات المستخدم — طلب دعم';

  it('refuses a missing notification', async () => {
    const prisma = buildPrisma();
    prisma.notification.findUnique.mockResolvedValue(null);
    await expect(
      regWith(prisma).execute('notifications.resend', { notificationId: NOTIF_ID }, ctx({ reason })),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'notification-missing' }) });
  });

  it('dryRun previews one new row of the same kind without writing', async () => {
    const prisma = buildPrisma();
    prisma.notification.findUnique.mockResolvedValue({
      userId: USER_ID,
      kind: 'PAYOUT_SENT',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const dry = await regWith(prisma).dryRun(
      'notifications.resend',
      { notificationId: NOTIF_ID },
      ctx(),
    );
    expect(dry.ok).toBe(true);
    expect(dry.preview?.after).toEqual({ willCreate: 1, kind: 'PAYOUT_SENT', userId: USER_ID });
    expect(dry.preview?.counts).toEqual({ notificationsToCreate: 1 });
    // purity — no write path touched
    expect(notifications.create).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('resends: re-creates a new row with the same kind + payload via the outbox on tx', async () => {
    const prisma = buildPrisma();
    prisma.notification.findUnique.mockResolvedValue({ id: NOTIF_ID }); // precondition
    prisma.notification.findUniqueOrThrow.mockResolvedValue({
      userId: USER_ID,
      kind: 'PAYOUT_SENT',
      payload: { projectTitleAr: 'مشروع', amountHalalas: 5000 },
    });
    const out = await regWith(prisma).execute(
      'notifications.resend',
      { notificationId: NOTIF_ID },
      ctx({ reason }),
    );
    expect(out.result).toEqual({ resent: true, notificationId: 'notif-new', kind: 'PAYOUT_SENT' });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        kind: 'PAYOUT_SENT',
        payload: { projectTitleAr: 'مشروع', amountHalalas: 5000 },
        tx: prisma, // registry runs the tx callback with the mock prisma itself
      }),
    );
  });

  it('reports resent:false when the outbox suppresses an opted-out engagement kind', async () => {
    const prisma = buildPrisma();
    prisma.notification.findUnique.mockResolvedValue({ id: NOTIF_ID });
    prisma.notification.findUniqueOrThrow.mockResolvedValue({
      userId: USER_ID,
      kind: 'UPDATE_POSTED',
      payload: {},
    });
    notifications.create.mockResolvedValue(null); // gated out
    const out = await regWith(prisma).execute(
      'notifications.resend',
      { notificationId: NOTIF_ID },
      ctx({ reason }),
    );
    expect(out.result).toEqual({ resent: false, notificationId: null, kind: 'UPDATE_POSTED' });
  });
});
