import { MilestonesService } from './milestones.service';
import { PrismaService } from '../prisma/prisma.service';
import { MilestoneStatus, ProjectStatus, type Milestone } from '@prisma/client';

type MockedPrisma = PrismaService & {
  project: { findUnique: jest.Mock; update: jest.Mock };
  milestone: {
    findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock;
    deleteMany: jest.Mock; create: jest.Mock;
  };
  payout: { create: jest.Mock };
  $transaction: jest.Mock;
};

const buildSvc = (
  project: { status: ProjectStatus; raisedHalalas: bigint; createdById: string },
  milestone: Partial<Milestone>,
) => {
  const prisma = {
    project: {
      findUnique: jest.fn().mockResolvedValue({ id: 'p', ...project }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    milestone: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'm', projectId: 'p', order: 1, titleAr: 'الدفعة الأولى',
        releasePct: 30, evidenceRequired: '...', status: MilestoneStatus.APPROVED,
        releasedHalalas: 0n, ...milestone,
      }),
      update: jest.fn().mockResolvedValue({
        id: 'm', projectId: 'p', order: 1, titleAr: 'الدفعة الأولى',
        releasePct: 30, evidenceRequired: '...', status: MilestoneStatus.RELEASED,
        releasedHalalas: (project.raisedHalalas * 30n) / 100n,
        submittedAt: null, approvedAt: null, releasedAt: new Date(), evidenceUrl: null,
      } as unknown as Milestone),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn(),
    },
    payout: { create: jest.fn().mockResolvedValue({ id: 'po-1' }) },
    $transaction: jest.fn(),
  } as unknown as MockedPrisma;
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  (prisma as any).user = { findUnique: jest.fn().mockResolvedValue({ email: 'creator@x.sa' }) };
  // STAKES/S-12 F-08 — named mocks so tests can assert the release notify.
  const notifications = { create: jest.fn().mockResolvedValue(null) };
  const email = { milestoneReleased: jest.fn().mockResolvedValue({}) };
  return Object.assign(new MilestonesService(prisma, notifications as any, email as any), {
    __prisma: prisma,
    __notifications: notifications,
    __email: email,
  });
};

describe('MilestonesService.release', () => {
  it('releases 30% of raised funds', async () => {
    const svc = buildSvc(
      { status: ProjectStatus.FUNDED, raisedHalalas: 100_000_000n, createdById: 'u1' },
      { status: MilestoneStatus.APPROVED, releasePct: 30 },
    );
    const { amountHalalas } = await svc.release('p', 'm');
    expect(amountHalalas).toBe(30_000_000n); // 300,000 SAR
    // Sprint 1 / P0-601 — the release must queue a PENDING payout in-tx.
    const prisma = (svc as unknown as { __prisma: MockedPrisma }).__prisma;
    expect(prisma.payout.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'p',
        creatorId: 'u1',
        milestoneId: 'm',
        amountHalalas: 30_000_000n,
        status: 'PENDING',
      }),
    });
    // STAKES/S-12 F-08 — the creator hears the release (in-app + email).
    await new Promise((r) => setImmediate(r)); // fire-and-forget settles
    const notif = (svc as unknown as { __notifications: { create: jest.Mock } }).__notifications;
    const mail = (svc as unknown as { __email: { milestoneReleased: jest.Mock } }).__email;
    expect(notif.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', kind: 'MILESTONE_APPROVED' }),
    );
    expect(mail.milestoneReleased).toHaveBeenCalledWith('creator@x.sa', expect.objectContaining({ amountHalalas: 30_000_000 }));
  });

  it('rejects release when project not FUNDED/IN_PRODUCTION', async () => {
    const svc = buildSvc(
      { status: ProjectStatus.LIVE, raisedHalalas: 100_000_000n, createdById: 'u1' },
      { status: MilestoneStatus.APPROVED, releasePct: 30 },
    );
    await expect(svc.release('p', 'm')).rejects.toThrow(/must be FUNDED/);
  });

  it('rejects release when milestone not APPROVED', async () => {
    const svc = buildSvc(
      { status: ProjectStatus.FUNDED, raisedHalalas: 100_000_000n, createdById: 'u1' },
      { status: MilestoneStatus.SUBMITTED, releasePct: 30 },
    );
    await expect(svc.release('p', 'm')).rejects.toThrow(/only APPROVED/);
  });
});

describe('MilestonesService.setMilestones', () => {
  it('rejects when releasePct sum != 100', async () => {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p', status: ProjectStatus.DRAFT, raisedHalalas: 0n, createdById: 'u1',
        }),
      },
    } as unknown as PrismaService;
    const svc = new MilestonesService(prisma, { create: jest.fn().mockResolvedValue(null) } as any, { milestoneReleased: jest.fn().mockResolvedValue({}) } as any);
    await expect(
      svc.setMilestones('u1', 'p', {
        milestones: [
          { order: 1, titleAr: 'a', releasePct: 30, evidenceRequired: '...' },
          { order: 2, titleAr: 'b', releasePct: 50, evidenceRequired: '...' },
        ],
      }),
    ).rejects.toThrow(/sum to 100/);
  });
});
