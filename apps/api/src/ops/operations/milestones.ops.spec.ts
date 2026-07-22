import { OperationsRegistry } from '../operations.registry';
import { milestonesOps } from './milestones.ops';
import type { OperationContext } from '../operation.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { EmailService } from '../../email/email.service';

/**
 * Batch OPS-PRO Phase 1 — milestones.evidence.reject guard tests: every
 * precondition refusal, the SUBMITTED→PENDING transition that clears evidence
 * and records feedback, and the MILESTONE_REJECTED afterCommit notification.
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
    project: model(),
    milestone: model(),
    operationExecution: model(),
    auditLog: model(),
    operationProposal: model(),
    $transaction: jest.fn() as Mock,
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

const notifications = { create: jest.fn().mockResolvedValue(null) };
const email = {};

function regWith(prisma: ReturnType<typeof buildPrisma>): OperationsRegistry {
  const reg = new OperationsRegistry(prisma as unknown as PrismaService);
  for (const op of milestonesOps({
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
  reason: 'الدليل غير كافٍ — أعد رفع فاتورة واضحة بالتاريخ',
  ...over,
});

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const MILESTONE_ID = '22222222-2222-4222-8222-222222222222';
const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => notifications.create.mockClear());

describe('milestones.evidence.reject', () => {
  it('refuses a missing project', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue(null);
    await expect(
      regWith(prisma).execute(
        'milestones.evidence.reject',
        { projectId: PROJECT_ID, milestoneId: MILESTONE_ID },
        ctx(),
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'project-missing' }) });
  });

  it('refuses when the milestone is not on the project', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID });
    prisma.milestone.findFirst.mockResolvedValue(null);
    await expect(
      regWith(prisma).execute(
        'milestones.evidence.reject',
        { projectId: PROJECT_ID, milestoneId: MILESTONE_ID },
        ctx(),
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'milestone-missing' }) });
  });

  it('refuses a milestone that is not SUBMITTED', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID });
    prisma.milestone.findFirst.mockResolvedValue({ id: MILESTONE_ID, status: 'APPROVED' });
    await expect(
      regWith(prisma).execute(
        'milestones.evidence.reject',
        { projectId: PROJECT_ID, milestoneId: MILESTONE_ID },
        ctx(),
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'not-submitted' }) });
  });

  it('forces a written reason (the feedback) of ≥10 chars', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID });
    prisma.milestone.findFirst.mockResolvedValue({
      id: MILESTONE_ID, status: 'SUBMITTED', titleAr: 'م', evidenceUrl: 'https://x/1',
    });
    await expect(
      regWith(prisma).execute(
        'milestones.evidence.reject',
        { projectId: PROJECT_ID, milestoneId: MILESTONE_ID },
        ctx({ reason: 'قصير' }),
      ),
    ).rejects.toThrow(/سبباً مكتوباً/);
  });

  it('rejects: SUBMITTED→PENDING, writes feedback, clears evidence + submittedAt, notifies creator', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID });
    prisma.milestone.findFirst.mockResolvedValue({
      id: MILESTONE_ID, status: 'SUBMITTED', titleAr: 'المرحلة الأولى', evidenceUrl: 'https://x/1',
    });
    prisma.milestone.update.mockResolvedValue({
      id: MILESTONE_ID, status: 'PENDING', titleAr: 'المرحلة الأولى',
    });
    prisma.project.findUniqueOrThrow.mockResolvedValue({ createdById: 'creator-1', titleAr: 'مشروع' });
    const out = await regWith(prisma).execute(
      'milestones.evidence.reject',
      { projectId: PROJECT_ID, milestoneId: MILESTONE_ID },
      ctx(),
    );
    expect(out.result).toMatchObject({ id: MILESTONE_ID, status: 'PENDING' });
    expect(prisma.milestone.update).toHaveBeenCalledWith({
      where: { id: MILESTONE_ID },
      data: {
        status: 'PENDING',
        reviewFeedbackAr: 'الدليل غير كافٍ — أعد رفع فاتورة واضحة بالتاريخ',
        evidenceUrl: null,
        submittedAt: null,
      },
    });
    await flush();
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'creator-1', kind: 'MILESTONE_REJECTED' }),
    );
  });
});
