/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import { ProjectsService } from './projects.service';

/**
 * ProjectsService.completeDelivery — Sprint 0 / P0-402.
 * IN_PRODUCTION → DELIVERED terminal transition:
 *   - owner + IN_PRODUCTION + zero unreleased milestones → DELIVERED
 *   - any unreleased milestone → 400
 *   - wrong status → 400
 *   - non-owner → 403
 */

const PROJ = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CREATOR = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function makePrisma(over: Record<string, any> = {}): any {
  return {
    project: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    milestone: {
      count: jest.fn(),
    },
    ...over,
  };
}

function proj(status: ProjectStatus): any {
  return { id: PROJ, createdById: CREATOR, status };
}

describe('ProjectsService.completeDelivery', () => {
  it('marks DELIVERED when IN_PRODUCTION and all milestones RELEASED', async () => {
    const update = jest
      .fn()
      .mockResolvedValue(proj(ProjectStatus.DELIVERED));
    const prisma = makePrisma({
      project: {
        findUnique: jest.fn().mockResolvedValue(proj(ProjectStatus.IN_PRODUCTION)),
        update,
      },
      milestone: { count: jest.fn().mockResolvedValue(0) },
    });
    const svc = new ProjectsService(prisma, { log: jest.fn() } as any);
    const out = await svc.completeDelivery(CREATOR, PROJ);
    expect(out.status).toBe(ProjectStatus.DELIVERED);
    expect(update).toHaveBeenCalledWith({
      where: { id: PROJ },
      data: { status: ProjectStatus.DELIVERED },
    });
  });

  it('rejects when any milestone is not yet RELEASED', async () => {
    const prisma = makePrisma({
      project: {
        findUnique: jest.fn().mockResolvedValue(proj(ProjectStatus.IN_PRODUCTION)),
        update: jest.fn(),
      },
      milestone: { count: jest.fn().mockResolvedValue(2) },
    });
    const svc = new ProjectsService(prisma, { log: jest.fn() } as any);
    await expect(svc.completeDelivery(CREATOR, PROJ)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('rejects non-IN_PRODUCTION status', async () => {
    const prisma = makePrisma({
      project: {
        findUnique: jest.fn().mockResolvedValue(proj(ProjectStatus.FUNDED)),
        update: jest.fn(),
      },
    });
    const svc = new ProjectsService(prisma, { log: jest.fn() } as any);
    await expect(svc.completeDelivery(CREATOR, PROJ)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects non-owner with 403', async () => {
    const prisma = makePrisma({
      project: {
        findUnique: jest.fn().mockResolvedValue(proj(ProjectStatus.IN_PRODUCTION)),
        update: jest.fn(),
      },
    });
    const svc = new ProjectsService(prisma, { log: jest.fn() } as any);
    await expect(svc.completeDelivery('not-the-creator', PROJ)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('ProjectsService.findByIdOrSlug (STAKES/N6)', () => {
  const UUID = 'f18ae89b-f072-4e7e-b40c-a1a185923783';

  it('routes a UUID through findById', async () => {
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ id: UUID }), update: jest.fn() },
    });
    const svc = new ProjectsService(prisma, { log: jest.fn() } as any);
    await svc.findByIdOrSlug(UUID);
    expect(prisma.project.findUnique.mock.calls[0][0].where).toEqual({ id: UUID });
  });

  it('routes a slug (lowercased) through the slug unique index', async () => {
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ id: UUID }), update: jest.fn() },
    });
    const svc = new ProjectsService(prisma, { log: jest.fn() } as any);
    await svc.findByIdOrSlug('Drone-Falcon');
    expect(prisma.project.findUnique.mock.calls[0][0].where).toEqual({ slug: 'drone-falcon' });
  });

  it('404s an unknown slug', async () => {
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    });
    const svc = new ProjectsService(prisma, { log: jest.fn() } as any);
    await expect(svc.findByIdOrSlug('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ProjectsService.report (STAKES/K3)', () => {
  const UUIDP = 'f18ae89b-f072-4e7e-b40c-a1a185923783';

  it('creates a report and dedups a second one from the same reporter', async () => {
    const { Prisma } = require('@prisma/client');
    const create = jest
      .fn()
      .mockResolvedValueOnce({ id: 'r1' })
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 't' }),
      );
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ id: UUIDP }), update: jest.fn() },
      projectReport: { create },
    });
    const svc = new ProjectsService(prisma, { log: jest.fn() } as any);
    expect(await svc.report('u1', UUIDP)).toEqual({ reported: true });
    expect(await svc.report('u1', UUIDP)).toEqual({ reported: true, alreadyReported: true });
  });
});

describe('ProjectsService.similar (STAKES/J3)', () => {
  const UUIDP = 'f18ae89b-f072-4e7e-b40c-a1a185923783';
  const card = (id: string) => ({
    id, titleAr: 'م', shortDescAr: 'د', slug: null, status: 'LIVE',
    raisedHalalas: 5000n, fundingGoalHalalas: 10000n, deadline: new Date('2026-08-01'),
  });

  it('fills from the same subcategory, then widens to the parent siblings', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([card('a')]) //           same categoryId → 1 hit
      .mockResolvedValueOnce([card('b'), card('c')]); // widened → 2 more
    const prisma = makePrisma({
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: UUIDP, categoryId: 'cat-1', category: 'TECH', categoryRef: { parentId: 'top-1' },
        }),
        findMany,
        update: jest.fn(),
      },
    });
    const svc = new ProjectsService(prisma, { log: jest.fn() } as any);
    const out = await svc.similar(UUIDP, 3);
    expect(out.items.map((i: any) => i.id)).toEqual(['a', 'b', 'c']);
    expect((out.items[0] as any).fundedPct).toBe(50);
    // widened query excludes the seed project AND the already-picked ids
    expect(findMany.mock.calls[1][0].where.id.notIn).toEqual([UUIDP, 'a']);
    expect(findMany.mock.calls[1][0].where.categoryRef).toEqual({ parentId: 'top-1' });
  });
});
