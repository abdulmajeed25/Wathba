/* eslint-disable @typescript-eslint/no-explicit-any */
import { ProjectsService } from './projects.service';

/**
 * Batch CAT / Part 2 — discovery filters on the projects list query.
 * Each filter is combinable with category/subcategory + cursor; computed
 * filters (trending, nearly_funded) rank in memory.
 */

const audit = { log: jest.fn() } as any;

function makePrisma(over: Record<string, any> = {}): any {
  return {
    category: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    project: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    pledge: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    ...over,
  };
}

describe('ProjectsService discovery filters', () => {
  it('categorySlug → categoryId IN [top, ...children]', async () => {
    const prisma = makePrisma({
      category: {
        findFirst: jest.fn().mockResolvedValue({ id: 'top' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'k1' }, { id: 'k2' }]),
      },
      project: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const svc = new ProjectsService(prisma, audit);
    await svc.list({ categorySlug: 'technology' } as any);
    const where = prisma.project.findMany.mock.calls[0][0].where;
    expect(where.categoryId).toEqual({ in: ['top', 'k1', 'k2'] });
  });

  it('subSlug narrows to the single subcategory id', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({ id: 'top' }) // top-level
      .mockResolvedValueOnce({ id: 'sub' }); // subcategory
    const prisma = makePrisma({
      category: { findFirst, findMany: jest.fn() },
      project: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const svc = new ProjectsService(prisma, audit);
    await svc.list({ categorySlug: 'technology', subSlug: 'apps' } as any);
    expect(prisma.project.findMany.mock.calls[0][0].where.categoryId).toEqual({ in: ['sub'] });
  });

  it('just_launched → LIVE + publishedAt within 7 days, newest first', async () => {
    const prisma = makePrisma();
    const svc = new ProjectsService(prisma, audit);
    await svc.list({ filter: 'just_launched' } as any);
    const call = prisma.project.findMany.mock.calls[0][0];
    expect(call.where.status).toBe('LIVE');
    expect(call.where.publishedAt.gte).toBeInstanceOf(Date);
    expect(Date.now() - call.where.publishedAt.gte.getTime()).toBeCloseTo(7 * 86_400_000, -5);
    expect(call.orderBy[0]).toEqual({ publishedAt: 'desc' });
  });

  it('near_you without a region returns empty and never queries', async () => {
    const prisma = makePrisma();
    const svc = new ProjectsService(prisma, audit);
    const res = await svc.list({ filter: 'near_you' } as any);
    expect(res).toEqual({ items: [], nextCursor: null });
    expect(prisma.project.findMany).not.toHaveBeenCalled();
  });

  it('near_you with a region filters by region', async () => {
    const prisma = makePrisma();
    const svc = new ProjectsService(prisma, audit);
    await svc.list({ filter: 'near_you', region: 'RIYADH' } as any);
    const where = prisma.project.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('LIVE');
    expect(where.region).toBe('RIYADH');
  });

  it('staff_pick → isStaffPick true', async () => {
    const prisma = makePrisma();
    const svc = new ProjectsService(prisma, audit);
    await svc.list({ filter: 'staff_pick' } as any);
    expect(prisma.project.findMany.mock.calls[0][0].where.isStaffPick).toBe(true);
  });

  it('nearly_funded keeps only ≥75% funded, ordered by funded% desc', async () => {
    const rows = [
      { id: 'a', fundingGoalHalalas: 100n, raisedHalalas: 50n, backersCount: 1 }, // 50% out
      { id: 'b', fundingGoalHalalas: 100n, raisedHalalas: 80n, backersCount: 1 }, // 80% in
      { id: 'c', fundingGoalHalalas: 100n, raisedHalalas: 95n, backersCount: 1 }, // 95% in
    ];
    const prisma = makePrisma({
      project: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce(rows) // computed candidate scan
          .mockResolvedValueOnce([{ id: 'c' }, { id: 'b' }]), // hydrate page
      },
    });
    const svc = new ProjectsService(prisma, audit);
    const res = await svc.list({ filter: 'nearly_funded' } as any);
    // Candidate scan carried the ≥48h deadline window.
    expect(prisma.project.findMany.mock.calls[0][0].where.deadline.gte).toBeInstanceOf(Date);
    // Page hydrated in funded%-desc order: c (95%) then b (80%); a dropped.
    expect(prisma.project.findMany.mock.calls[1][0].where.id.in).toEqual(['c', 'b']);
    expect(res.items.map((p) => p.id)).toEqual(['c', 'b']);
  });

  it('trending orders LIVE projects by 72h pledge velocity (zero-velocity last)', async () => {
    const rows = [
      { id: 'a', fundingGoalHalalas: 100n, raisedHalalas: 10n, backersCount: 5 },
      { id: 'b', fundingGoalHalalas: 100n, raisedHalalas: 10n, backersCount: 5 },
      { id: 'c', fundingGoalHalalas: 100n, raisedHalalas: 10n, backersCount: 5 },
    ];
    const prisma = makePrisma({
      project: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce(rows)
          .mockResolvedValueOnce([{ id: 'b' }, { id: 'a' }, { id: 'c' }]),
      },
      pledge: {
        // b has 9 recent pledges, a has 3, c has none → order b, a, c.
        groupBy: jest.fn().mockResolvedValue([
          { projectId: 'a', _count: { _all: 3 } },
          { projectId: 'b', _count: { _all: 9 } },
        ]),
      },
    });
    const svc = new ProjectsService(prisma, audit);
    const res = await svc.list({ filter: 'trending' } as any);
    expect(res.items.map((p) => p.id)).toEqual(['b', 'a', 'c']);
    const pledgeWhere = prisma.pledge.groupBy.mock.calls[0][0].where;
    expect(pledgeWhere.status.in).toEqual(['HELD', 'CAPTURED']);
    expect(Date.now() - pledgeWhere.createdAt.gte.getTime()).toBeCloseTo(72 * 3_600_000, -5);
  });
});
