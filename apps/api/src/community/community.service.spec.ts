/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from '@prisma/client';
import { CommunityService } from './community.service';

/**
 * CommunityService — Tier 3.8.
 *  - snapshot() shape
 *  - materializeFromPledge idempotency guard (Tier 3.5 — re-running for the
 *    same pledge must NOT double-increment)
 *  - NEW vs RETURNING classification
 */

const PROJ = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PLEDGE = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const BACKER = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function makePrisma(over: Record<string, any> = {}): any {
  const prisma: any = {
    project: { findUnique: jest.fn() },
    communityStat: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
    },
    pledge: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    address: { findFirst: jest.fn() },
    communityMaterialised: { create: jest.fn() },
    ...over,
  };
  prisma.$transaction = jest.fn(
    async (fn: (tx: unknown) => unknown): Promise<unknown> => fn(prisma),
  );
  return prisma;
}

describe('CommunityService.snapshot', () => {
  it('returns shape with top-5 each + totals derived from TOTALS rows', async () => {
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ id: PROJ }) },
      communityStat: {
        findMany: jest
          .fn()
          // CITY page
          .mockResolvedValueOnce([
            { key: 'الرياض', backers: 42 },
            { key: 'جدة', backers: 21 },
          ])
          // COUNTRY page
          .mockResolvedValueOnce([{ key: 'SA', backers: 63 }])
          // TOTALS page
          .mockResolvedValueOnce([
            { key: 'TOTAL', backers: 63 },
            { key: 'NEW', backers: 40 },
            { key: 'RETURNING', backers: 23 },
          ]),
      },
    });
    const svc = new CommunityService(prisma);
    const snap = await svc.snapshot(PROJ);
    expect(snap.topCities).toEqual([
      { key: 'الرياض', backers: 42 },
      { key: 'جدة', backers: 21 },
    ]);
    expect(snap.topCountries).toEqual([{ key: 'SA', backers: 63 }]);
    expect(snap.totals).toEqual({ newCount: 40, returningCount: 23, total: 63 });
  });
});

describe('CommunityService.materializeFromPledge', () => {
  const livePledge = { id: PLEDGE, projectId: PROJ, backerId: BACKER };

  it('classifies NEW backer correctly + increments city + country + TOTAL + NEW', async () => {
    const upsert = jest.fn();
    const prisma = makePrisma({
      pledge: {
        findUnique: jest.fn().mockResolvedValue(livePledge),
        count: jest.fn().mockResolvedValue(0), // no other pledges → NEW
      },
      address: {
        findFirst: jest.fn().mockResolvedValue({ city: 'الرياض', country: 'SA' }),
      },
      communityMaterialised: { create: jest.fn().mockResolvedValue({}) },
      communityStat: { upsert },
    });
    const svc = new CommunityService(prisma);
    await svc.materializeFromPledge(PLEDGE);
    const scopes = upsert.mock.calls.map((c) => c[0].where.projectId_scope_key);
    expect(scopes).toEqual([
      { projectId: PROJ, scope: 'CITY', key: 'الرياض' },
      { projectId: PROJ, scope: 'COUNTRY', key: 'SA' },
      { projectId: PROJ, scope: 'TOTALS', key: 'TOTAL' },
      { projectId: PROJ, scope: 'TOTALS', key: 'NEW' },
    ]);
  });

  it('classifies RETURNING backer when they have other captured pledges', async () => {
    const upsert = jest.fn();
    const prisma = makePrisma({
      pledge: {
        findUnique: jest.fn().mockResolvedValue(livePledge),
        count: jest.fn().mockResolvedValue(2),
      },
      address: { findFirst: jest.fn().mockResolvedValue({ city: 'جدة', country: 'SA' }) },
      communityMaterialised: { create: jest.fn().mockResolvedValue({}) },
      communityStat: { upsert },
    });
    const svc = new CommunityService(prisma);
    await svc.materializeFromPledge(PLEDGE);
    const last = upsert.mock.calls.at(-1)[0].where.projectId_scope_key.key;
    expect(last).toBe('RETURNING');
  });

  it('skips on second invocation for the same pledge (Tier 3.5 idempotency)', async () => {
    const upsert = jest.fn();
    const dupErr = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const prisma = makePrisma({
      pledge: {
        findUnique: jest.fn().mockResolvedValue(livePledge),
        count: jest.fn().mockResolvedValue(0),
      },
      address: { findFirst: jest.fn().mockResolvedValue(null) },
      communityMaterialised: { create: jest.fn().mockRejectedValue(dupErr) },
      communityStat: { upsert },
    });
    const svc = new CommunityService(prisma);
    await svc.materializeFromPledge(PLEDGE);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('is a no-op when the pledge id does not resolve', async () => {
    const upsert = jest.fn();
    const prisma = makePrisma({
      pledge: { findUnique: jest.fn().mockResolvedValue(null), count: jest.fn() },
      communityStat: { upsert },
      communityMaterialised: { create: jest.fn() },
    });
    const svc = new CommunityService(prisma);
    await svc.materializeFromPledge(PLEDGE);
    expect(upsert).not.toHaveBeenCalled();
    expect(prisma.communityMaterialised.create).not.toHaveBeenCalled();
  });

  it('skips the CITY upsert when address.city is missing', async () => {
    const upsert = jest.fn();
    const prisma = makePrisma({
      pledge: {
        findUnique: jest.fn().mockResolvedValue(livePledge),
        count: jest.fn().mockResolvedValue(0),
      },
      address: { findFirst: jest.fn().mockResolvedValue(null) }, // no default address
      communityMaterialised: { create: jest.fn().mockResolvedValue({}) },
      communityStat: { upsert },
    });
    const svc = new CommunityService(prisma);
    await svc.materializeFromPledge(PLEDGE);
    const scopes = upsert.mock.calls.map((c) => c[0].where.projectId_scope_key.scope);
    expect(scopes).not.toContain('CITY');
    expect(scopes).toContain('COUNTRY');
    expect(scopes).toContain('TOTALS');
  });
});
