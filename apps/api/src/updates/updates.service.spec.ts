/* eslint-disable @typescript-eslint/no-explicit-any */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UpdatesService } from './updates.service';

/**
 * UpdatesService — Tier 3.8 / Tier 3.4.
 *   - create() auto-assigns orderNum = max+1 (or 1 on empty)
 *   - update() requires ownership (creator-only)
 *   - like() toggles per (userId, updateId): insert→++ then delete→--
 *   - like() clamps decremented likeCount at 0
 */

const PROJ = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const UPD = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CREATOR = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const BACKER = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function makePrisma(over: Record<string, any> = {}): any {
  const prisma: any = {
    project: { findUnique: jest.fn() },
    projectUpdate: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    updateLike: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    ...over,
  };
  prisma.$transaction = jest.fn(
    async (fn: (tx: unknown) => unknown): Promise<unknown> => fn(prisma),
  );
  return prisma;
}

describe('UpdatesService.create', () => {
  it('assigns orderNum 1 when the project has no updates yet', async () => {
    const create = jest.fn().mockResolvedValue({
      id: UPD,
      projectId: PROJ,
      titleAr: 't',
      bodyAr: 'b',
      orderNum: 1,
      likeCount: 0,
      commentCount: 0,
      date: new Date(),
    });
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ createdById: CREATOR }) },
      projectUpdate: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
    });
    const svc = new UpdatesService(prisma);
    await svc.create(CREATOR, PROJ, { titleAr: 't', bodyAr: 'b' } as any);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderNum: 1 }),
    });
  });

  it('increments orderNum from the max existing', async () => {
    const create = jest.fn().mockResolvedValue({
      id: UPD,
      projectId: PROJ,
      titleAr: 't',
      bodyAr: 'b',
      orderNum: 5,
      likeCount: 0,
      commentCount: 0,
      date: new Date(),
    });
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ createdById: CREATOR }) },
      projectUpdate: {
        findFirst: jest.fn().mockResolvedValue({ orderNum: 4 }),
        create,
      },
    });
    const svc = new UpdatesService(prisma);
    await svc.create(CREATOR, PROJ, { titleAr: 't', bodyAr: 'b' } as any);
    expect(create.mock.calls[0][0].data.orderNum).toBe(5);
  });

  it('throws Forbidden if the caller is not the project creator', async () => {
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ createdById: CREATOR }) },
    });
    const svc = new UpdatesService(prisma);
    await expect(
      svc.create(BACKER, PROJ, { titleAr: 't', bodyAr: 'b' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('UpdatesService.like (toggle)', () => {
  const baseRow = {
    id: UPD,
    projectId: PROJ,
    titleAr: 't',
    bodyAr: 'b',
    orderNum: 1,
    likeCount: 5,
    commentCount: 0,
    date: new Date(),
  };

  it('first call inserts join row + likeCount++ and returns liked:true', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const create = jest.fn();
    const updateRow = jest.fn().mockResolvedValue({ ...baseRow, likeCount: 6 });
    const prisma = makePrisma({
      projectUpdate: {
        findFirst: jest.fn().mockResolvedValue({ id: UPD }),
        update: updateRow,
      },
      updateLike: { findUnique, create, delete: jest.fn() },
    });
    const svc = new UpdatesService(prisma);
    const r = await svc.like(BACKER, PROJ, UPD);
    expect(create).toHaveBeenCalled();
    expect(updateRow).toHaveBeenCalledWith({
      where: { id: UPD },
      data: { likeCount: { increment: 1 } },
    });
    expect(r.liked).toBe(true);
    expect(r.likeCount).toBe(6);
  });

  it('second call deletes join row + likeCount-- and returns liked:false', async () => {
    const findUnique = jest.fn().mockResolvedValue({ updateId: UPD });
    const del = jest.fn();
    const updateRow = jest.fn().mockResolvedValue({ ...baseRow, likeCount: 4 });
    const prisma = makePrisma({
      projectUpdate: {
        findFirst: jest.fn().mockResolvedValue({ id: UPD }),
        update: updateRow,
      },
      updateLike: { findUnique, create: jest.fn(), delete: del },
    });
    const svc = new UpdatesService(prisma);
    const r = await svc.like(BACKER, PROJ, UPD);
    expect(del).toHaveBeenCalled();
    expect(updateRow).toHaveBeenCalledWith({
      where: { id: UPD },
      data: { likeCount: { decrement: 1 } },
    });
    expect(r.liked).toBe(false);
    expect(r.likeCount).toBe(4);
  });

  it('clamps a decremented likeCount at 0 (drift recovery)', async () => {
    const findUnique = jest.fn().mockResolvedValue({ updateId: UPD });
    const update = jest
      .fn()
      .mockResolvedValueOnce({ ...baseRow, likeCount: -1 }) // decrement landed at -1
      .mockResolvedValueOnce({ ...baseRow, likeCount: 0 }); // clamp call
    const prisma = makePrisma({
      projectUpdate: {
        findFirst: jest.fn().mockResolvedValue({ id: UPD }),
        update,
      },
      updateLike: { findUnique, delete: jest.fn(), create: jest.fn() },
    });
    const svc = new UpdatesService(prisma);
    const r = await svc.like(BACKER, PROJ, UPD);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[1][0].data.likeCount).toBe(0);
    expect(r.likeCount).toBe(0);
  });

  it('throws NotFound when the update does not exist on the project', async () => {
    const prisma = makePrisma({
      projectUpdate: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const svc = new UpdatesService(prisma);
    await expect(svc.like(BACKER, PROJ, UPD)).rejects.toBeInstanceOf(NotFoundException);
  });
});
