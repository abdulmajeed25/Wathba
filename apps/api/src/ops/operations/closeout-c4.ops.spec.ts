import { OperationsRegistry } from '../operations.registry';
import { appealsOps } from './appeals.ops';
import { ROLE_MATRIX, ALL_PERMISSIONS, permissionMatches } from '../permissions';
import type { OperationContext } from '../operation.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { EmailService } from '../../email/email.service';

/**
 * Batch CLOSEOUT C4 — the appeals gaps left by OPS-GAPS R1.
 *
 *  1. CONTENT_TAKEDOWN — a hidden comment is an enforcement action, and it was
 *     the one an appellant had no route to contest. Overturning it must restore
 *     the comment inside the same governed tx, and four-eyes must recover the
 *     HIDING moderator (not a banning/rejecting one) from the audit ledger.
 *  2. trust.appeals — adjudication rode `moderation.queue`, so appeals access
 *     could not be granted without the whole moderation surface.
 */

type Mock = jest.Mock;
function model() {
  return {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
  };
}

function buildPrisma() {
  const prisma = {
    appeal: model(),
    user: model(),
    project: model(),
    comment: model(),
    auditLog: model(),
    operationExecution: model(),
    operationProposal: model(),
    $transaction: jest.fn() as Mock,
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

const notifications = { create: jest.fn().mockResolvedValue(null) };
const email = { appealDecided: jest.fn().mockResolvedValue(undefined) };

function regWith(
  prisma: ReturnType<typeof buildPrisma>,
  permissions: string[] = ['*'],
): OperationsRegistry {
  const reg = new OperationsRegistry(prisma as unknown as PrismaService);
  reg.permissionPort = { has: (_actor: unknown, required: string) =>
    permissionMatches(permissions, required) };
  for (const op of appealsOps({
    prisma: prisma as unknown as PrismaService,
    notifications: notifications as unknown as NotificationsService,
    email: email as unknown as EmailService,
  }))
    reg.register(op);
  return reg;
}

const APPEAL_ID = '33333333-3333-4333-8333-333333333333';
const COMMENT_ID = '55555555-5555-4555-8555-555555555555';
const ACTOR_ID = 'admin-1';
const ctx = (over: Partial<OperationContext> = {}): OperationContext => ({
  actor: { id: ACTOR_ID, type: 'HUMAN', roles: ['ADMIN'] },
  stepUpVerifiedAt: new Date(),
  reason: 'راجعتُ التعليق ولا يخالف السياسة — يُعاد إظهاره',
  ...over,
});

beforeEach(() => {
  notifications.create.mockClear();
  email.appealDecided.mockClear();
});

/* ── C4.1 — the dedicated trust.appeals permission ──────────────────────── */
describe('trust.appeals — a permission of its own', () => {
  it('is in the catalog and held by OWNER (*), OPS_MANAGER and MODERATOR', () => {
    expect(ALL_PERMISSIONS).toContain('trust.appeals');
    const holders = ROLE_MATRIX.filter((r) =>
      permissionMatches(r.permissions, 'trust.appeals'),
    ).map((r) => r.key);
    expect(holders).toEqual(expect.arrayContaining(['OWNER', 'OPS_MANAGER', 'MODERATOR']));
    // A reviewer/analyst must NOT reach the appeals queue.
    expect(holders).not.toContain('REVIEWER');
    expect(holders).not.toContain('ANALYST');
  });

  it('both appeals ops declare trust.appeals, not moderation.queue', () => {
    const keys = appealsOps({
      prisma: buildPrisma() as unknown as PrismaService,
      notifications: notifications as unknown as NotificationsService,
      email: email as unknown as EmailService,
    });
    for (const op of keys) {
      expect(op.permission).toBe('trust.appeals');
    }
  });

  it('refuses an actor holding only moderation.queue', async () => {
    const prisma = buildPrisma();
    prisma.appeal.findUnique.mockResolvedValue({
      status: 'UNDER_REVIEW',
      kind: 'CONTENT_TAKEDOWN',
      subjectId: COMMENT_ID,
    });
    await expect(
      regWith(prisma, ['moderation.queue']).execute(
        'appeals.decide',
        { appealId: APPEAL_ID, outcome: 'UPHELD', decisionReason: 'القرار سليم ويبقى قائماً' },
        ctx(),
      ),
    ).rejects.toBeDefined();
  });
});

/* ── C4.2 — CONTENT_TAKEDOWN adjudication ───────────────────────────────── */
describe('appeals.decide — CONTENT_TAKEDOWN', () => {
  const underReview = {
    status: 'UNDER_REVIEW',
    kind: 'CONTENT_TAKEDOWN',
    subjectId: COMMENT_ID,
    submittedById: 'author-1',
  };

  it('OVERTURNED restores the comment in the same governed tx', async () => {
    const prisma = buildPrisma();
    prisma.appeal.findUnique.mockResolvedValue(underReview);
    prisma.appeal.findUniqueOrThrow.mockResolvedValue(underReview);
    prisma.auditLog.findFirst.mockResolvedValue({ actorId: 'someone-else' });

    const out = await regWith(prisma).execute(
      'appeals.decide',
      { appealId: APPEAL_ID, outcome: 'OVERTURNED', decisionReason: 'التعليق لا يخالف السياسة' },
      ctx(),
    );

    expect(prisma.comment.update).toHaveBeenCalledWith({
      where: { id: COMMENT_ID },
      data: { hidden: false },
    });
    expect(out.result).toMatchObject({ compensation: 'comment-unhidden' });
  });

  it('UPHELD leaves the comment hidden (no compensation)', async () => {
    const prisma = buildPrisma();
    prisma.appeal.findUnique.mockResolvedValue(underReview);
    prisma.appeal.findUniqueOrThrow.mockResolvedValue(underReview);
    prisma.auditLog.findFirst.mockResolvedValue({ actorId: 'someone-else' });

    const out = await regWith(prisma).execute(
      'appeals.decide',
      { appealId: APPEAL_ID, outcome: 'UPHELD', decisionReason: 'التعليق مخالف — يبقى مخفياً' },
      ctx(),
    );

    expect(prisma.comment.update).not.toHaveBeenCalled();
    expect(out.result).toMatchObject({ compensation: null });
  });

  it('PARTIALLY_GRANTED notes a remedy but does NOT restore the comment', async () => {
    const prisma = buildPrisma();
    prisma.appeal.findUnique.mockResolvedValue(underReview);
    prisma.appeal.findUniqueOrThrow.mockResolvedValue(underReview);
    prisma.auditLog.findFirst.mockResolvedValue({ actorId: 'someone-else' });

    const out = await regWith(prisma).execute(
      'appeals.decide',
      {
        appealId: APPEAL_ID,
        outcome: 'PARTIALLY_GRANTED',
        decisionReason: 'يُحرَّر التعليق ويُعاد نشره بصيغة معدّلة بعد التواصل',
      },
      ctx(),
    );

    expect(prisma.comment.update).not.toHaveBeenCalled();
    expect(out.result).toMatchObject({ compensation: 'takedown-upheld-with-remedy-noted' });
  });

  it('FOUR EYES — the moderator who HID the comment cannot judge the appeal', async () => {
    const prisma = buildPrisma();
    prisma.appeal.findUnique.mockResolvedValue(underReview);
    // The audit ledger names THIS actor as the one who hid it.
    prisma.auditLog.findFirst.mockResolvedValue({ actorId: ACTOR_ID });

    await expect(
      regWith(prisma).execute(
        'appeals.decide',
        { appealId: APPEAL_ID, outcome: 'OVERTURNED', decisionReason: 'أرى أن الإخفاء كان خطأً' },
        ctx(),
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'self-review' }) });

    expect(prisma.comment.update).not.toHaveBeenCalled();
  });

  it('four-eyes reads the COMMENT takedown audit row, not a ban/reject row', async () => {
    const prisma = buildPrisma();
    prisma.appeal.findUnique.mockResolvedValue(underReview);
    prisma.appeal.findUniqueOrThrow.mockResolvedValue(underReview);
    prisma.auditLog.findFirst.mockResolvedValue({ actorId: 'someone-else' });

    await regWith(prisma).execute(
      'appeals.decide',
      { appealId: APPEAL_ID, outcome: 'UPHELD', decisionReason: 'القرار سليم ويبقى قائماً' },
      ctx(),
    );

    expect(prisma.auditLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: 'ops.moderation.comment.moderate',
          entity: 'Comment',
          entityId: COMMENT_ID,
        }),
      }),
    );
  });
});
