import { DiscoverService } from './discover.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * STAKES/S-10 F-03 — the discover card projection joins the creator name
 * (the profile saved-tab shows real attribution, not fixture text).
 */
describe('DiscoverService.list card projection', () => {
  it('carries creatorName from the joined User row (and defaults to empty)', async () => {
    const rows = [
      {
        id: 'p-1',
        titleAr: 'مشروع',
        shortDescAr: 'وصف',
        categoryId: null,
        region: null,
        isStaffPick: false,
        status: 'LIVE',
        fundingGoalHalalas: 100000n,
        raisedHalalas: 25000n,
        backersCount: 3,
        deadline: new Date('2026-12-01T00:00:00Z'),
        publishedAt: new Date('2026-06-01T00:00:00Z'),
        mediaUrls: [],
        slug: 'sirb',
        saved: true,
        creatorName: 'فريق سِرب',
      },
      { id: 'p-2', titleAr: 'آخر', shortDescAr: '', categoryId: null, region: null,
        isStaffPick: false, status: 'LIVE', fundingGoalHalalas: 0n, raisedHalalas: 0n,
        backersCount: 0, deadline: null, publishedAt: null, mediaUrls: [], slug: null,
        saved: false, creatorName: null },
    ];
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce(rows)
        .mockResolvedValueOnce([{ n: 2 }]),
    } as unknown as PrismaService;

    const service = new DiscoverService(prisma);
    const res = (await service.list({}, 'viewer-1')) as {
      items: Array<{ id: string; creatorName: string; saved: boolean; slug: string | null }>;
      total: number;
    };

    expect(res.total).toBe(2);
    expect(res.items[0]).toMatchObject({ id: 'p-1', creatorName: 'فريق سِرب', saved: true, slug: 'sirb' });
    expect(res.items[1]!.creatorName).toBe('');

    // The list SQL must join User for the name.
    const sql = (prisma.$queryRaw as jest.Mock).mock.calls[0][0] as { strings?: string[] };
    const text = Array.isArray(sql.strings) ? sql.strings.join('?') : String(sql);
    expect(text).toContain('JOIN "User" u');
    expect(text).toContain('"creatorName"');
  });
});
