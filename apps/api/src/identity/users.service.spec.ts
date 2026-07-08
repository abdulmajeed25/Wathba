import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UsersService } from './users.service';

/**
 * STAKES/S-4 — user identity surface: handle minting/claiming and the public
 * profile projection behind /u/[handle].
 */

const USER = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  name: 'سارة العامري',
  email: 'sara@example.sa',
  phone: null,
  roles: ['BACKER'],
  handle: 'sara',
  avatarUrl: null,
  bioAr: null,
  city: null,
  websiteUrl: null,
  socialLinks: [],
  nafathVerified: true,
  reputationTier: 'NEWCOMER',
  totalPledgedHalalas: 0n,
  locale: 'ar',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

function makePrisma(overrides: Record<string, unknown> = {}): any {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(USER),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...USER, ...data })),
    },
    project: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    pledge: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
}

describe('UsersService.updateProfile (STAKES/C3 C7)', () => {
  it('lowercases and persists a claimed handle', async () => {
    const prisma = makePrisma();
    const svc = new UsersService(prisma);
    await svc.updateProfile(USER.id, { handle: 'Sara-Alamri' });
    expect(prisma.user.update.mock.calls[0][0].data.handle).toBe('sara-alamri');
  });

  it('rejects reserved handles with an Arabic 409', async () => {
    const svc = new UsersService(makePrisma());
    await expect(svc.updateProfile(USER.id, { handle: 'Admin' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('maps a P2002 uniqueness violation to an Arabic 409', async () => {
    const prisma = makePrisma();
    prisma.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    const svc = new UsersService(prisma);
    await expect(svc.updateProfile(USER.id, { handle: 'taken' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('persists the extended identity fields', async () => {
    const prisma = makePrisma();
    const svc = new UsersService(prisma);
    await svc.updateProfile(USER.id, {
      bioAr: 'مصممة منتجات',
      city: 'الرياض',
      websiteUrl: 'https://sara.sa',
      socialLinks: [{ platform: 'x', url: 'https://x.com/sara' }],
    });
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.bioAr).toBe('مصممة منتجات');
    expect(data.city).toBe('الرياض');
    expect(data.socialLinks).toEqual([{ platform: 'x', url: 'https://x.com/sara' }]);
  });
});

describe('UsersService.generateHandle (STAKES/C7)', () => {
  it('mints the sanitized local-part when free', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const svc = new UsersService(prisma);
    expect(await svc.generateHandle('Sara.Alamri+x@example.sa')).toBe('sara.alamrix');
  });

  it('suffixes on collision', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'other' }) // "sara" taken
      .mockResolvedValueOnce(null); //           "sara-2" free
    const svc = new UsersService(prisma);
    expect(await svc.generateHandle('sara@example.sa')).toBe('sara-2');
  });

  it('returns null for too-short or reserved local-parts', async () => {
    const svc = new UsersService(makePrisma());
    expect(await svc.generateHandle('ab@example.sa')).toBeNull();
    expect(await svc.generateHandle('admin@example.sa')).toBeNull();
  });
});

describe('UsersService.publicProfile (STAKES/C1 C5)', () => {
  const PUBLIC_ROW = {
    id: USER.id,
    handle: 'sara',
    name: USER.name,
    avatarUrl: null,
    bioAr: 'مصممة',
    city: 'جدة',
    websiteUrl: null,
    socialLinks: [{ platform: 'x', url: 'https://x.com/sara' }],
    profilePublic: true,
    showBackedCount: true,
    nafathVerified: true,
    createdAt: USER.createdAt,
    creatorProfile: { avatarUrl: 'https://cdn/x.png', bioAr: null, websiteUrl: null, followersCount: 7 },
  };

  it('404s for an unknown handle', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue(null);
    const svc = new UsersService(prisma);
    await expect(svc.publicProfile('nobody')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('composes stats and never exposes email/phone', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue(PUBLIC_ROW);
    prisma.pledge.findMany.mockResolvedValue([{ projectId: 'p1' }, { projectId: 'p2' }]);
    prisma.project.findMany.mockResolvedValue([
      {
        id: 'p1',
        titleAr: 'مشروع',
        status: 'LIVE',
        raisedHalalas: 5000n,
        fundingGoalHalalas: 10000n,
        publishedAt: new Date('2026-02-01T00:00:00Z'),
      },
    ]);
    const svc = new UsersService(prisma);
    const out = await svc.publicProfile('Sara');

    expect(out.handle).toBe('sara');
    expect(out.stats).toEqual({ backedCount: 2, createdCount: 1, followersCount: 7 });
    // creator-profile avatar backfills the user-level one
    expect(out.avatarUrl).toBe('https://cdn/x.png');
    expect((out.createdProjects as any[])[0].fundedPct).toBe(50);
    expect(out).not.toHaveProperty('email');
    expect(out).not.toHaveProperty('phone');
    // handle lookup is lowercased and non-UUIDs never match the id column
    expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({ handle: 'sara' });
  });

  it('404s a private profile exactly like a missing one (STAKES/E3)', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue({ ...PUBLIC_ROW, profilePublic: false });
    const svc = new UsersService(prisma);
    await expect(svc.publicProfile('sara')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('hides the backed count when showBackedCount is off (STAKES/E3)', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue({ ...PUBLIC_ROW, showBackedCount: false });
    prisma.pledge.findMany.mockResolvedValue([{ projectId: 'p1' }]);
    const svc = new UsersService(prisma);
    const out = await svc.publicProfile('sara');
    expect((out.stats as { backedCount: number | null }).backedCount).toBeNull();
  });

  it('falls back to UUID lookup for handle-less legacy rows', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue({ ...PUBLIC_ROW, handle: null, creatorProfile: null });
    const svc = new UsersService(prisma);
    const out = await svc.publicProfile(USER.id.toUpperCase());
    expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({
      OR: [{ handle: USER.id }, { id: USER.id }],
    });
    expect(out.stats).toEqual({ backedCount: 0, createdCount: 0, followersCount: 0 });
  });
});
