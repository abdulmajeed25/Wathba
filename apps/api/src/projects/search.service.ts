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

  async search(q: string, limit = 20): Promise<SearchHit[]> {
    const cleaned = q.trim();
    if (!cleaned) return [];

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
}
