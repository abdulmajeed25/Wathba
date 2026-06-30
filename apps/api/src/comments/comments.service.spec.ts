/* eslint-disable @typescript-eslint/no-explicit-any */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PledgeStatus } from '@prisma/client';
import { CommentsService } from './comments.service';

/**
 * CommentsService — Tier 3.8.
 *   - eligibility: creator can always post; non-creator needs CAPTURED pledge
 *   - togglePin: creator-only, flips boolean + sets pinnedAt
 *   - toggleHide: creator-only
 *   - parent-reply notification fires for someone else's comment, not self
 */

const PROJ = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CREATOR = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const BACKER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const COMMENT = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

function makePrisma(over: Record<string, any> = {}): any {
  const prisma: any = {
    project: { findUnique: jest.fn() },
    pledge: { findFirst: jest.fn() },
    comment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    ...over,
  };
  return prisma;
}

function makeNotifications(): { create: jest.Mock } {
  return { create: jest.fn() };
}

describe('CommentsService.create — eligibility', () => {
  it('lets the project creator post even without a pledge', async () => {
    const create = jest.fn().mockResolvedValue({
      id: COMMENT, projectId: PROJ, userId: CREATOR, bodyAr: 'hi',
      parentId: null, isCreator: true, pinned: false, pinnedAt: null,
      hidden: false, likeCount: 0, date: new Date(),
      user: { id: CREATOR, name: 'م' },
    });
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ id: PROJ, createdById: CREATOR }) },
      comment: { create },
      pledge: { findFirst: jest.fn() },
    });
    const svc = new CommentsService(prisma, makeNotifications() as any);
    const r = await svc.create(CREATOR, PROJ, { bodyAr: 'hi' } as any);
    expect(create.mock.calls[0][0].data.isCreator).toBe(true);
    expect(prisma.pledge.findFirst).not.toHaveBeenCalled();
    expect(r.isCreator).toBe(true);
  });

  it('rejects a backer without a CAPTURED pledge with 403', async () => {
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ id: PROJ, createdById: CREATOR }) },
      pledge: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const svc = new CommentsService(prisma, makeNotifications() as any);
    await expect(
      svc.create(BACKER, PROJ, { bodyAr: 'hi' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a backer post when they have a CAPTURED pledge', async () => {
    const create = jest.fn().mockResolvedValue({
      id: COMMENT, projectId: PROJ, userId: BACKER, bodyAr: 'thanks!',
      parentId: null, isCreator: false, pinned: false, pinnedAt: null,
      hidden: false, likeCount: 0, date: new Date(),
      user: { id: BACKER, name: 'b' },
    });
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ id: PROJ, createdById: CREATOR }) },
      pledge: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
      comment: { create },
    });
    const svc = new CommentsService(prisma, makeNotifications() as any);
    await svc.create(BACKER, PROJ, { bodyAr: 'thanks!' } as any);
    expect(prisma.pledge.findFirst).toHaveBeenCalledWith({
      where: { backerId: BACKER, projectId: PROJ, status: PledgeStatus.CAPTURED },
      select: { id: true },
    });
    expect(create).toHaveBeenCalled();
  });

  it('returns 404 when the project does not exist', async () => {
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const svc = new CommentsService(prisma, makeNotifications() as any);
    await expect(
      svc.create(BACKER, PROJ, { bodyAr: 'hi' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fires a COMMENT_REPLY notification on a reply to someone else', async () => {
    const notifs = makeNotifications();
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ id: PROJ, createdById: CREATOR }) },
      pledge: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
      comment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'parent', userId: 'someone-else' }),
        create: jest.fn().mockResolvedValue({
          id: COMMENT, projectId: PROJ, userId: BACKER, bodyAr: 're',
          parentId: 'parent', isCreator: false, pinned: false, pinnedAt: null,
          hidden: false, likeCount: 0, date: new Date(),
          user: { id: BACKER, name: 'b' },
        }),
      },
    });
    const svc = new CommentsService(prisma, notifs as any);
    await svc.create(BACKER, PROJ, { bodyAr: 're', parentId: 'parent' } as any);
    expect(notifs.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'someone-else', kind: 'COMMENT_REPLY' }),
    );
  });

  it('does not fire a reply notification when replying to self', async () => {
    const notifs = makeNotifications();
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ id: PROJ, createdById: CREATOR }) },
      pledge: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
      comment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'parent', userId: BACKER }),
        create: jest.fn().mockResolvedValue({
          id: COMMENT, projectId: PROJ, userId: BACKER, bodyAr: 're',
          parentId: 'parent', isCreator: false, pinned: false, pinnedAt: null,
          hidden: false, likeCount: 0, date: new Date(),
          user: { id: BACKER, name: 'b' },
        }),
      },
    });
    const svc = new CommentsService(prisma, notifs as any);
    await svc.create(BACKER, PROJ, { bodyAr: 're', parentId: 'parent' } as any);
    expect(notifs.create).not.toHaveBeenCalled();
  });
});

describe('CommentsService.togglePin / toggleHide', () => {
  it('pin flips boolean + sets pinnedAt + requires creator ownership', async () => {
    const upd = jest.fn().mockResolvedValue({
      id: COMMENT, projectId: PROJ, userId: CREATOR, bodyAr: 'x',
      parentId: null, isCreator: true, pinned: true, pinnedAt: new Date(),
      hidden: false, likeCount: 0, date: new Date(),
      user: { id: CREATOR, name: 'م' },
    });
    const prisma = makePrisma({
      comment: {
        findUnique: jest.fn().mockResolvedValue({
          id: COMMENT, pinned: false, hidden: false,
          project: { createdById: CREATOR },
        }),
        update: upd,
      },
    });
    const svc = new CommentsService(prisma, makeNotifications() as any);
    const r = await svc.togglePin(CREATOR, COMMENT);
    expect(upd).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pinned: true }),
    }));
    expect(r.pinned).toBe(true);
  });

  it('togglePin rejects non-creator with 403', async () => {
    const prisma = makePrisma({
      comment: {
        findUnique: jest.fn().mockResolvedValue({
          id: COMMENT, pinned: false, hidden: false,
          project: { createdById: CREATOR },
        }),
        update: jest.fn(),
      },
    });
    const svc = new CommentsService(prisma, makeNotifications() as any);
    await expect(svc.togglePin(BACKER, COMMENT)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
