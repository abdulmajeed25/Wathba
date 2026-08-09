import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Postgres full-text search across LIVE projects.
 *
 * WHAT THIS SEARCHES. The `searchVector` generated column (migration 0062)
 * covers title (A) + short description (B) + story (C). Creator name, the
 * category PATH and tags cannot live in a generated column — it cannot read
 * another table — so they are matched by JOIN and scored explicitly. That is
 * why the ranking is a blend rather than ts_rank alone.
 *
 * WEIGHTS, in the order the brief asked for: title > tags > creator > body.
 * ts_rank already separates title from body through the A/B/C weights; the tag
 * and creator bonuses sit between them.
 *
 * THREE WAYS TO MATCH, and each earns its place:
 *
 *  1. full-text on the vector. `websearch_to_tsquery` for multi-word input, so
 *     quotes / OR / - keep working.
 *  2. PREFIX on the final token. Without it a typeahead is not a typeahead:
 *     «جدا» returned 0 against «جداريات» because a tsquery term matches whole
 *     lexemes. This is what makes 3-character and single-letter search work.
 *  3. TRIGRAM for typos, via the `<%` operator on the normalised title.
 *     It replaces `similarity(a,b) > 0.25`, which was wrong twice over: a
 *     function call the GIN index cannot serve, AND a whole-string comparison,
 *     so a short query against a long title scored far below the threshold and
 *     the fallback never fired. Measured: «جدا» scores 0.158 by similarity and
 *     0.750 by word_similarity.
 *
 * Everything is normalised through wathba_normalize_arabic on BOTH sides —
 * alef variants, ta-marbuta, alef-maksura, harakat, tatweel, Arabic-Indic
 * digits — because Arabic readers routinely omit hamza and «الاحياء» used to
 * return 0 where «الأحياء» returned 3.
 */

export interface SearchHit {
  id: string;
  slug: string | null;
  titleAr: string;
  shortDescAr: string;
  category: string;
  raisedHalalas: number;
  fundingGoalHalalas: number;
  daysLeft: number;
  status: string;
  // Batch SEARCH Part 2 — image-rich suggestion rows.
  imageUrl: string | null;
  creatorName: string | null;
  fundedPct: number;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The LAST token of a query, as a prefix tsquery term, or null.
   *
   * Only the last token: the earlier words are complete — the reader typed a
   * space after them — so prefixing them would widen the match for no reason.
   * «مشروع نخي» should mean "mashroo3 AND nakhi*", not "mashroo3* AND nakhi*".
   *
   * Returns null when there is nothing to prefix, so the caller can emit a SQL
   * NULL and let the query's IS NOT NULL guards skip that arm — a bare `:*` is
   * a syntax error, and an empty term would match every row.
   *
   * Normalisation happens HERE for the same reason it happens in SQL for the
   * LIKE patterns: both sides of a comparison must be normalised, and the
   * tsvector holds normalised lexemes.
   */
  static prefixTerm(raw: string): string | null {
    const norm = raw
      .toLowerCase()
      .replace(/[\u064B-\u0655\u0640]/g, '')
      .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
      .replace(/\u0629/g, '\u0647')
      .replace(/\u0649/g, '\u064A')
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
    // Split on anything tsquery would treat as a separator, and drop the
    // characters that would make to_tsquery throw rather than not match.
    const tokens = norm.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const last = tokens[tokens.length - 1];
    if (!last) return null;
    const head = tokens.slice(0, -1);
    return [...head, `${last}:*`].join(' & ');
  }

  /**
   * The candidate-id set for a query — the ONE definition of "this project
   * matches these words".
   *
   * Extracted because there are two callers and they had drifted. /v1/search
   * matched title, body, creator, category and tag; /v1/discover's `?q=` matched
   * title and body only. Same reader, same words, two different result sets
   * depending on which page they landed on — «تقنية» found a project through the
   * header suggest and then found nothing on the results page it navigated to.
   * A shared builder is the only version of this that stays true.
   *
   * Shape is a UNION of single-predicate arms, not one OR-ed WHERE. See the
   * caller's comment for the measurement that forced it.
   */
  static candidateIds(cleaned: string): Prisma.Sql {
    const tsq = Prisma.sql`websearch_to_tsquery('simple', wathba_normalize_arabic(${cleaned}))`;
    const prefixTerm = SearchService.prefixTerm(cleaned);
    const like = Prisma.sql`('%' || wathba_normalize_arabic(${cleaned}) || '%')`;
    return Prisma.sql`
        SELECT p.id FROM "Project" p WHERE p."searchVector" @@ ${tsq}
        ${prefixTerm ? Prisma.sql`UNION SELECT p.id FROM "Project" p WHERE p."searchVector" @@ to_tsquery('simple', ${prefixTerm})` : Prisma.empty}
        UNION
        SELECT p.id FROM "Project" p
        WHERE wathba_normalize_arabic(${cleaned}) <% wathba_normalize_arabic(p."titleAr")
        UNION
        SELECT p.id FROM "Project" p JOIN "User" u2 ON u2.id = p."createdById"
        WHERE wathba_normalize_arabic(u2."name") LIKE ${like}
        UNION
        SELECT p.id FROM "Project" p JOIN "Category" c2 ON c2.id = p."categoryId"
        WHERE wathba_normalize_arabic(c2."nameAr") LIKE ${like}
        UNION
        SELECT xt."projectId" AS id FROM "ProjectTag" xt JOIN "Tag" xg ON xg.id = xt."tagId"
        WHERE wathba_normalize_arabic(xg."nameAr") LIKE ${like}`;
  }

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

    // ── the two forms the SCORING needs ─────────────────────────────────
    // Matching lives in candidateIds(); these two are only for ranking the rows
    // it returned. `tsq` is the whole-token query — prefix matches deliberately
    // do NOT contribute to ts_rank, because a half-typed word is weak evidence
    // and would outrank an exact title hit.
    const tsq = Prisma.sql`websearch_to_tsquery('simple', wathba_normalize_arabic(${cleaned}))`;
    // For creator / category / tag labels: a contains-match on the NORMALISED
    // label — and the pattern is normalised in SQL, not in JS. Normalising one
    // side only is the exact bug this batch exists to fix: the column would
    // hold «الاحياء» and the pattern «الأحياء», and they would never meet.
    // Building it here keeps a single normaliser and lets the expression
    // indexes from migration 0062 serve it.
    const like = Prisma.sql`('%' || wathba_normalize_arabic(${cleaned}) || '%')`;
    const rows: Array<{
      id: string;
      slug: string | null;
      titleAr: string;
      shortDescAr: string;
      category: string;
      raisedHalalas: bigint;
      fundingGoalHalalas: bigint;
      deadline: Date;
      status: string;
      imageUrl: string | null;
      creatorName: string | null;
    }> = await this.prisma.$queryRaw`
      -- CANDIDATES FIRST, then score.
      --
      -- The obvious shape — one SELECT with every match arm OR-ed in the WHERE —
      -- was measured and rejected: a multi-arm OR spanning Project, User,
      -- Category and Tag cannot be turned into a bitmap index scan, so Postgres
      -- fell back to a Seq Scan on Project AND a Seq Scan on User hashed for the
      -- join. Every GIN index this migration added went unused.
      --
      -- A UNION of single-predicate arms lets each one use its own index, and
      -- UNION de-duplicates the ids for free. The scoring join then touches only
      -- the rows that actually matched.
      WITH cand AS (${SearchService.candidateIds(cleaned)}
      )
      SELECT
        p."id",
        p."slug",
        p."titleAr",
        p."shortDescAr",
        p."category"::text AS category,
        p."raisedHalalas",
        p."fundingGoalHalalas",
        p."deadline",
        p."status"::text AS status,
        p."mediaUrls"[1] AS "imageUrl",
        u."name" AS "creatorName",
        -- The blend. ts_rank separates title from body via the stored A/B/C
        -- weights; the bonuses put tags above creator above body, which is the
        -- order asked for and cannot be expressed by setweight because neither
        -- tags nor the creator live in the vector.
        (
          ts_rank(p."searchVector", ${tsq}) * 4.0
          + CASE WHEN EXISTS (
              SELECT 1 FROM "ProjectTag" xt JOIN "Tag" xg ON xg.id = xt."tagId"
              WHERE xt."projectId" = p.id
                AND wathba_normalize_arabic(xg."nameAr") LIKE ${like}
            ) THEN 0.6 ELSE 0 END
          + CASE WHEN wathba_normalize_arabic(u."name") LIKE ${like} THEN 0.4 ELSE 0 END
          + CASE WHEN EXISTS (
              SELECT 1 FROM "Category" xc
              WHERE xc.id = p."categoryId"
                AND wathba_normalize_arabic(xc."nameAr") LIKE ${like}
            ) THEN 0.3 ELSE 0 END
          + CASE WHEN wathba_normalize_arabic(${cleaned}) <% wathba_normalize_arabic(p."titleAr") THEN 0.2 ELSE 0 END
        ) AS rank
      FROM cand
      JOIN "Project" p ON p.id = cand.id
      LEFT JOIN "User" u ON u."id" = p."createdById"
      WHERE p."status" IN ('LIVE','SUCCESSFUL','FUNDED')
        AND p."hiddenAt" IS NULL
        -- Test fixtures were NOT excluded here, unlike every other public
        -- surface — flagged fixtures were reachable by search while being
        -- filtered out of discover, the homepage and the sitemap. One surface
        -- disagreeing with the rest is how a fixture ends up in a screenshot.
        AND p."isTestFixture" = false
        ${catCond}
        ${statusCond}
      ORDER BY rank DESC, p."isStaffPick" DESC, p."createdAt" DESC
      LIMIT ${limit}::int
    `;

    const now = Date.now();
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
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
      imageUrl: r.imageUrl,
      creatorName: r.creatorName,
      fundedPct:
        r.fundingGoalHalalas > 0n
          ? Number((r.raisedHalalas * 100n) / r.fundingGoalHalalas)
          : 0,
    }));
  }

  /**
   * STAKES/L1 — header-search suggestions: projects + creators + categories +
   * tags in one debounced round-trip.
   *
   * The creator and category arms used to be Prisma `contains`, which compiles
   * to a raw ILIKE with NO normalisation at all — not even the diacritic
   * stripping the project search already had. A reader had to type the shadda
   * to find «رحّالة». They are normalised on both sides now, through the same
   * function and the same expression indexes as everything else.
   *
   * ONE CHARACTER IS ENOUGH. The floor was two, which meant the first keystroke
   * of every Arabic search returned nothing — and a single Arabic letter is far
   * more selective than a single Latin one because the alphabet is larger and
   * words are shorter. The prefix query makes one character meaningful.
   */
  async suggest(q: string): Promise<{
    projects: SearchHit[];
    creators: Array<{ id: string; name: string; handle: string | null; avatarUrl: string | null; projectsCount: number }>;
    categories: Array<{ slug: string; nameAr: string; parentSlug: string | null }>;
    tags: Array<{ slug: string; nameAr: string; usageCount: number }>;
  }> {
    const cleaned = q.trim();
    if (cleaned.length < 1) return { projects: [], creators: [], categories: [], tags: [] };

    const [projects, creators, categories, tags] = await Promise.all([
      this.search(cleaned, 5),
      this.prisma.$queryRaw<Array<{ id: string; name: string; handle: string | null; avatarUrl: string | null; n: number }>>`
        SELECT u.id, u.name, u.handle, u."avatarUrl",
               (SELECT count(*)::int FROM "Project" pr
                 WHERE pr."createdById" = u.id AND pr."publishedAt" IS NOT NULL
                   AND pr."hiddenAt" IS NULL AND pr."isTestFixture" = false) AS n
        FROM "User" u
        WHERE u."profilePublic" = true
          AND EXISTS (
            SELECT 1 FROM "Project" pr
            WHERE pr."createdById" = u.id AND pr."publishedAt" IS NOT NULL
              AND pr."hiddenAt" IS NULL AND pr."isTestFixture" = false
          )
          AND (
            wathba_normalize_arabic(u.name) LIKE ('%' || wathba_normalize_arabic(${cleaned}) || '%')
            OR u.handle LIKE (lower(${cleaned}) || '%')
          )
        ORDER BY n DESC
        LIMIT 3`,
      this.prisma.$queryRaw<Array<{ slug: string; nameAr: string; parentSlug: string | null }>>`
        SELECT c.slug, c."nameAr", par.slug AS "parentSlug"
        FROM "Category" c
        LEFT JOIN "Category" par ON par.id = c."parentId"
        WHERE c."isActive" = true
          AND (
            wathba_normalize_arabic(c."nameAr") LIKE ('%' || wathba_normalize_arabic(${cleaned}) || '%')
            OR c.slug LIKE (lower(${cleaned}) || '%')
          )
        ORDER BY c."sortOrder" ASC
        LIMIT 4`,
      this.prisma.$queryRaw<Array<{ slug: string; nameAr: string; usageCount: number }>>`
        SELECT t.slug, t."nameAr", t."usageCount"
        FROM "Tag" t
        WHERE t."isActive" = true
          AND wathba_normalize_arabic(t."nameAr") LIKE ('%' || wathba_normalize_arabic(${cleaned}) || '%')
        ORDER BY t."usageCount" DESC
        LIMIT 3`,
    ]);

    return {
      projects,
      creators: creators.map((u) => ({
        id: u.id, name: u.name, handle: u.handle, avatarUrl: u.avatarUrl,
        projectsCount: Number(u.n),
      })),
      categories,
      tags: tags.map((t) => ({ slug: t.slug, nameAr: t.nameAr, usageCount: Number(t.usageCount) })),
    };
  }

  /**
   * "هل تقصد…" — what to offer when a query returns nothing.
   *
   * Trigram nearest-neighbour over the things a reader could plausibly have
   * meant: a project title, a category, or a tag.
   *
   * TITLES use word_similarity, LABELS use similarity, and the split is the
   * same trap as the search path: a project title is a long string, so a
   * mistyped word compared against the WHOLE title scores far below any useful
   * threshold — «نخييل» scores 0.114 by similarity and 0.571 by
   * word_similarity. Category and tag names are short labels where whole-string
   * closeness IS the question, so they keep similarity.
   *
   * Only called on zero results, so its cost is paid on the one request where
   * the reader has nothing else to look at.
   */
  async didYouMean(q: string): Promise<{
    terms: string[];
    categories: Array<{ slug: string; nameAr: string }>;
    tags: Array<{ slug: string; nameAr: string }>;
  }> {
    const cleaned = q.trim();
    if (!cleaned) return { terms: [], categories: [], tags: [] };

    const [titles, categories, tags] = await Promise.all([
      this.prisma.$queryRaw<Array<{ titleAr: string }>>`
        SELECT p."titleAr"
        FROM "Project" p
        WHERE p."status" IN ('LIVE','SUCCESSFUL','FUNDED')
          AND p."hiddenAt" IS NULL AND p."isTestFixture" = false
          AND word_similarity(wathba_normalize_arabic(${cleaned}), wathba_normalize_arabic(p."titleAr")) > 0.45
        ORDER BY word_similarity(wathba_normalize_arabic(${cleaned}), wathba_normalize_arabic(p."titleAr")) DESC
        LIMIT 3`,
      this.prisma.$queryRaw<Array<{ slug: string; nameAr: string }>>`
        SELECT c.slug, c."nameAr"
        FROM "Category" c
        WHERE c."isActive" = true
          AND similarity(wathba_normalize_arabic(c."nameAr"), wathba_normalize_arabic(${cleaned})) > 0.2
        ORDER BY similarity(wathba_normalize_arabic(c."nameAr"), wathba_normalize_arabic(${cleaned})) DESC
        LIMIT 3`,
      this.prisma.$queryRaw<Array<{ slug: string; nameAr: string }>>`
        SELECT t.slug, t."nameAr"
        FROM "Tag" t
        WHERE t."isActive" = true
          AND similarity(wathba_normalize_arabic(t."nameAr"), wathba_normalize_arabic(${cleaned})) > 0.2
        ORDER BY similarity(wathba_normalize_arabic(t."nameAr"), wathba_normalize_arabic(${cleaned})) DESC
        LIMIT 3`,
    ]);

    return {
      terms: titles.map((t) => t.titleAr),
      categories,
      tags,
    };
  }
}
