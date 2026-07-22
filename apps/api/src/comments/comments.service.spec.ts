/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { PledgeStatus } from '@prisma/client';
import { CommentsService } from './comments.service';

/**
 * CommentsService — Tier 3.8.
 *   - eligibility: creator can always post; non-creator needs a HELD/CAPTURED pledge
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
    // STAKES/S-12 F-11 — the create() gate reads the commenter's verified flag.
    user: { findUnique: jest.fn().mockResolvedValue({ emailVerified: true }) },
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
    const svc = new CommentsService(prisma, makeNotifications() as any, { get: jest.fn().mockResolvedValue([]) } as any);
    const r = await svc.create(CREATOR, PROJ, { bodyAr: 'hi' } as any);
    expect(create.mock.calls[0][0].data.isCreator).toBe(true);
    expect(prisma.pledge.findFirst).not.toHaveBeenCalled();
    expect(r.isCreator).toBe(true);
  });

  it('rejects a user without any HELD/CAPTURED pledge with 403', async () => {
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ id: PROJ, createdById: CREATOR }) },
      pledge: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const svc = new CommentsService(prisma, makeNotifications() as any, { get: jest.fn().mockResolvedValue([]) } as any);
    await expect(
      svc.create(BACKER, PROJ, { bodyAr: 'hi' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // STAKES/S-11 — HELD counts too: capture only happens at campaign success,
  // so CAPTURED-only meant nobody could comment during a live campaign.
  it('lets a backer post when they have a HELD or CAPTURED pledge', async () => {
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
    const svc = new CommentsService(prisma, makeNotifications() as any, { get: jest.fn().mockResolvedValue([]) } as any);
    await svc.create(BACKER, PROJ, { bodyAr: 'thanks!' } as any);
    expect(prisma.pledge.findFirst).toHaveBeenCalledWith({
      where: {
        backerId: BACKER,
        projectId: PROJ,
        status: { in: [PledgeStatus.HELD, PledgeStatus.CAPTURED] },
      },
      select: { id: true },
    });
    expect(create).toHaveBeenCalled();
  });

  it('returns 404 when the project does not exist', async () => {
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const svc = new CommentsService(prisma, makeNotifications() as any, { get: jest.fn().mockResolvedValue([]) } as any);
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
    const svc = new CommentsService(prisma, notifs as any, { get: jest.fn().mockResolvedValue([]) } as any);
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
    const svc = new CommentsService(prisma, notifs as any, { get: jest.fn().mockResolvedValue([]) } as any);
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
    const svc = new CommentsService(prisma, makeNotifications() as any, { get: jest.fn().mockResolvedValue([]) } as any);
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
    const svc = new CommentsService(prisma, makeNotifications() as any, { get: jest.fn().mockResolvedValue([]) } as any);
    await expect(svc.togglePin(BACKER, COMMENT)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('CommentsService.edit — STAKES/K1 (15-min window)', () => {
  const row = (ageMs: number, userId = BACKER) => ({
    id: COMMENT, userId, hidden: false, date: new Date(Date.now() - ageMs),
  });
  const updated = {
    id: COMMENT, projectId: PROJ, userId: BACKER, bodyAr: 'edited',
    parentId: null, isCreator: false, pinned: false, pinnedAt: null,
    hidden: false, likeCount: 0, reportCount: 0, editedAt: new Date(), date: new Date(),
    user: { id: BACKER, name: 'م', handle: 'm', avatarUrl: null },
  };

  it('edits own comment inside the window and stamps editedAt', async () => {
    const prisma = makePrisma({
      comment: {
        findUnique: jest.fn().mockResolvedValue(row(60_000)),
        update: jest.fn().mockResolvedValue(updated),
      },
    });
    const svc = new CommentsService(prisma, makeNotifications() as any, { get: jest.fn().mockResolvedValue([]) } as any);
    const r = await svc.edit(BACKER, COMMENT, 'edited');
    expect(prisma.comment.update.mock.calls[0][0].data.bodyAr).toBe('edited');
    expect(prisma.comment.update.mock.calls[0][0].data.editedAt).toBeInstanceOf(Date);
    expect(r.editedAt).not.toBeNull();
  });

  it('403s after the window and for non-owners', async () => {
    const late = makePrisma({
      comment: { findUnique: jest.fn().mockResolvedValue(row(16 * 60_000)), update: jest.fn() },
    });
    await expect(
      new CommentsService(late, makeNotifications() as any, { get: jest.fn().mockResolvedValue([]) } as any).edit(BACKER, COMMENT, 'x'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const notOwner = makePrisma({
      comment: { findUnique: jest.fn().mockResolvedValue(row(60_000, CREATOR)), update: jest.fn() },
    });
    await expect(
      new CommentsService(notOwner, makeNotifications() as any, { get: jest.fn().mockResolvedValue([]) } as any).edit(BACKER, COMMENT, 'x'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('CommentsService — STAKES/K5 spam guard', () => {
  it('400s a blocked word before any DB work', async () => {
    const prisma = makePrisma();
    const svc = new CommentsService(prisma, makeNotifications() as any, { get: jest.fn().mockResolvedValue([]) } as any);
    await expect(
      svc.create(BACKER, PROJ, { bodyAr: 'buy viagra now' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.project.findUnique).not.toHaveBeenCalled();
  });

  // Batch OPS (Unit 6) — the blocklist is read through SettingsService and
  // MERGED with the env-derived seed (always a superset).
  it('blocks a word supplied by the moderation.blockedWords setting', async () => {
    const prisma = makePrisma();
    const settings = { get: jest.fn().mockResolvedValue(['حصري', 'quackpills']) };
    const svc = new CommentsService(prisma, makeNotifications() as any, settings as any);
    await expect(
      svc.create(BACKER, PROJ, { bodyAr: 'grab your quackpills here' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(settings.get).toHaveBeenCalledWith('moderation.blockedWords');
    expect(prisma.project.findUnique).not.toHaveBeenCalled();
  });

  it('still enforces the seed list when the setting is at its (empty override) default', async () => {
    const prisma = makePrisma();
    // A configured [] must not weaken the env/seed superset.
    const svc = new CommentsService(prisma, makeNotifications() as any, { get: jest.fn().mockResolvedValue([]) } as any);
    await expect(
      svc.create(BACKER, PROJ, { bodyAr: 'CASINO night' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('429s the 6th comment inside one minute (per user)', async () => {
    const createdRow = {
      id: COMMENT, projectId: PROJ, userId: CREATOR, bodyAr: 'hi',
      parentId: null, isCreator: true, pinned: false, pinnedAt: null,
      hidden: false, likeCount: 0, reportCount: 0, editedAt: null, date: new Date(),
      user: { id: CREATOR, name: 'م', handle: null, avatarUrl: null },
    };
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ id: PROJ, createdById: CREATOR }) },
      comment: { create: jest.fn().mockResolvedValue(createdRow), findFirst: jest.fn() },
    });
    const svc = new CommentsService(prisma, makeNotifications() as any, { get: jest.fn().mockResolvedValue([]) } as any);
    for (let i = 0; i < 5; i++) {
      await svc.create(CREATOR, PROJ, { bodyAr: `hello ${i}` } as any);
    }
    await expect(svc.create(CREATOR, PROJ, { bodyAr: 'sixth' } as any)).rejects.toMatchObject({
      constructor: HttpException,
      status: 429,
    });
  });
});
