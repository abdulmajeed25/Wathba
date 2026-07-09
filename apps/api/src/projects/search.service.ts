import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Postgres full-text search across LIVE projects.
 *
 * Uses the `searchVector` generated tsvector column added via raw SQL
 * (see prisma/_raw/searchVector.sql) — title (A) + shortDesc (B) +
 * story (C). `websearch_to_tsquery` lets the user paste natural query
 * strings with quotes / OR / -. Falls back to pg_trgm similarity on
 * the title for fuzzy / typo input.
 *
 * Pagination is cursor-style via the `cursor` arg (id of the last
 * returned row); ordering by relevance + creation.
 */

export interface SearchHit {
  id: string;
  titleAr: string;
  shortDescAr: string;
  category: string;
  raisedHalalas: number;
  fundingGoalHalalas: number;
  daysLeft: number;
  status: string;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    q: string,
    limit = 20,
    // STAKES/L4 — optional narrowing filters for the results page.
    filters: { categorySlug?: string; status?: string } = {},
  ): Promise<SearchHit[]> {
    const cleaned = q.trim();
    if (!cleaned) return [];

    // Category slug → the node + its children (top-level widens to subcats).
    let catCond = Prisma.empty;
    if (filters.categorySlug) {
      const node = await this.prisma.category.findFirst({
        where: { slug: filters.categorySlug.toLowerCase() },
        select: { id: true, children: { select: { id: true } } },
      });
      const ids = node ? [node.id, ...node.children.map((c) => c.id)] : ['-none-'];
      catCond = Prisma.sql`AND p."categoryId"::text = ANY(${ids})`;
    }
    const statusCond =
      filters.status && ['LIVE', 'SUCCESSFUL', 'FUNDED'].includes(filters.status)
        ? Prisma.sql`AND p."status"::text = ${filters.status}`
        : Prisma.empty;

    // websearch_to_tsquery is forgiving of natural input. ts_rank gives
    // a relevance score; we order by it descending. Limit defaults to 20.
    const rows: Array<{
      id: string;
      titleAr: string;
      shortDescAr: string;
      category: string;
      raisedHalalas: bigint;
      fundingGoalHalalas: bigint;
      deadline: Date;
      status: string;
    }> = await this.prisma.$queryRaw`
      SELECT
        p."id",
        p."titleAr",
        p."shortDescAr",
        p."category"::text AS category,
        p."raisedHalalas",
        p."fundingGoalHalalas",
        p."deadline",
        p."status"::text AS status,
        ts_rank(
          p."searchVector",
          websearch_to_tsquery('simple', wathba_strip_arabic_diacritics(${cleaned}))
        ) AS rank
      FROM "Project" p
      WHERE
        p."status" IN ('LIVE', 'SUCCESSFUL', 'FUNDED')
        AND (
          p."searchVector" @@
            websearch_to_tsquery('simple', wathba_strip_arabic_diacritics(${cleaned}))
          OR similarity(
            wathba_strip_arabic_diacritics(p."titleAr"),
            wathba_strip_arabic_diacritics(${cleaned})
          ) > 0.25
        )
        ${catCond}
        ${statusCond}
      ORDER BY rank DESC, p."createdAt" DESC
      LIMIT ${limit}::int
    `;

    const now = Date.now();
    return rows.map((r) => ({
      id: r.id,
      titleAr: r.titleAr,
      shortDescAr: r.shortDescAr,
      category: r.category,
      raisedHalalas: Number(r.raisedHalalas),
      fundingGoalHalalas: Number(r.fundingGoalHalalas),
      daysLeft: Math.max(
        0,
        Math.ceil((r.deadline.getTime() - now) / 86_400_000),
      ),
      status: r.status,
    }));
  }

  /**
   * STAKES/L1 — header-search suggestions: projects + creators + categories
   * in one debounced round-trip. Creators only when their profile is public.
   */
  async suggest(q: string): Promise<{
    projects: SearchHit[];
    creators: Array<{ id: string; name: string; handle: string | null; avatarUrl: string | null }>;
    categories: Array<{ slug: string; nameAr: string; parentSlug: string | null }>;
  }> {
    const cleaned = q.trim();
    if (cleaned.length < 2) return { projects: [], creators: [], categories: [] };

    const [projects, creators, categories] = await Promise.all([
      this.search(cleaned, 5),
      this.prisma.user.findMany({
        where: {
          profilePublic: true,
          projects: { some: { publishedAt: { not: null } } },
          OR: [
            { name: { contains: cleaned, mode: 'insensitive' } },
            { handle: { contains: cleaned.toLowerCase() } },
          ],
        },
        select: { id: true, name: true, handle: true, avatarUrl: true },
        take: 3,
      }),
      this.prisma.category.findMany({
        where: {
          OR: [
            { nameAr: { contains: cleaned } },
            { slug: { contains: cleaned.toLowerCase() } },
          ],
        },
        select: { slug: true, nameAr: true, parent: { select: { slug: true } } },
        take: 4,
      }),
    ]);

    return {
      projects,
      creators,
      categories: categories.map((c) => ({
        slug: c.slug,
        nameAr: c.nameAr,
        parentSlug: c.parent?.slug ?? null,
      })),
    };
  }
}
