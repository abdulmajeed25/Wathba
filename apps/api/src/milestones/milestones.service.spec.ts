import { MilestonesService } from './milestones.service';
import { PrismaService } from '../prisma/prisma.service';
import { MilestoneStatus, ProjectStatus, type Milestone } from '@prisma/client';

/**
 * Tests the milestone state machine and the release-amount math:
 *   amount = raisedHalalas * releasePct / 100
 */

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
        id: 'm',
        projectId: 'p',
        order: 1,
        titleAr: 'الدفعة الأولى',
        releasePct: 30,
        evidenceRequired: '...',
        status: MilestoneStatus.APPROVED,
        releasedHalalas: 0n,
        ...milestone,
      }),
      update: jest.fn().mockResolvedValue({
        id: 'm',
        projectId: 'p',
        order: 1,
        titleAr: 'الدفعة الأولى',
        releasePct: 30,
        evidenceRequired: '...',
        status: MilestoneStatus.RELEASED,
        releasedHalalas: (project.raisedHalalas * 30n) / 100n,
        submittedAt: null,
        approvedAt: null,
        releasedAt: new Date(),
        evidenceUrl: null,
      } as unknown as Milestone),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  } as unknown as PrismaService;
  return new MilestonesService(prisma);
};

describe('MilestonesService.release', () => {
  it('releases 30% of raised funds to milestone', async () => {
    const svc = buildSvc(
      { status: ProjectStatus.FUNDED, raisedHalalas: 100_000_000n, createdById: 'u1' },
      { status: MilestoneStatus.APPROVED, releasePct: 30 },
    );
    const { amountHalalas } = await svc.release('p', 'm');
    expect(amountHalalas).toBe(30_000_000n); // 30% of 1,000,000 SAR = 300,000 SAR
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
  it('rejects when releasePct sums to anything other than 100', async () => {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p',
          status: ProjectStatus.DRAFT,
          raisedHalalas: 0n,
          createdById: 'u1',
        }),
      },
    } as unknown as PrismaService;
    const svc = new MilestonesService(prisma);
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
