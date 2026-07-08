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
