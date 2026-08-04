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

/**
 * Batch POLISH — the inclusion rail on /spotlight selects on this CATEGORY, a
 * property of the project, never on any attribute of the creator. Named here so
 * the intent is explicit at the one place it is used.
 */
const INCLUSION_CATEGORY_SLUG = 'people-with-disabilities';

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
            // Batch OPS — hiddenAt: null on every homepage rail: moderation
            // takedowns never surface on the public magazine page.
            where: { status: ProjectStatus.LIVE, isStaffPick: true, hiddenAt: null, isTestFixture: false },
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
      where: { status: ProjectStatus.LIVE, hiddenAt: null, isTestFixture: false },
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
        AND "hiddenAt" IS NULL
        AND "isTestFixture" = false
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
      where: { status: ProjectStatus.LIVE, isStaffPick: true, hiddenAt: null, isTestFixture: false },
      orderBy: { publishedAt: 'desc' },
      take,
      select: CARD_SELECT,
    });
    if (picks.length >= 3) return picks;
    return this.prisma.project.findMany({
      where: { status: ProjectStatus.LIVE, hiddenAt: null, isTestFixture: false },
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
          // Batch OPS — a hidden project stays in the curated collection
          // (ops-side) but never renders on the public showcase.
          where: { project: { hiddenAt: null, isTestFixture: false } },
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

  /**
   * Batch POLISH Unit 1/2 — «تحت الأضواء» (/spotlight).
   *
   * Merit-based curation only: every section is ordered by what the work has
   * achieved, never by who made it. There is deliberately no identity-derived
   * section here — the one inclusion rail («أصحاب الهمم») selects on the
   * project's own CATEGORY, which creators choose for their project, not on any
   * attribute of the creator.
   *
   * Content is admin-governed through infrastructure that already exists:
   * `isStaffPick` (ops-governed flag) drives مختارات وثبة and the hero,
   * SUCCESS_STORY editorial cards drive قصص ملهمة, and active Collections
   * supply the curated rails. No new content model.
   *
   * Sections ship data or nothing — the page renders no empty rails.
   */
  async spotlight(): Promise<Record<string, unknown>> {
    const LIVE = { status: ProjectStatus.LIVE, hiddenAt: null, isTestFixture: false } as const;

    const [picks, biggest, inclusion, stories, collections] = await Promise.all([
      this.prisma.project.findMany({
        where: { ...LIVE, isStaffPick: true },
        orderBy: [{ raisedHalalas: 'desc' }, { publishedAt: 'desc' }],
        take: 7,
        select: CARD_SELECT,
      }),
      this.prisma.project.findMany({
        where: { ...LIVE },
        orderBy: [{ raisedHalalas: 'desc' }, { backersCount: 'desc' }],
        take: 6,
        select: CARD_SELECT,
      }),
      this.prisma.project.findMany({
        where: {
          ...LIVE,
          // The canonical taxonomy is categoryRef (Batch CAT); `category` is the
          // legacy enum. A project may sit on the node itself OR on one of its
          // children, so both are matched — otherwise a project filed under a
          // subcategory of أصحاب الهمم would silently miss the rail.
          categoryRef: {
            OR: [{ slug: INCLUSION_CATEGORY_SLUG }, { parent: { slug: INCLUSION_CATEGORY_SLUG } }],
          },
        },
        orderBy: [{ raisedHalalas: 'desc' }],
        take: 6,
        select: CARD_SELECT,
      }),
      this.prisma.editorialCard.findMany({
        where: { kind: 'SUCCESS_STORY', isActive: true, slug: { not: null } },
        orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
        take: 6,
      }),
      this.prisma.collection.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { slug: true, nameAr: true, descriptionAr: true },
        take: 8,
      }),
    ]);

    // The hero is the strongest staff pick, else the strongest project overall.
    // Staff-pick IS the admin's pick — the flag is set through the governed ops
    // surface, so no separate "spotlight hero" content type is needed.
    const heroRow = picks[0] ?? biggest[0] ?? null;
    const heroId = heroRow?.id;

    // «إبداعات مميزة» — boldest work. There is no "inventiveness" column and
    // inventing a score would be fiction, so this reads as: momentum among
    // projects the editors have NOT already surfaced as staff picks. That keeps
    // the rail genuinely additive instead of repeating مختارات وثبة.
    const pickIds = new Set(picks.map((p) => p.id));
    const inventive = await this.prisma.project.findMany({
      where: {
        ...LIVE,
        isStaffPick: false,
        id: { notIn: [...pickIds, heroId].filter(Boolean) as string[] },
      },
      orderBy: [{ backersCount: 'desc' }, { publishedAt: 'desc' }],
      take: 6,
      select: CARD_SELECT,
    });

    const drop = (rows: ProjectCardRow[]) => rows.filter((p) => p.id !== heroId).map(toCard);

    return {
      hero: heroRow ? toCard(heroRow) : null,
      biggest: drop(biggest).slice(0, 5),
      staffPicks: drop(picks).slice(0, 5),
      inventive: inventive.map(toCard).slice(0, 5),
      inclusion: drop(inclusion).slice(0, 5),
      stories,
      collections,
    };
  }

  /** OPS Part 0 — admin reads (mutations live in the operations registry). */
  async listCardsAdmin() {
    return this.prisma.editorialCard.findMany({ orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }] });
  }

  async listSectionsAdmin() {
    return this.prisma.homepageSection.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  /**
   * Batch CONTENT — the «قواعدنا» hub index.
   *
   * The rules pages are EditorialCards of kind RULE, so they are edited through
   * the same audited ops CONTENT surface as every other article and need no
   * deploy to change. Only the summary is returned; the body is fetched per page
   * by `article()` below, which the existing /v1/stories/:slug already serves.
   */
  async rules() {
    return this.prisma.editorialCard.findMany({
      where: { kind: 'RULE', isActive: true, bodyLongAr: { not: null } },
      select: { slug: true, titleAr: true, bodyAr: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Article page data for /stories/[slug]. */
  async article(slug: string) {
    return this.prisma.editorialCard.findFirst({
      where: { slug, isActive: true, bodyLongAr: { not: null } },
    });
  }
}
