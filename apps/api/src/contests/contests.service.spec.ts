/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ContestStatus, PledgeStatus } from '@prisma/client';
import { ContestsService } from './contests.service';

/**
 * ContestsService — Tier 3.8.
 *   - create: assigns roundNum = max+1, enforces ownership + exactly-one prize
 *   - transition: DRAFT→OPEN and OPEN→CLOSED legal moves; other moves 400
 *   - announce: validates winnerBackerIds count vs winnersCount, looks up
 *     backerNo for each, posts pinned creator comment, writes notification
 */

const PROJ = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CREATOR = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const BACKER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const TIER = 'tttttttt-tttt-tttt-tttt-tttttttttttt';

function makePrisma(over: Record<string, any> = {}): any {
  const prisma: any = {
    project: { findUnique: jest.fn() },
    contest: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    contestWinner: { createMany: jest.fn() },
    pledge: { findMany: jest.fn() },
    comment: { create: jest.fn() },
    notification: { createMany: jest.fn() },
    rewardTier: { findUnique: jest.fn() },
    addOn: { findUnique: jest.fn() },
    ...over,
  };
  prisma.$transaction = jest.fn(
    async (fn: (tx: unknown) => unknown): Promise<unknown> => fn(prisma),
  );
  return prisma;
}

describe('ContestsService.create', () => {
  it('assigns roundNum = max+1 + persists exactly-one prize', async () => {
    const create = jest.fn().mockResolvedValue({ id: CID, roundNum: 3, winners: [] });
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ createdById: CREATOR }) },
      contest: {
        findFirst: jest.fn().mockResolvedValue({ roundNum: 2 }),
        create,
      },
      rewardTier: { findUnique: jest.fn().mockResolvedValue({ id: TIER }) },
    });
    const svc = new ContestsService(prisma);
    await svc.create(CREATOR, PROJ, {
      promptAr: 'علّق واربح',
      winnersCount: 1,
      prizeRewardTierId: TIER,
    } as any);
    expect(create.mock.calls[0][0].data.roundNum).toBe(3);
    expect(create.mock.calls[0][0].data.prizeRewardTierId).toBe(TIER);
  });

  it('rejects more than one prize source with 400', async () => {
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ createdById: CREATOR }) },
    });
    const svc = new ContestsService(prisma);
    await expect(
      svc.create(CREATOR, PROJ, {
        promptAr: 'x',
        winnersCount: 1,
        prizeRewardTierId: TIER,
        prizeCustomAr: 'مكافأة خاصة',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-owner with 403', async () => {
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ createdById: CREATOR }) },
    });
    const svc = new ContestsService(prisma);
    await expect(
      svc.create('not-creator', PROJ, {
        promptAr: 'x',
        winnersCount: 1,
        prizeRewardTierId: TIER,
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ContestsService.transition', () => {
  it('DRAFT→OPEN is allowed', async () => {
    const update = jest.fn().mockResolvedValue({ id: CID, status: 'OPEN', winners: [] });
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ createdById: CREATOR }) },
      contest: {
        findUnique: jest.fn().mockResolvedValue({
          id: CID, projectId: PROJ, status: 'DRAFT', startsAt: null,
        }),
        update,
      },
    });
    const svc = new ContestsService(prisma);
    await svc.transition(CREATOR, PROJ, CID, ContestStatus.OPEN);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'OPEN' }),
      }),
    );
  });

  it('CLOSED→OPEN is illegal — 400', async () => {
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ createdById: CREATOR }) },
      contest: {
        findUnique: jest.fn().mockResolvedValue({
          id: CID, projectId: PROJ, status: 'CLOSED', startsAt: new Date(),
        }),
        update: jest.fn(),
      },
    });
    const svc = new ContestsService(prisma);
    await expect(
      svc.transition(CREATOR, PROJ, CID, ContestStatus.OPEN),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ContestsService.announce', () => {
  const baseContest = {
    id: CID,
    projectId: PROJ,
    status: 'CLOSED' as const,
    winnersCount: 1,
    promptAr: 'علّق',
    roundNum: 1,
    prizeRewardTierId: TIER,
    prizeAddOnId: null,
    prizeCustomAr: null,
    startsAt: new Date(),
    endsAt: new Date(),
    announcedAt: null,
    announcementCommentId: null,
  };

  it('rejects when winnerBackerIds length ≠ winnersCount', async () => {
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ createdById: CREATOR }) },
      contest: { findUnique: jest.fn().mockResolvedValue(baseContest) },
    });
    const svc = new ContestsService(prisma);
    await expect(
      svc.announce(CREATOR, PROJ, CID, { winnerBackerIds: [BACKER, 'another'] } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when contest is not CLOSED', async () => {
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ createdById: CREATOR }) },
      contest: { findUnique: jest.fn().mockResolvedValue({ ...baseContest, status: 'OPEN' }) },
    });
    const svc = new ContestsService(prisma);
    await expect(
      svc.announce(CREATOR, PROJ, CID, { winnerBackerIds: [BACKER] } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when a winner is not a CAPTURED backer on this project', async () => {
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ createdById: CREATOR }) },
      contest: { findUnique: jest.fn().mockResolvedValue(baseContest) },
      pledge: { findMany: jest.fn().mockResolvedValue([]) }, // no CAPTURED pledge
    });
    const svc = new ContestsService(prisma);
    await expect(
      svc.announce(CREATOR, PROJ, CID, { winnerBackerIds: [BACKER] } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('on success writes a pinned creator comment + CONTEST_ANNOUNCED notifs', async () => {
    const commentCreate = jest.fn().mockResolvedValue({ id: 'auto-comment' });
    const notifCreate = jest.fn();
    const winnerCreate = jest.fn();
    const contestUpdate = jest.fn().mockResolvedValue({
      ...baseContest,
      status: 'ANNOUNCED',
      announcedAt: new Date(),
      winners: [{ backerId: BACKER, backerNo: 7 }],
    });
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ createdById: CREATOR }) },
      contest: {
        findUnique: jest.fn().mockResolvedValue(baseContest),
        update: contestUpdate,
      },
      pledge: {
        findMany: jest.fn().mockResolvedValue([
          { backerId: BACKER, backerNo: 7, status: PledgeStatus.CAPTURED },
        ]),
      },
      comment: { create: commentCreate },
      // Service writes one notification per winner directly via tx.notification.create
      notification: { create: notifCreate },
      contestWinner: { create: winnerCreate, createMany: jest.fn() },
    });
    const svc = new ContestsService(prisma);
    await svc.announce(CREATOR, PROJ, CID, { winnerBackerIds: [BACKER] } as any);
    expect(commentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isCreator: true,
          pinned: true,
          userId: CREATOR,
        }),
      }),
    );
    expect(notifCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: BACKER, kind: 'CONTEST_ANNOUNCED' }),
      }),
    );
  });
});
