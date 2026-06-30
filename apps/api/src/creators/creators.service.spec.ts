import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { MilestoneStatus, ProjectStatus } from '@prisma/client';
import { CreatorsService } from './creators.service';

/**
 * Unit tests cover the math that's most likely to drift if someone refactors:
 *   - fundedPct rounding (BigInt-safe, one decimal)
 *   - delivered = ALL milestones RELEASED, false when there are none
 *   - 404 when user missing OR has no published projects
 *   - collaborators JSON parsing throws nothing on malformed input
 *   - follow self ⇒ 400, follow then follow ⇒ idempotent
 */

const TARGET = '11111111-1111-1111-1111-111111111111';
const FOLLOWER = '22222222-2222-2222-2222-222222222222';
const PROFILE_ID = '99999999-9999-9999-9999-999999999999';

function makePrisma(over: Partial<Record<string, unknown>> = {}): any {
  // Hand-rolled `any` typing keeps the test concise; PrismaService is too big
  // to mock structurally and recursive arrow definitions hit TS7022.
   
  const prisma: any = {
    user: { findUnique: jest.fn() },
    project: { findMany: jest.fn() },
    creatorProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    creatorFollow: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    ...over,
  };
  prisma.$transaction = jest.fn(
    async (fn: (tx: unknown) => unknown): Promise<unknown> => fn(prisma),
  );
  return prisma;
}

describe('CreatorsService.getProfile', () => {
  const baseUser = {
    id: TARGET,
    name: 'مازن',
    nafathVerified: true,
    creatorProfile: {
      avatarUrl: 'https://x/y.png',
      bioAr: 'صانع تطبيقات',
      websiteUrl: 'https://example.sa',
      collaborators: [{ nameAr: 'أحمد', role: 'مصمم' }, 'junk', { foo: 1 }],
      followersCount: 5,
      createdProjectsCount: 2,
      backedProjectsCount: 7,
      lastSeenAt: new Date('2026-06-29T10:00:00Z'),
    },
  };

  it('rounds fundedPct to one decimal and computes delivered from milestones', async () => {
    const prisma = makePrisma();
    (prisma as any).user.findUnique.mockResolvedValue(baseUser);
    (prisma as any).project.findMany.mockResolvedValue([
      {
        id: 'p1',
        titleAr: 'مشروع أ',
        raisedHalalas: 87_500n,
        fundingGoalHalalas: 100_000n,
        status: ProjectStatus.SUCCESSFUL,
        publishedAt: new Date('2026-01-01T00:00:00Z'),
        milestones: [
          { status: MilestoneStatus.RELEASED },
          { status: MilestoneStatus.RELEASED },
        ],
      },
      {
        id: 'p2',
        titleAr: 'مشروع ب',
        raisedHalalas: 333n,
        fundingGoalHalalas: 1000n,
        status: ProjectStatus.LIVE,
        publishedAt: new Date('2026-02-01T00:00:00Z'),
        milestones: [{ status: MilestoneStatus.APPROVED }],
      },
      {
        id: 'p3',
        titleAr: 'مشروع ج',
        raisedHalalas: 0n,
        fundingGoalHalalas: 0n,
        status: ProjectStatus.FAILED,
        publishedAt: new Date('2026-03-01T00:00:00Z'),
        milestones: [],
      },
    ]);

    const svc = new CreatorsService(prisma);
    const out = await svc.getProfile(TARGET);

    expect(out.userId).toBe(TARGET);
    expect(out.name).toBe('مازن');
    expect(out.nafathVerified).toBe(true);
    expect(out.avatarUrl).toBe('https://x/y.png');
    expect(out.followersCount).toBe(5);
    expect(out.pastProjects).toHaveLength(3);
    // 87_500/100_000 = 87.5
    expect(out.pastProjects[0]?.fundedPct).toBe(87.5);
    expect(out.pastProjects[0]?.delivered).toBe(true);
    // 333/1000 = 33.3 (rounded down at .3)
    expect(out.pastProjects[1]?.fundedPct).toBe(33.3);
    expect(out.pastProjects[1]?.delivered).toBe(false);
    // goal=0 ⇒ 0% with no NaN/Infinity
    expect(out.pastProjects[2]?.fundedPct).toBe(0);
    // empty milestones ⇒ NOT delivered
    expect(out.pastProjects[2]?.delivered).toBe(false);
    // collaborators: keep the one well-formed object, drop the junk
    expect(out.collaborators).toEqual([{ nameAr: 'أحمد', role: 'مصمم' }]);
  });

  it('throws 404 when user missing', async () => {
    const prisma = makePrisma();
    (prisma as any).user.findUnique.mockResolvedValue(null);
    const svc = new CreatorsService(prisma);
    await expect(svc.getProfile(TARGET)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws 404 when user has no published projects', async () => {
    const prisma = makePrisma();
    (prisma as any).user.findUnique.mockResolvedValue(baseUser);
    (prisma as any).project.findMany.mockResolvedValue([]);
    const svc = new CreatorsService(prisma);
    await expect(svc.getProfile(TARGET)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CreatorsService.follow / unfollow', () => {
  it('rejects self-follow with 400', async () => {
    const prisma = makePrisma();
    const svc = new CreatorsService(prisma);
    await expect(svc.follow(TARGET, TARGET)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates the follow row + increments counter on first follow', async () => {
    const prisma = makePrisma();
    (prisma as any).user.findUnique.mockResolvedValue({ id: TARGET });
    (prisma as any).creatorProfile.upsert.mockResolvedValue({
      id: PROFILE_ID,
      followersCount: 3,
    });
    (prisma as any).creatorFollow.findUnique.mockResolvedValue(null);
    (prisma as any).creatorFollow.create.mockResolvedValue({ id: 'f1' });
    (prisma as any).creatorProfile.update.mockResolvedValue({ followersCount: 4 });

    const svc = new CreatorsService(prisma);
    const out = await svc.follow(FOLLOWER, TARGET);
    expect(out).toEqual({ following: true, followersCount: 4 });
    expect((prisma as any).creatorFollow.create).toHaveBeenCalledWith({
      data: { followerId: FOLLOWER, creatorProfileId: PROFILE_ID },
    });
  });

  it('is idempotent — second follow does not double-increment', async () => {
    const prisma = makePrisma();
    (prisma as any).user.findUnique.mockResolvedValue({ id: TARGET });
    (prisma as any).creatorProfile.upsert.mockResolvedValue({
      id: PROFILE_ID,
      followersCount: 4,
    });
    (prisma as any).creatorFollow.findUnique.mockResolvedValue({ id: 'f1' });

    const svc = new CreatorsService(prisma);
    const out = await svc.follow(FOLLOWER, TARGET);
    expect(out).toEqual({ following: true, followersCount: 4 });
    expect((prisma as any).creatorFollow.create).not.toHaveBeenCalled();
    expect((prisma as any).creatorProfile.update).not.toHaveBeenCalled();
  });

  it('unfollow is idempotent when no profile exists', async () => {
    const prisma = makePrisma();
    (prisma as any).creatorProfile.findUnique.mockResolvedValue(null);
    const svc = new CreatorsService(prisma);
    const out = await svc.unfollow(FOLLOWER, TARGET);
    expect(out).toEqual({ following: false, followersCount: 0 });
  });

  it('unfollow decrements counter when row exists', async () => {
    const prisma = makePrisma();
    (prisma as any).creatorProfile.findUnique.mockResolvedValue({
      id: PROFILE_ID,
      followersCount: 4,
    });
    (prisma as any).creatorFollow.deleteMany.mockResolvedValue({ count: 1 });
    (prisma as any).creatorProfile.update.mockResolvedValue({ followersCount: 3 });

    const svc = new CreatorsService(prisma);
    const out = await svc.unfollow(FOLLOWER, TARGET);
    expect(out).toEqual({ following: false, followersCount: 3 });
  });
});
