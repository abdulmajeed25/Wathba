import { HomeService } from './home.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Batch HOME — compose() contract: sections gate their queries, editorial
 * cards slice by kind (S3 pair + S5 program slot = 3rd announcement), and
 * project cards project BigInt funding into a plain pct.
 */

const PROJECT = {
  id: 'p-1',
  titleAr: 'مشروع',
  shortDescAr: 'وصف قصير',
  status: 'LIVE',
  slug: 'sirb',
  fundingGoalHalalas: 100_000n,
  raisedHalalas: 80_000n,
  deadline: new Date('2026-12-01T00:00:00Z'),
  isStaffPick: true,
  categoryId: null,
  mediaUrls: ['https://cdn/img.webp'],
  backersCount: 12,
};

function card(kind: string, sortOrder: number, extra: Record<string, unknown> = {}) {
  return {
    id: `${kind}-${sortOrder}`, kind, sortOrder, slug: null, titleAr: `عنوان ${sortOrder}`,
    bodyAr: 'نص', bodyLongAr: null, imageUrl: null, linkUrl: null, linkLabelAr: null,
    isActive: true, publishedAt: new Date('2026-06-01T00:00:00Z'), ...extra,
  };
}

function buildPrisma(overrides: Record<string, unknown> = {}) {
  return {
    homepageSection: {
      findMany: jest.fn().mockResolvedValue([
        { key: 'hero_banners', sortOrder: 1, isActive: true },
        { key: 'featured_recommended', sortOrder: 2, isActive: true },
        { key: 'announcements', sortOrder: 3, isActive: true },
      ]),
    },
    editorialCard: {
      findMany: jest.fn().mockResolvedValue([
        card('ANNOUNCEMENT', 1),
        card('ANNOUNCEMENT', 2),
        card('ANNOUNCEMENT', 3),
        card('HERO_BANNER', 1),
      ]),
    },
    project: { findMany: jest.fn().mockResolvedValue([PROJECT]) },
    collection: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as PrismaService;
}

describe('HomeService.compose', () => {
  it('slices announcements into the S3 pair + S5 program slot (3rd by sortOrder)', async () => {
    const svc = new HomeService(buildPrisma());
    const out = (await svc.compose()) as {
      announcements: Array<{ id: string }>;
      programBanner: { id: string } | null;
      heroBanners: Array<{ id: string }>;
    };
    expect(out.announcements.map((c) => c.id)).toEqual(['ANNOUNCEMENT-1', 'ANNOUNCEMENT-2']);
    expect(out.programBanner?.id).toBe('ANNOUNCEMENT-3');
    expect(out.heroBanners.map((c) => c.id)).toEqual(['HERO_BANNER-1']);
  });

  it('projects BigInt funding into fundedPct and skips queries for inactive sections', async () => {
    const prisma = buildPrisma();
    const svc = new HomeService(prisma);
    const out = (await svc.compose()) as {
      sections: Array<{ key: string }>;
      featured: { fundedPct: number; imageUrl: string | null } | null;
      homeStretch: unknown[];
    };
    expect(out.sections.map((s) => s.key)).toEqual([
      'hero_banners', 'featured_recommended', 'announcements',
    ]);
    expect(out.featured?.fundedPct).toBe(80);
    expect(out.featured?.imageUrl).toBe('https://cdn/img.webp');
    // home_stretch inactive → the raw ≥75% query never runs.
    expect(out.homeStretch).toEqual([]);
    expect((prisma as unknown as { $queryRaw: jest.Mock }).$queryRaw).not.toHaveBeenCalled();
  });

  it('showcase picks the first active collection with ≥3 LIVE/FUNDED projects', async () => {
    const mk = (id: string, status: string) => ({ project: { ...PROJECT, id, status } });
    const prisma = buildPrisma({
      homepageSection: {
        findMany: jest.fn().mockResolvedValue([{ key: 'collection_showcase', sortOrder: 1, isActive: true }]),
      },
      collection: {
        findMany: jest.fn().mockResolvedValue([
          // First collection: only 2 qualifying (DRAFT filtered) → skipped.
          { slug: 'small', nameAr: 'صغيرة', projects: [mk('a', 'LIVE'), mk('b', 'DRAFT'), mk('c', 'FUNDED')] },
          { slug: 'ramadan', nameAr: 'رمضان', projects: [mk('d', 'LIVE'), mk('e', 'FUNDED'), mk('f', 'LIVE'), mk('g', 'LIVE')] },
        ]),
      },
    });
    const svc = new HomeService(prisma);
    const out = (await svc.compose()) as {
      showcase: { slug: string; featured: { id: string }; grid: Array<{ id: string }> } | null;
    };
    expect(out.showcase?.slug).toBe('ramadan');
    expect(out.showcase?.featured.id).toBe('d');
    expect(out.showcase?.grid.map((p) => p.id)).toEqual(['e', 'f', 'g']);
  });

  it('article() only serves active cards that actually have a long body', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = buildPrisma({ editorialCard: { findMany: jest.fn(), findFirst } });
    const svc = new HomeService(prisma);
    await svc.article('protect-your-campaign');
    expect(findFirst).toHaveBeenCalledWith({
      where: { slug: 'protect-your-campaign', isActive: true, bodyLongAr: { not: null } },
    });
  });
});
