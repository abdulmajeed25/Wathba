import { OperationsRegistry } from '../operations.registry';
import { appealsOps } from './appeals.ops';
import type { OperationContext } from '../operation.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { EmailService } from '../../email/email.service';

/**
 * Batch OPS-GAPS R1 — the adjudication guard tests: claim/decide precondition
 * refusals, the FOUR-EYES self-review refusal (recovered from a mocked
 * AuditLog lookup), the OVERTURNED compensating transitions (unban / project
 * back to review), UPHELD no-compensation, PARTIALLY_GRANTED downgrade, and
 * the APPEAL_DECIDED afterCommit email.
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
    appeal: model(),
    user: model(),
    project: model(),
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

function regWith(prisma: ReturnType<typeof buildPrisma>): OperationsRegistry {
  const reg = new OperationsRegistry(prisma as unknown as PrismaService);
  reg.permissionPort = { has: () => true };
  for (const op of appealsOps({
    prisma: prisma as unknown as PrismaService,
    notifications: notifications as unknown as NotificationsService,
    email: email as unknown as EmailService,
  }))
    reg.register(op);
  return reg;
}

const ADMIN: OperationContext['actor'] = { id: 'admin-1', type: 'HUMAN', roles: ['ADMIN'] };
const ctx = (over: Partial<OperationContext> = {}): OperationContext => ({
  actor: ADMIN,
  stepUpVerifiedAt: new Date(),
  reason: 'راجعتُ الحيثيات وقرار الحسم مبني على المستندات المرفقة',
  ...over,
});

const APPEAL_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const APPELLANT_ID = '44444444-4444-4444-8444-444444444444';
const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  notifications.create.mockClear();
  email.appealDecided.mockClear();
});

/* ── appeals.claim ──────────────────────────────────────────────────────── */
describe('appeals.claim', () => {
  it('refuses an appeal that is not SUBMITTED (not-claimable)', async () => {
    const prisma = buildPrisma();
    prisma.appeal.findUnique.mockResolvedValue({
      status: 'UNDER_REVIEW',
      kind: 'ACCOUNT_BAN',
      subjectId: USER_ID,
    });
    await expect(
      regWith(prisma).execute('appeals.claim', { appealId: APPEAL_ID }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'not-claimable' }) });
  });

  it('claims a SUBMITTED appeal: SUBMITTED → UNDER_REVIEW', async () => {
    const prisma = buildPrisma();
    prisma.appeal.findUnique.mockResolvedValue({
      status: 'SUBMITTED',
      kind: 'ACCOUNT_BAN',
      subjectId: USER_ID,
    });
    prisma.auditLog.findFirst.mockResolvedValue({ actorId: 'someone-else' });
    prisma.appeal.update.mockResolvedValue({ status: 'UNDER_REVIEW' });
    const out = await regWith(prisma).execute('appeals.claim', { appealId: APPEAL_ID }, ctx());
    expect(out.result).toMatchObject({ status: 'UNDER_REVIEW' });
    expect(prisma.appeal.update).toHaveBeenCalledWith({
      where: { id: APPEAL_ID },
      data: { status: 'UNDER_REVIEW' },
      select: { status: true },
    });
  });
});

/* ── appeals.decide — preconditions ─────────────────────────────────────── */
describe('appeals.decide — preconditions', () => {
  it('refuses when the appeal is not UNDER_REVIEW (not-under-review)', async () => {
    const prisma = buildPrisma();
    prisma.appeal.findUnique.mockResolvedValue({
      status: 'SUBMITTED',
      kind: 'ACCOUNT_BAN',
      subjectId: USER_ID,
    });
    await expect(
      regWith(prisma).execute(
        'appeals.decide',
        { appealId: APPEAL_ID, outcome: 'UPHELD', decisionReason: 'القرار قائم بعد المراجعة' },
        ctx(),
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'not-under-review' }) });
  });

  it('FOUR-EYES: refuses the original decider (self-review) via the AuditLog lookup', async () => {
    const prisma = buildPrisma();
    prisma.appeal.findUnique.mockResolvedValue({
      status: 'UNDER_REVIEW',
      kind: 'ACCOUNT_BAN',
      subjectId: USER_ID,
    });
    // The ban was issued by admin-1 — the very actor now trying to decide.
    prisma.auditLog.findFirst.mockResolvedValue({ actorId: 'admin-1' });
    await expect(
      regWith(prisma).execute(
        'appeals.decide',
        { appealId: APPEAL_ID, outcome: 'OVERTURNED', decisionReason: 'الحظر كان بلا سند كافٍ' },
        ctx(),
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'self-review' }) });
    // The AuditLog was queried for the ORIGINAL ban action on the subject.
    expect(prisma.auditLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { action: 'ops.moderation.user.ban', entity: 'User', entityId: USER_ID },
      }),
    );
  });
});

/* ── appeals.decide — execute + compensation ────────────────────────────── */
describe('appeals.decide — outcomes', () => {
  const underReview = (kind: string, subjectId: string) => {
    const prisma = buildPrisma();
    prisma.appeal.findUnique.mockResolvedValue({ status: 'UNDER_REVIEW', kind, subjectId });
    prisma.auditLog.findFirst.mockResolvedValue({ actorId: 'someone-else' });
    prisma.appeal.findUniqueOrThrow.mockResolvedValue({
      kind,
      subjectId,
      submittedById: APPELLANT_ID,
    });
    prisma.user.findUnique.mockResolvedValue({ email: 'appellant@example.sa' });
    return prisma;
  };

  it('OVERTURNED (ACCOUNT_BAN): clears the suspension (unban) in the same tx', async () => {
    const prisma = underReview('ACCOUNT_BAN', USER_ID);
    const out = await regWith(prisma).execute(
      'appeals.decide',
      { appealId: APPEAL_ID, outcome: 'OVERTURNED', decisionReason: 'الحظر كان بلا سند كافٍ' },
      ctx(),
    );
    expect(out.result).toMatchObject({ status: 'OVERTURNED', compensation: 'account-unbanned' });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { suspendedAt: null, suspendedKind: null, suspendedReasonAr: null },
    });
    expect(prisma.appeal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: APPEAL_ID },
        data: expect.objectContaining({ status: 'OVERTURNED', decidedById: 'admin-1' }),
      }),
    );
  });

  it('OVERTURNED (PROJECT_REJECTION): sends the project back to review in the same tx', async () => {
    const prisma = underReview('PROJECT_REJECTION', PROJECT_ID);
    const out = await regWith(prisma).execute(
      'appeals.decide',
      { appealId: APPEAL_ID, outcome: 'OVERTURNED', decisionReason: 'الرفض غير مبرر فنياً' },
      ctx(),
    );
    expect(out.result).toMatchObject({ compensation: 'project-returned-to-review' });
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: PROJECT_ID },
      data: { status: 'UNDER_REVIEW', reviewFeedback: null },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('UPHELD: no compensation — neither user nor project is touched', async () => {
    const prisma = underReview('ACCOUNT_BAN', USER_ID);
    const out = await regWith(prisma).execute(
      'appeals.decide',
      { appealId: APPEAL_ID, outcome: 'UPHELD', decisionReason: 'الحظر قائم — المخالفة موثّقة' },
      ctx(),
    );
    expect(out.result).toMatchObject({ status: 'UPHELD', compensation: null });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('PARTIALLY_GRANTED (ACCOUNT_BAN): downgrades the ban to an administrative suspension', async () => {
    const prisma = underReview('ACCOUNT_BAN', USER_ID);
    const out = await regWith(prisma).execute(
      'appeals.decide',
      { appealId: APPEAL_ID, outcome: 'PARTIALLY_GRANTED', decisionReason: 'المخالفة أخف من الحظر الدائم' },
      ctx(),
    );
    expect(out.result).toMatchObject({ compensation: 'ban-downgraded-to-suspension' });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { suspendedKind: 'SUSPENDED' },
    });
  });

  it('afterCommit: emails the appellant APPEAL_DECIDED with the outcome + reason', async () => {
    const prisma = underReview('ACCOUNT_BAN', USER_ID);
    await regWith(prisma).execute(
      'appeals.decide',
      { appealId: APPEAL_ID, outcome: 'OVERTURNED', decisionReason: 'الحظر كان بلا سند كافٍ' },
      ctx(),
    );
    await flush();
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: APPELLANT_ID, kind: 'APPEAL_DECIDED' }),
    );
    expect(email.appealDecided).toHaveBeenCalledWith(
      'appellant@example.sa',
      expect.objectContaining({ reasonAr: 'الحظر كان بلا سند كافٍ' }),
    );
  });
});
