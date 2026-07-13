import { Injectable } from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Batch HOME — one composed payload for the magazine homepage.
 *
 * Sections render in admin-defined order (HomepageSection); every
 * project-driven block ships data or nothing (the page renders only
 * non-empty sections), every editorial block ships its active cards.
 * Public + cacheable (ISR on the web side); the signed-in «موصى بها لك»
 * variant is fetched separately by the client (per-user, never cached).
 */

const CARD_SELECT = {
  id: true, titleAr: true, shortDescAr: true, status: true, slug: true,
  fundingGoalHalalas: true, raisedHalalas: true, deadline: true, isStaffPick: true,
  categoryId: true, mediaUrls: true, backersCount: true,
} as const;

type ProjectCardRow = Prisma.ProjectGetPayload<{ select: typeof CARD_SELECT }>;

function toCard(p: ProjectCardRow) {
  const goal = p.fundingGoalHalalas;
  const pct = goal > 0n ? Number((p.raisedHalalas * 100n) / goal) : 0;
  return {
    id: p.id,
    titleAr: p.titleAr,
    shortDescAr: p.shortDescAr,
    slug: p.slug,
    status: p.status,
    fundedPct: pct,
    backersCount: p.backersCount,
    deadline: p.deadline.toISOString(),
    imageUrl: p.mediaUrls[0] ?? null,
    isStaffPick: p.isStaffPick,
  };
}

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

  async compose(): Promise<Record<string, unknown>> {
    const sections = await this.prisma.homepageSection.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    const keys = new Set(sections.map((s) => s.key));

    const [cards, featured, trending, showcase, homeStretch, freshFavorites] = await Promise.all([
      this.prisma.editorialCard.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
      }),
      keys.has('featured_recommended')
        ? this.prisma.project.findMany({
            where: { status: ProjectStatus.LIVE, isStaffPick: true },
            orderBy: { publishedAt: 'desc' },
            take: 1,
            select: CARD_SELECT,
          })
        : [],
      keys.has('featured_recommended') ? this.trending(4) : [],
      keys.has('collection_showcase') ? this.showcase() : null,
      keys.has('home_stretch') ? this.homeStretch(10) : [],
      keys.has('fresh_favorites') ? this.freshFavorites(10) : [],
    ]);

    const byKind = (kind: string, take?: number) =>
      cards.filter((c) => c.kind === kind).slice(0, take ?? undefined);

    return {
      sections: sections.map((s) => ({ key: s.key, sortOrder: s.sortOrder })),
      heroBanners: byKind('HERO_BANNER'),
      announcements: byKind('ANNOUNCEMENT', 2),
      // S5 program slot = the next announcement after the S3 pair (sortOrder).
      programBanner: byKind('ANNOUNCEMENT')[2] ?? null,
      featured: featured.map(toCard)[0] ?? null,
      trending: trending.map(toCard),
      showcase,
      homeStretch: homeStretch.map(toCard),
      successStories: byKind('SUCCESS_STORY', 4),
      creatorInterviews: byKind('CREATOR_INTERVIEW', 4),
      freshFavorites: freshFavorites.map(toCard),
      resources: byKind('RESOURCE', 4),
      tips: byKind('TIP', 4),
      trustGuides: byKind('TRUST_GUIDE', 2),
    };
  }

  /** Anonymous «موصى بها» substitute — most-backed LIVE projects. */
  private trending(take: number): Promise<ProjectCardRow[]> {
    return this.prisma.project.findMany({
      where: { status: ProjectStatus.LIVE },
      orderBy: { backersCount: 'desc' },
      take,
      select: CARD_SELECT,
    });
  }

  /** S6 — LIVE projects ≥75% funded (the nearlyFunded rule). */
  private async homeStretch(take: number): Promise<ProjectCardRow[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM "Project"
      WHERE status = 'LIVE'
        AND "fundingGoalHalalas" > 0
        AND "raisedHalalas" * 100 >= "fundingGoalHalalas" * 75
      ORDER BY ("raisedHalalas" * 100 / "fundingGoalHalalas") DESC
      LIMIT ${take}
    `);
    if (rows.length === 0) return [];
    const projects = await this.prisma.project.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      select: CARD_SELECT,
    });
    const order = new Map(rows.map((r, i) => [r.id, i]));
    return projects.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  /** S9 — recently-launched staff picks, falling back to just-launched. */
  private async freshFavorites(take: number): Promise<ProjectCardRow[]> {
    const picks = await this.prisma.project.findMany({
      where: { status: ProjectStatus.LIVE, isStaffPick: true },
      orderBy: { publishedAt: 'desc' },
      take,
      select: CARD_SELECT,
    });
    if (picks.length >= 3) return picks;
    return this.prisma.project.findMany({
      where: { status: ProjectStatus.LIVE },
      orderBy: { publishedAt: 'desc' },
      take,
      select: CARD_SELECT,
    });
  }

  /** S4 — the first active collection with enough projects: 1 featured + 4 grid. */
  private async showcase(): Promise<Record<string, unknown> | null> {
    const collections = await this.prisma.collection.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        projects: {
          take: 8,
          include: { project: { select: CARD_SELECT } },
        },
      },
    });
    for (const col of collections) {
      const live = col.projects
        .map((cp) => cp.project)
        .filter((p) => p.status === ProjectStatus.LIVE || p.status === ProjectStatus.FUNDED);
      if (live.length >= 3) {
        return {
          slug: col.slug,
          nameAr: col.nameAr,
          featured: toCard(live[0]!),
          grid: live.slice(1, 5).map(toCard),
        };
      }
    }
    return null;
  }

  /** OPS Part 0 — admin reads (mutations live in the operations registry). */
  async listCardsAdmin() {
    return this.prisma.editorialCard.findMany({ orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }] });
  }

  async listSectionsAdmin() {
    return this.prisma.homepageSection.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  /** Article page data for /stories/[slug]. */
  async article(slug: string) {
    return this.prisma.editorialCard.findFirst({
      where: { slug, isActive: true, bodyLongAr: { not: null } },
    });
  }
}
