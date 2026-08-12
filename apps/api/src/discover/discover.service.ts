import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { cardVideoUrl, rawCardMedia } from '../common/card-media';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../projects/search.service';
import { DiscoverQueryDto } from './dto/discover-query.dto';

/**
 * Batch DISC — the advanced discover query engine.
 *
 * Filters are fully composable (AND across sections, OR within a multi-select
 * section) and every facet's live counts respect the OTHER active filters (a
 * facet dimension is computed with all conditions EXCEPT its own — standard
 * faceted-search behaviour). Raw SQL is used deliberately: percent-funded is a
 * column ratio and the relevance sort is a computed blend, neither expressible
 * in the Prisma query builder. Bookmarks/collections are EXISTS sub-selects.
 */

const FUNDED_SET = ['SUCCESSFUL', 'FUNDED', 'IN_PRODUCTION', 'DELIVERED'];
const ENDED_SET = ['FAILED', 'REFUNDED'];

// SAR goal/raised brackets (halalas). min inclusive, max exclusive; null = open.
const MONEY_BRACKETS: Array<{ key: string; minH: number | null; maxH: number | null }> = [
  { key: 'lt10k', minH: null, maxH: 1_000_000 },
  { key: '10k_100k', minH: 1_000_000, maxH: 10_000_000 },
  { key: '100k_1m', minH: 10_000_000, maxH: 100_000_000 },
  { key: 'gt1m', minH: 100_000_000, maxH: null },
];
const PCT_BUCKETS = ['lt25', 'p25_50', 'p50_75', 'p75_100', 'gt100'];

/**
 * Campaign-length buckets, in days.
 *
 * Chosen against the real spread (30-69 days, and 503 of 517 projects sit in
 * 30-45) rather than as round numbers. That concentration means the facet
 * discriminates almost nothing TODAY — it is shipped because the boundaries are
 * right for the campaign lengths the platform allows (7-120 by policy), and it
 * starts doing work the moment creators use that range. The counts say so
 * honestly in the meantime.
 */
const DURATION_BUCKETS: Array<{ key: string; lo: number | null; hi: number | null }> = [
  { key: 'lt30', lo: null, hi: 30 },
  { key: 'd30_45', lo: 30, hi: 45 },
  { key: 'd45_60', lo: 45, hi: 60 },
  { key: 'gte60', lo: 60, hi: null },
];

interface NormalizedFilters {
  /** Batch SEARCH Part 3 — free-text query (unified search/discover layer). */
  q?: string;
  statuses: string[];
  includeEnded: boolean;
  categoryIds: string[];
  /** Whether ?cat= was supplied at all — see the empty-resolution note. */
  catRequested: boolean;
  tagSlugs: string[];
  hasVideo: boolean;
  duration?: string;
  region?: string;
  goalMinH?: number;
  goalMaxH?: number;
  raisedMinH?: number;
  raisedMaxH?: number;
  pct?: string;
  staffPick: boolean;
  recommended: boolean;
  savedOnly: boolean;
  recommendedCatIds: string[];
  collectionId?: string;
  viewerId?: string;
  sort: string;
  page: number;
  take: number;
}

export interface DiscoverCard {
  id: string;
  titleAr: string;
  shortDescAr: string;
  categoryId: string | null;
  region: string | null;
  isStaffPick: boolean;
  status: string;
  fundingGoalHalalas: number;
  raisedHalalas: number;
  backersCount: number;
  deadline: string;
  publishedAt: string | null;
  mediaUrls: string[];
  /// Stage 1 item 12 — null until a creator uploads one (migration 0059), and
  /// ALSO null when the creator pinned the card to its poster (migration 0060).
  /// A card surface never has to know which of the two it is; see
  /// common/card-media.ts.
  videoUrl: string | null;
  slug: string | null;
  saved: boolean;
  creatorName: string;
}

/** Shape of the single facet statement's json_build_object result. */
interface FacetPayload {
  scalars: Record<string, number> & { st_live: number; st_funded: number; st_ended: number; staff: number };
  regions: Record<string, number>;
  collections: Array<{ slug: string; nameAr: string; count: number }>;
  tags: Array<{ slug: string; nameAr: string; count: number }>;
  categories: CategoryFacetNode[];
}

/**
 * One node of the category facet.
 *
 * FLAT, in pre-order, with `depth` — not nested. Two contracts make that
 * isomorphic to a tree and keep every existing consumer working:
 *
 *  1. the array is pre-order DFS, so a node is immediately followed by its
 *     whole subtree and `depth` alone renders any shape;
 *  2. a node is omitted iff `depth > 0 AND count === 0`, where `count` is the
 *     ROLLED count — pruning on own-count would orphan a non-empty grandchild
 *     and break contract 1.
 *
 * `slug`/`nameAr`/`parentSlug`/`count` keep their old meaning, so the fields
 * the sidebar already reads are untouched; `path`, `catParam`, `depth`,
 * `ownCount` and `hasChildren` are additive.
 */
export interface CategoryFacetNode {
  slug: string;
  nameAr: string;
  /** The IMMEDIATE parent's bare slug; null iff depth === 0. */
  parentSlug: string | null;
  /** Own projects plus every descendant's, at any depth. */
  count: number;
  ownCount: number;
  /** '/'-joined ancestor chain — mirrors the /projects/discover/… route. */
  path: string;
  /** '.'-joined — drop straight into ?cat=. See splitCatRefs for why '.'. */
  catParam: string;
  depth: number;
  hasChildren: boolean;
}

@Injectable()
export class DiscoverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The category tree, walked once, with each node's materialised path.
   *
   * A recursive CTE rather than the two hand-written hops this replaced. The
   * old expansion descended EXACTLY ONE level — it collected the nodes matching
   * the requested slugs, then their direct children, and stopped — so a
   * grandchild was invisible to every filter and every count. That was
   * invisible in production only because the tree happened to be two levels
   * deep; the schema has always been an unbounded self-relation.
   *
   * What the CTE carries and why:
   *  - `path`   '/'-joined ancestor chain. Descendant tests become a prefix
   *             match (`LIKE path || '/%'`), which is exact as long as no slug
   *             contains a '/' — enforced by the Category_slug_shape CHECK.
   *  - `id_path` ancestors including self, as an array. This is what makes the
   *             count roll-up linear: unnest it and group, rather than a
   *             correlated prefix-sum per node.
   *  - `sort_key` a single text column that sorts the whole tree into pre-order.
   *             Two parallel columns (ordinal, path) is the obvious alternative
   *             and is NOT correct pre-order when sortOrder ties at an
   *             intermediate level.
   *
   * `depth < 16` is load-bearing, not decoration: Category.parentId is a
   * self-FK, which does not prevent a cycle. Without the guard a cycle is an
   * infinite recursion rather than a truncated subtree.
   */
  private static readonly CAT_TREE = Prisma.sql`
    cat_tree AS (
      SELECT c.id, c."parentId", c.slug, c."nameAr", c."isActive", c."sortOrder",
             NULL::text AS parent_slug,
             c.slug::text AS path,
             0 AS depth,
             ARRAY[c.id] AS id_path,
             lpad((c."sortOrder" + 1000000)::text, 9, '0') || ':' || c.slug || '/' AS sort_key
      FROM "Category" c
      WHERE c."parentId" IS NULL
      UNION ALL
      SELECT c.id, c."parentId", c.slug, c."nameAr", c."isActive", c."sortOrder",
             t.slug,
             t.path || '/' || c.slug,
             t.depth + 1,
             t.id_path || c.id,
             t.sort_key || lpad((c."sortOrder" + 1000000)::text, 9, '0') || ':' || c.slug || '/'
      FROM "Category" c
      JOIN cat_tree t ON c."parentId" = t.id
      WHERE t.depth < 16
    )`;

  /**
   * Split `?cat=` values into legacy bare slugs and path-qualified refs.
   *
   * A bare slug is ambiguous below the top level — 8 subcategory slugs repeat
   * across different parents (`events`, `web`, `comedy`, …) and `@@unique` is
   * only `[parentId, slug]`, so `?cat=events` used to silently union every
   * homonym at once and light up all of them in the sidebar. A qualified ref
   * («technology.drones») names exactly one node.
   *
   * '.' is the wire separator and '/' is accepted as an alias. The reason is
   * URLSearchParams, which the web's discoverQS() uses: it percent-encodes '/'
   * to %2F and leaves '.' alone, so '.' is the only separator that survives
   * into a shareable, readable URL through the code path this repo already has.
   */
  static splitCatRefs(refs: string[]): { bare: string[]; paths: string[] } {
    const bare: string[] = [];
    const paths: string[] = [];
    for (const raw of refs) {
      const v = raw.trim();
      if (!v) continue;
      if (v.includes('.') || v.includes('/')) paths.push(v.replace(/\./g, '/'));
      else bare.push(v);
    }
    return { bare, paths };
  }

  /**
   * Resolve `?cat=` refs to the ids of the matching nodes AND all their
   * descendants, at any depth.
   *
   * Resolution rules, in order:
   *  - qualified ref  → exact path match. NO fallback to bare matching: a typo
   *                     must resolve to nothing, not to every node that happens
   *                     to share a leaf slug.
   *  - bare + matches a top-level slug → that node. Unambiguous, because
   *                     top-level slugs are globally unique.
   *  - bare, no top-level match → every node with that slug at any depth. This
   *                     is the OLD behaviour, kept verbatim so existing links
   *                     and bookmarks keep working.
   */
  private async expandCategoryRefs(refs: string[]): Promise<string[]> {
    if (refs.length === 0) return [];
    const { bare, paths } = DiscoverService.splitCatRefs(refs);
    if (!bare.length && !paths.length) return [];
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH RECURSIVE ${DiscoverService.CAT_TREE},
      cat_roots AS (
        SELECT id, path FROM cat_tree
        WHERE path = ANY(${paths}::text[])
           OR (
             slug = ANY(${bare}::text[])
             AND (
               depth = 0
               -- A bare slug that names a top-level node means THAT node; the
               -- any-depth arm is only for slugs with no top-level match.
               OR NOT EXISTS (
                 SELECT 1 FROM cat_tree top
                 WHERE top.depth = 0 AND top.slug = cat_tree.slug
               )
             )
           )
      )
      SELECT DISTINCT t.id
      FROM cat_tree t
      JOIN cat_roots r ON t.path = r.path OR t.path LIKE r.path || '/%'`);
    return rows.map((r) => r.id);
  }

  private async recommendedCategoryIds(viewerId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ categoryId: string }>>(Prisma.sql`
      SELECT DISTINCT pr."categoryId" AS "categoryId"
      FROM "Pledge" pl JOIN "Project" pr ON pr.id = pl."projectId"
      WHERE pl."backerId" = ${viewerId}::uuid AND pr."categoryId" IS NOT NULL
      UNION
      SELECT DISTINCT pr."categoryId" AS "categoryId"
      FROM "CreatorFollow" cf
        JOIN "CreatorProfile" cp ON cp.id = cf."creatorProfileId"
        JOIN "Project" pr ON pr."createdById" = cp."userId"
      WHERE cf."followerId" = ${viewerId}::uuid AND pr."categoryId" IS NOT NULL
    `);
    return rows.map((r) => r.categoryId).filter(Boolean);
  }

  private async normalize(q: DiscoverQueryDto, viewerId?: string): Promise<NormalizedFilters> {
    const csv = (s?: string): string[] =>
      (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    const only = csv(q.only);
    const recommended = only.includes('recommended');
    return {
      q: (q.q ?? '').trim() || undefined,
      statuses: csv(q.status).filter((s) => s === 'live' || s === 'funded'),
      includeEnded: q.includeEnded === '1' || q.includeEnded === 'true',
      categoryIds: await this.expandCategoryRefs(csv(q.cat)),
      catRequested: csv(q.cat).length > 0,
      tagSlugs: csv(q.tag),
      hasVideo: q.hasVideo === '1' || q.hasVideo === 'true',
      duration: DURATION_BUCKETS.some((b) => b.key === q.duration) ? q.duration : undefined,
      region: q.region,
      goalMinH: q.goalMin != null ? q.goalMin * 100 : undefined,
      goalMaxH: q.goalMax != null ? q.goalMax * 100 : undefined,
      raisedMinH: q.raisedMin != null ? q.raisedMin * 100 : undefined,
      raisedMaxH: q.raisedMax != null ? q.raisedMax * 100 : undefined,
      pct: PCT_BUCKETS.includes(q.pct ?? '') ? q.pct : undefined,
      staffPick: only.includes('staff'),
      recommended,
      savedOnly: only.includes('saved'),
      recommendedCatIds: recommended && viewerId ? await this.recommendedCategoryIds(viewerId) : [],
      collectionId: await this.resolveCollectionId(q.collection),
      viewerId,
      sort: q.sort ?? 'relevance',
      page: q.page ?? 0,
      take: q.take ?? 24,
    };
  }

  private async resolveCollectionId(slug?: string): Promise<string | undefined> {
    if (!slug) return undefined;
    const c = await this.prisma.collection.findUnique({ where: { slug }, select: { id: true } });
    return c?.id;
  }

  // ---- WHERE condition fragments, keyed by dimension ------------------------
  private conditions(f: NormalizedFilters): Record<string, Prisma.Sql> {
    const c: Record<string, Prisma.Sql> = {};

    // Batch OPS — moderation takedowns (hiddenAt) never surface publicly.
    // Not a facet dimension: it is never relaxed by an "except" pass, so
    // hidden projects don't leak into facet counts either.
    //
    // POLISH Unit 6 — automated-test fixtures ride along in the same clause, for
    // the same reason: this is the one place the whole discover surface (rows AND
    // facet counts) passes through, so a fixture cannot reappear in a count even
    // if it is filtered out of the list.
    //
    // EXCEPT on «المحفوظة»: a saved list is a record of what THIS user chose to
    // bookmark, not a discovery surface. Silently dropping a row someone
    // deliberately saved would be a worse bug than the one being fixed here, so
    // the fixture filter applies to browsing, never to a personal list.
    c.visible = f.savedOnly
      ? Prisma.sql`p."hiddenAt" IS NULL`
      : Prisma.sql`p."hiddenAt" IS NULL AND p."isTestFixture" = false`;

    const wantLive = f.statuses.includes('live');
    const wantFunded = f.statuses.includes('funded');
    const none = !wantLive && !wantFunded;
    const set: string[] = [];
    if (wantLive || none) set.push('LIVE');
    if (wantFunded || none) set.push(...FUNDED_SET);
    if (f.includeEnded) set.push(...ENDED_SET);
    const statusParts = [Prisma.sql`p.status::text = ANY(${set})`];
    if (!f.includeEnded) statusParts.push(Prisma.sql`(p.status <> 'LIVE' OR p.deadline >= now())`);
    c.status = Prisma.sql`(${Prisma.join(statusParts, ' AND ')})`;

    if (f.categoryIds.length) {
      c.category = Prisma.sql`p."categoryId" = ANY(${f.categoryIds}::uuid[])`;
    } else if (f.catRequested) {
      // A ?cat= that resolves to NOTHING must return nothing.
      //
      // Leaving the dimension unset instead — which is what "if (ids.length)"
      // alone does — drops the filter entirely, so a typo in a category ref
      // silently WIDENS the result to the whole platform. The reader sees a
      // full page of projects and no indication that their filter was ignored,
      // which is the worst of both: wrong, and wrong in a way that looks
      // deliberate. Same treatment `recommended` already gives an empty set.
      c.category = Prisma.sql`false`;
    }
    if (f.region) c.region = Prisma.sql`p.region::text = ${f.region}`;

    const goal: Prisma.Sql[] = [];
    if (f.goalMinH != null) goal.push(Prisma.sql`p."fundingGoalHalalas" >= ${f.goalMinH}`);
    if (f.goalMaxH != null) goal.push(Prisma.sql`p."fundingGoalHalalas" <= ${f.goalMaxH}`);
    if (goal.length) c.goal = Prisma.sql`(${Prisma.join(goal, ' AND ')})`;

    const raised: Prisma.Sql[] = [];
    if (f.raisedMinH != null) raised.push(Prisma.sql`p."raisedHalalas" >= ${f.raisedMinH}`);
    if (f.raisedMaxH != null) raised.push(Prisma.sql`p."raisedHalalas" <= ${f.raisedMaxH}`);
    if (raised.length) c.raised = Prisma.sql`(${Prisma.join(raised, ' AND ')})`;

    if (f.tagSlugs.length) {
      // OR within the group, like categories and statuses: a project carrying
      // ANY of the selected tags is kept. Tags are cross-cutting by design, so
      // AND would almost always return nothing.
      c.tag = Prisma.sql`EXISTS (
        SELECT 1 FROM "ProjectTag" pt JOIN "Tag" tg ON tg.id = pt."tagId"
        WHERE pt."projectId" = p.id AND tg."isActive" = true AND tg.slug = ANY(${f.tagSlugs}::text[])
      )`;
    }
    // "Has a video" means what the CARD will do, not what the project owns: a
    // creator who pinned their card to its poster has a campaign video and an
    // image card, and this facet is about browsing. Same rule as the card
    // payloads — see common/card-media.ts.
    if (f.hasVideo) c.video = Prisma.sql`(p."videoUrl" IS NOT NULL AND p."cardMedia" = 'VIDEO')`;
    if (f.duration) c.duration = this.durationCondition(f.duration);
    if (f.pct) c.pct = this.pctCondition(f.pct);
    if (f.staffPick) c.staff = Prisma.sql`p."isStaffPick" = true`;
    if (f.recommended) {
      c.recommended = f.recommendedCatIds.length
        ? Prisma.sql`p."categoryId"::text = ANY(${f.recommendedCatIds})`
        : Prisma.sql`false`;
    }
    if (f.savedOnly) {
      c.saved = f.viewerId
        ? Prisma.sql`EXISTS (SELECT 1 FROM "SavedProject" s WHERE s."projectId" = p.id AND s."userId" = ${f.viewerId}::uuid)`
        : Prisma.sql`false`;
    }
    if (f.collectionId) {
      c.collection = Prisma.sql`EXISTS (SELECT 1 FROM "ProjectCollection" pc WHERE pc."projectId" = p.id AND pc."collectionId" = ${f.collectionId}::uuid)`;
    }
    if (f.q) {
      // THE SAME candidate set /v1/search uses — literally the same builder, not
      // a second predicate that resembles it.
      //
      // It used to be a copy, and the copy had drifted: this one matched title
      // and body, while /v1/search also matched creator, category and tag. So
      // «تقنية» was found by the header suggest and then found NOTHING on the
      // results page the reader was sent to — no error, just an empty list for a
      // word the platform had already told them was a hit.
      //
      // A semi-join rather than OR-ed arms: the UNION inside lets each arm use
      // its own GIN index, which a multi-arm OR across four tables cannot do.
      c.q = Prisma.sql`p.id IN (${SearchService.candidateIds(f.q)})`;
    }
    return c;
  }

  /**
   * Percent-funded, as an expression over whichever alias the caller is in.
   *
   * `list()` reads columns off `p`; the single-statement facet query reads a
   * precomputed `pct_val` off its CTE. Parameterising the expression is what
   * stops those two drifting into different bucket boundaries — the kind of
   * divergence that shows as "the facet says 12 and the list shows 11".
   */
  private static readonly PCT_EXPR_P = Prisma.sql`(p."raisedHalalas"::numeric * 100 / NULLIF(p."fundingGoalHalalas", 0)::numeric)`;

  /** Campaign-length bucket over an arbitrary column expression. */
  private durationCondition(bucket: string, expr: Prisma.Sql = Prisma.sql`p."durationDays"`): Prisma.Sql {
    const b = DURATION_BUCKETS.find((x) => x.key === bucket);
    if (!b) return Prisma.sql`true`;
    const parts: Prisma.Sql[] = [];
    if (b.lo != null) parts.push(Prisma.sql`${expr} >= ${b.lo}`);
    if (b.hi != null) parts.push(Prisma.sql`${expr} < ${b.hi}`);
    return parts.length ? Prisma.sql`(${Prisma.join(parts, ' AND ')})` : Prisma.sql`true`;
  }

  private pctCondition(bucket: string, expr: Prisma.Sql = DiscoverService.PCT_EXPR_P): Prisma.Sql {
    const r = expr;
    switch (bucket) {
      case 'lt25': return Prisma.sql`${r} < 25`;
      case 'p25_50': return Prisma.sql`${r} >= 25 AND ${r} < 50`;
      case 'p50_75': return Prisma.sql`${r} >= 50 AND ${r} < 75`;
      case 'p75_100': return Prisma.sql`${r} >= 75 AND ${r} <= 100`;
      case 'gt100': return Prisma.sql`${r} > 100`;
      default: return Prisma.sql`true`;
    }
  }

  private whereClause(c: Record<string, Prisma.Sql>, except?: string): Prisma.Sql {
    const parts = Object.entries(c).filter(([k]) => k !== except).map(([, v]) => v);
    return parts.length ? Prisma.sql`WHERE ${Prisma.join(parts, ' AND ')}` : Prisma.empty;
  }

  /** AND an extra predicate onto a (possibly empty) WHERE clause. */
  private combine(base: Prisma.Sql, extra: Prisma.Sql): Prisma.Sql {
    return base === Prisma.empty ? Prisma.sql`WHERE ${extra}` : Prisma.sql`${base} AND ${extra}`;
  }

  /** Bare AND-joined predicate (no WHERE keyword) for the OTHER conditions. */
  private predicate(c: Record<string, Prisma.Sql>, except?: string): Prisma.Sql {
    const parts = Object.entries(c).filter(([k]) => k !== except).map(([, v]) => v);
    return parts.length ? Prisma.join(parts, ' AND ') : Prisma.sql`true`;
  }

  private readonly VELOCITY = Prisma.sql`(SELECT count(*) FROM "Pledge" pl WHERE pl."projectId" = p.id AND pl."createdAt" >= now() - interval '72 hours' AND pl.status IN ('HELD','CAPTURED'))`;

  private orderClause(sort: string, region?: string, q?: string): Prisma.Sql {
    switch (sort) {
      case 'popular':
        return Prisma.sql`ORDER BY ${this.VELOCITY} DESC, p."backersCount" DESC, p.id DESC`;
      case 'newest':
        return Prisma.sql`ORDER BY p."publishedAt" DESC NULLS LAST, p.id DESC`;
      case 'ending':
        return Prisma.sql`ORDER BY (p.status = 'LIVE') DESC, p.deadline ASC, p.id DESC`;
      case 'most_funded':
        return Prisma.sql`ORDER BY p."raisedHalalas" DESC, p.id DESC`;
      case 'most_backed':
        return Prisma.sql`ORDER BY p."backersCount" DESC, p.id DESC`;
      case 'near_me':
        return region
          ? Prisma.sql`ORDER BY (p.region::text = ${region}) DESC, p."publishedAt" DESC NULLS LAST, p.id DESC`
          : Prisma.sql`ORDER BY p."publishedAt" DESC NULLS LAST, p.id DESC`;
      case 'relevance':
      default:
        // With a text query, textual rank leads; the staff/velocity blend
        // breaks ties. Without one: staff-pick boost → velocity → recency.
        if (q) {
          return Prisma.sql`ORDER BY ts_rank(p."searchVector", websearch_to_tsquery('simple', wathba_normalize_arabic(${q}))) DESC, p."isStaffPick" DESC, ${this.VELOCITY} DESC, p.id DESC`;
        }
        return Prisma.sql`ORDER BY p."isStaffPick" DESC, ${this.VELOCITY} DESC, p."publishedAt" DESC NULLS LAST, p.id DESC`;
    }
  }

  // ---- list + total ---------------------------------------------------------
  async list(q: DiscoverQueryDto, viewerId?: string): Promise<{
    items: DiscoverCard[];
    total: number;
    page: number;
    take: number;
    hasMore: boolean;
  }> {
    const f = await this.normalize(q, viewerId);
    const c = this.conditions(f);
    const where = this.whereClause(c);
    const order = this.orderClause(f.sort, f.region, f.q);
    const offset = f.page * f.take;

    const savedSel = f.viewerId
      ? Prisma.sql`EXISTS (SELECT 1 FROM "SavedProject" s WHERE s."projectId" = p.id AND s."userId" = ${f.viewerId}::uuid)`
      : Prisma.sql`false`;

    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT p.id, p."titleAr", p."shortDescAr", p."categoryId", p.region::text AS region,
             p."isStaffPick", p.status::text AS status, p."fundingGoalHalalas", p."raisedHalalas",
             p."backersCount", p.deadline, p."publishedAt", p."mediaUrls", p."videoUrl", p."cardMedia", p.slug,
             ${savedSel} AS saved, u.name AS "creatorName"
      FROM "Project" p
      JOIN "User" u ON u.id = p."createdById"
      ${where}
      ${order}
      LIMIT ${f.take} OFFSET ${offset}
    `);

    const totalRows = await this.prisma.$queryRaw<Array<{ n: number }>>(Prisma.sql`
      SELECT count(*)::int AS n FROM "Project" p ${where}
    `);
    const total = totalRows[0]?.n ?? 0;

    const items = rows.map((r) => this.toCard(r));
    return { items, total, page: f.page, take: f.take, hasMore: offset + items.length < total };
  }

  private toCard(r: Record<string, unknown>): DiscoverCard {
    const num = (v: unknown): number => (typeof v === 'bigint' ? Number(v) : Number(v ?? 0));
    const d = r.deadline as Date | null;
    const pub = r.publishedAt as Date | null;
    return {
      id: r.id as string,
      titleAr: r.titleAr as string,
      shortDescAr: r.shortDescAr as string,
      categoryId: (r.categoryId as string) ?? null,
      region: (r.region as string) ?? null,
      isStaffPick: Boolean(r.isStaffPick),
      status: r.status as string,
      fundingGoalHalalas: num(r.fundingGoalHalalas),
      raisedHalalas: num(r.raisedHalalas),
      backersCount: num(r.backersCount),
      deadline: d ? new Date(d).toISOString() : '',
      publishedAt: pub ? new Date(pub).toISOString() : null,
      mediaUrls: (r.mediaUrls as string[]) ?? [],
      // Locals, so the only `videoUrl:` in this object literal is the resolved
      // one. A raw read here would be indistinguishable, to a reader and to the
      // guard in card-media.spec.ts, from a surface that forgot the rule.
      videoUrl: cardVideoUrl(rawCardMedia(r)),
      slug: (r.slug as string) ?? null,
      saved: Boolean(r.saved),
      creatorName: (r.creatorName as string) ?? '',
    };
  }

  // ---- facets (live counts respecting the OTHER active filters) -------------

  /**
   * The dimension partition that makes ONE query provably equal to nineteen.
   *
   * `whereClause(c, except)` drops exactly one key, so for an excepted
   * dimension d the predicate is ⋀ over every OTHER key. Partition the keys
   * conditions() can emit into two disjoint sets:
   *
   *   HOISTED   — never passed as `except` by any caller, because no facet
   *               exists for them. They apply to every facet, so they can live
   *               in the base scan's WHERE.
   *   EXCEPTED  — each owns exactly one facet. They must NOT be in the base
   *               WHERE, because that facet needs the universe without them;
   *               they are carried as per-row boolean flags instead.
   *
   * Because the sets are disjoint, this identity is exact rather than an
   * approximation:
   *
   *   whereClause(c, d) ≡ (⋀ HOISTED) ∧ (⋀ over EXCEPTED \ {d})
   *
   * so one scan producing the flags answers every dimension. A free
   * consequence: nineteen statements each evaluated their own now(), and the
   * status facet could disagree with the list across a deadline crossing
   * mid-request. One statement means one now().
   */
  private static readonly HOISTED_DIMS = ['visible', 'recommended', 'saved', 'q'] as const;
  private static readonly EXCEPTED_DIMS = [
    'status', 'category', 'region', 'goal', 'raised', 'pct', 'staff', 'collection',
    'tag', 'video', 'duration',
  ] as const;

  /** The flag expression for one dimension — TRUE when that filter is inactive. */
  private dimFlag(c: Record<string, Prisma.Sql>, d: string): Prisma.Sql {
    return c[d] ? Prisma.sql`(${c[d]})` : Prisma.sql`true`;
  }

  /** "every excepted dimension but d", as a conjunction of the flag columns. */
  private exceptFlags(d: string, alias = ''): Prisma.Sql {
    const pfx = alias ? `${alias}.` : '';
    const others = DiscoverService.EXCEPTED_DIMS.filter((x) => x !== d).map((x) =>
      Prisma.raw(`${pfx}m_${x}`),
    );
    return Prisma.join(others, ' AND ');
  }

  /** The hoisted conditions, as the base scan's WHERE. */
  private hoistedWhere(c: Record<string, Prisma.Sql>): Prisma.Sql {
    const parts = DiscoverService.HOISTED_DIMS.filter((k) => c[k]).map((k) => c[k]!);
    return parts.length ? Prisma.sql`WHERE ${Prisma.join(parts, ' AND ')}` : Prisma.empty;
  }

  /**
   * The nineteen-round-trip implementation, retained and unrouted.
   *
   * Kept ONLY so facets() can be differentially tested against it across a
   * matrix of filter combinations. Collapsing nineteen queries into one is
   * exactly the kind of change where an off-by-one in a bracket boundary is
   * invisible, and asserting the two agree is the only cheap way to be sure the
   * "except" semantics survived. Delete once the matrix has ridden a release.
   */
  async facetsLegacy(q: DiscoverQueryDto, viewerId?: string): Promise<Record<string, unknown>> {
    const f = await this.normalize(q, viewerId);
    const c = this.conditions(f);

    const countWhere = async (except: string, extra?: Prisma.Sql): Promise<number> => {
      const base = this.whereClause(c, except);
      const where = extra ? this.combine(base, extra) : base;
      const rows = await this.prisma.$queryRaw<Array<{ n: number }>>(Prisma.sql`SELECT count(*)::int AS n FROM "Project" p ${where}`);
      return rows[0]?.n ?? 0;
    };

    // STAKES/M3 — the audit measured this endpoint at 302ms p95: ~19
    // aggregate round-trips ran SEQUENTIALLY. Every query is an independent
    // read with its own "except"-WHERE, so fan them all out in one
    // Promise.all (categories keeps its own two-step dependency inside).
    const [categories, statusRow, regionRows, pctEntries, moneyEntries, staff, collRows] =
      await Promise.all([
        // Category tree with own counts (except-category), rolled up to parents.
        (async () => {
          const catWhere = this.combine(this.whereClause(c, 'category'), Prisma.sql`p."categoryId" IS NOT NULL`);
          const catRows = await this.prisma.$queryRaw<Array<{ categoryId: string; n: number }>>(Prisma.sql`
            SELECT p."categoryId" AS "categoryId", count(*)::int AS n
            FROM "Project" p ${catWhere}
            GROUP BY p."categoryId"
          `);
          const own = new Map<string, number>();
          for (const r of catRows) own.set(r.categoryId, r.n);
          return this.buildCategoryFacet(own);
        })(),
        // Status facet (except-status): count each universe under the other filters.
        (() => {
          const statusWhere = this.whereClause(c, 'status');
          return this.prisma.$queryRaw<Array<{ live: number; funded: number; ended: number }>>(Prisma.sql`
            SELECT
              count(*) FILTER (WHERE p.status = 'LIVE' AND p.deadline >= now())::int AS live,
              count(*) FILTER (WHERE p.status::text = ANY(${FUNDED_SET}))::int AS funded,
              count(*) FILTER (WHERE p.status::text = ANY(${ENDED_SET}) OR (p.status = 'LIVE' AND p.deadline < now()))::int AS ended
            FROM "Project" p ${statusWhere}
          `);
        })(),
        // Region facet (except-region).
        (() => {
          const regionWhere = this.combine(this.whereClause(c, 'region'), Prisma.sql`p.region IS NOT NULL`);
          return this.prisma.$queryRaw<Array<{ region: string; n: number }>>(Prisma.sql`
            SELECT p.region::text AS region, count(*)::int AS n
            FROM "Project" p ${regionWhere}
            GROUP BY p.region
          `);
        })(),
        // Percent buckets (except-pct).
        Promise.all(
          PCT_BUCKETS.map(async (b) => [b, await countWhere('pct', this.pctCondition(b))] as const),
        ),
        // Goal + raised brackets.
        Promise.all(
          MONEY_BRACKETS.flatMap((br) => [
            (async () => ['goal', br.key, await countWhere('goal', this.moneyBracket('fundingGoalHalalas', br))] as const)(),
            (async () => ['raised', br.key, await countWhere('raised', this.moneyBracket('raisedHalalas', br))] as const)(),
          ]),
        ),
        countWhere('staff', Prisma.sql`p."isStaffPick" = true`),
        // Collection facet (active collections; counts under the other filters).
        this.prisma.$queryRaw<Array<{ slug: string; nameAr: string; n: number }>>(Prisma.sql`
          SELECT col.slug AS slug, col."nameAr" AS "nameAr", count(p.id)::int AS n
          FROM "Collection" col
            JOIN "ProjectCollection" pc ON pc."collectionId" = col.id
            JOIN "Project" p ON p.id = pc."projectId" AND (${this.predicate(c, 'collection')})
          WHERE col."isActive" = true
          GROUP BY col.slug, col."nameAr", col."sortOrder"
          ORDER BY col."sortOrder" ASC
        `),
      ]);

    const statuses = statusRow[0] ?? { live: 0, funded: 0, ended: 0 };
    const regions = Object.fromEntries(regionRows.map((r) => [r.region, r.n]));
    const pct: Record<string, number> = Object.fromEntries(pctEntries);
    const goals: Record<string, number> = {};
    const raised: Record<string, number> = {};
    for (const [kind, key, n] of moneyEntries) {
      if (kind === 'goal') goals[key] = n;
      else raised[key] = n;
    }
    const collections = collRows.map((r) => ({ slug: r.slug, nameAr: r.nameAr, count: r.n }));

    return { statuses, categories, regions, pct, goals, raised, staff, collections };
  }

  /**
   * Every facet, in ONE statement.
   *
   * The base CTE scans Project once under the hoisted predicate and
   * materialises a boolean flag per excepted dimension; each facet is then a
   * FILTER over that tuplestore re-applying the other dimensions' flags. See
   * the partition note above for why this is exactly equal to the nineteen
   * queries it replaces, and facets.differential.spec.ts for the proof.
   */
  async facets(q: DiscoverQueryDto, viewerId?: string): Promise<Record<string, unknown>> {
    const f = await this.normalize(q, viewerId);
    const c = this.conditions(f);

    const flags = Prisma.join(
      DiscoverService.EXCEPTED_DIMS.map(
        (d) => Prisma.sql`${this.dimFlag(c, d)} AS ${Prisma.raw(`m_${d}`)}`,
      ),
      ', ',
    );

    const PCT = Prisma.sql`pct_val`;
    const pctCounts = Prisma.join(
      PCT_BUCKETS.map(
        (b) => Prisma.sql`count(*) FILTER (WHERE ${this.exceptFlags('pct')} AND ${this.pctCondition(b, PCT)})::int AS ${Prisma.raw(`pct_${b}`)}`,
      ),
      ', ',
    );
    const durationCounts = Prisma.join(
      DURATION_BUCKETS.map(
        (b) => Prisma.sql`count(*) FILTER (WHERE ${this.exceptFlags('duration')} AND ${this.durationCondition(b.key, Prisma.sql`duration_days`)})::int AS ${Prisma.raw(`dur_${b.key}`)}`,
      ),
      ', ',
    );
    const moneyCounts = Prisma.join(
      MONEY_BRACKETS.flatMap((br) => [
        Prisma.sql`count(*) FILTER (WHERE ${this.exceptFlags('goal')} AND ${this.moneyBracketOn(Prisma.sql`goal_h`, br)})::int AS ${Prisma.raw(`goal_${br.key}`)}`,
        Prisma.sql`count(*) FILTER (WHERE ${this.exceptFlags('raised')} AND ${this.moneyBracketOn(Prisma.sql`raised_h`, br)})::int AS ${Prisma.raw(`raised_${br.key}`)}`,
      ]),
      ', ',
    );

    const rows = await this.prisma.$queryRaw<Array<{ payload: FacetPayload }>>(Prisma.sql`
      WITH RECURSIVE ${DiscoverService.CAT_TREE},
      base AS MATERIALIZED (
        SELECT p.id AS id,
               p."categoryId" AS category_id,
               p.region::text AS region,
               p.status::text AS status,
               p.deadline AS deadline,
               p."isStaffPick" AS is_staff_pick,
               p."durationDays" AS duration_days,
               (p."videoUrl" IS NOT NULL AND p."cardMedia" = 'VIDEO') AS has_video,
               p."fundingGoalHalalas" AS goal_h,
               p."raisedHalalas" AS raised_h,
               ${DiscoverService.PCT_EXPR_P} AS pct_val,
               ${flags}
        FROM "Project" p
        ${this.hoistedWhere(c)}
      ),
      scalars AS (
        SELECT
          count(*) FILTER (WHERE ${this.exceptFlags('status')} AND status = 'LIVE' AND deadline >= now())::int AS st_live,
          count(*) FILTER (WHERE ${this.exceptFlags('status')} AND status = ANY(${FUNDED_SET}))::int AS st_funded,
          count(*) FILTER (WHERE ${this.exceptFlags('status')} AND (status = ANY(${ENDED_SET}) OR (status = 'LIVE' AND deadline < now())))::int AS st_ended,
          ${pctCounts},
          ${moneyCounts},
          count(*) FILTER (WHERE ${this.exceptFlags('staff')} AND is_staff_pick)::int AS staff,
          count(*) FILTER (WHERE ${this.exceptFlags('video')} AND has_video)::int AS video,
          ${durationCounts}
        FROM base
      ),
      cats AS (
        SELECT category_id, count(*)::int AS n
        FROM base
        WHERE ${this.exceptFlags('category')} AND category_id IS NOT NULL
        GROUP BY category_id
      ),
      -- Ancestors-including-self, exploded, so a node's rolled count is one
      -- GROUP BY rather than a correlated prefix-sum per node. Linear in
      -- nodes x depth instead of quadratic in nodes.
      cat_rolled AS (
        SELECT a.ancestor_id AS id, sum(COALESCE(o.n, 0))::int AS rolled
        FROM (SELECT t.id AS node_id, unnest(t.id_path) AS ancestor_id FROM cat_tree t) a
        LEFT JOIN cats o ON o.category_id = a.node_id
        GROUP BY a.ancestor_id
      ),
      -- Tags, counted under every OTHER active filter. LIMIT because the
      -- vocabulary grows and a sidebar section is not a place to render all of
      -- it; the sidebar's own "show more" is bounded by what arrives here.
      tags AS (
        SELECT tg.slug, tg."nameAr" AS name_ar, count(b.id)::int AS n
        FROM "Tag" tg
        JOIN "ProjectTag" pt ON pt."tagId" = tg.id
        JOIN base b ON b.id = pt."projectId" AND (${this.exceptFlags('tag', 'b')})
        WHERE tg."isActive" = true
        GROUP BY tg.slug, tg."nameAr"
        HAVING count(b.id) > 0
        ORDER BY count(b.id) DESC, tg."nameAr" ASC
        LIMIT 30
      ),
      regions AS (
        SELECT region, count(*)::int AS n
        FROM base
        WHERE ${this.exceptFlags('region')} AND region IS NOT NULL
        GROUP BY region
      ),
      -- INNER JOIN, matching the legacy behaviour exactly: a collection with no
      -- matching projects is DROPPED from the payload rather than shown as 0.
      colls AS (
        SELECT col.slug, col."nameAr" AS name_ar, col."sortOrder" AS sort_order, count(b.id)::int AS n
        FROM "Collection" col
        JOIN "ProjectCollection" pc ON pc."collectionId" = col.id
        JOIN base b ON b.id = pc."projectId" AND (${this.exceptFlags('collection', 'b')})
        WHERE col."isActive" = true
        GROUP BY col.slug, col."nameAr", col."sortOrder"
      )
      SELECT json_build_object(
        'scalars', (SELECT row_to_json(x) FROM scalars x),
        'regions', COALESCE((SELECT json_object_agg(region, n) FROM regions), '{}'::json),
        'collections', COALESCE((SELECT json_agg(json_build_object('slug', slug, 'nameAr', name_ar, 'count', n) ORDER BY sort_order) FROM colls), '[]'::json),
        'tags', COALESCE((SELECT json_agg(json_build_object('slug', slug, 'nameAr', name_ar, 'count', n)) FROM tags), '[]'::json),
        'categories', COALESCE((
          SELECT json_agg(json_build_object(
                   'slug', t.slug,
                   'nameAr', t."nameAr",
                   'parentSlug', t.parent_slug,
                   'count', COALESCE(r.rolled, 0),
                   'ownCount', COALESCE(o.n, 0),
                   'path', t.path,
                   'catParam', replace(t.path, '/', '.'),
                   'depth', t.depth,
                   'hasChildren', EXISTS (SELECT 1 FROM cat_tree x WHERE x."parentId" = t.id)
                 ) ORDER BY t.sort_key)
          FROM cat_tree t
          LEFT JOIN cat_rolled r ON r.id = t.id
          LEFT JOIN cats o ON o.category_id = t.id
          WHERE t."isActive" AND (t.depth = 0 OR COALESCE(r.rolled, 0) > 0)
        ), '[]'::json)
      ) AS payload`);

    const pay = rows[0]!.payload;
    const sc = pay.scalars;
    const pct: Record<string, number> = {};
    for (const b of PCT_BUCKETS) pct[b] = sc[`pct_${b}`] ?? 0;
    const duration: Record<string, number> = {};
    for (const b of DURATION_BUCKETS) duration[b.key] = sc[`dur_${b.key}`] ?? 0;
    const goals: Record<string, number> = {};
    const raised: Record<string, number> = {};
    for (const br of MONEY_BRACKETS) {
      goals[br.key] = sc[`goal_${br.key}`] ?? 0;
      raised[br.key] = sc[`raised_${br.key}`] ?? 0;
    }
    return {
      statuses: { live: sc.st_live, funded: sc.st_funded, ended: sc.st_ended },
      categories: pay.categories,
      regions: pay.regions,
      pct,
      goals,
      raised,
      staff: sc.staff,
      collections: pay.collections,
      tags: pay.tags,
      video: sc.video,
      duration,
    };
  }

  /** Money bracket over an arbitrary column expression — see pctCondition. */
  private moneyBracketOn(expr: Prisma.Sql, br: { minH: number | null; maxH: number | null }): Prisma.Sql {
    const parts: Prisma.Sql[] = [];
    if (br.minH != null) parts.push(Prisma.sql`${expr} >= ${br.minH}`);
    if (br.maxH != null) parts.push(Prisma.sql`${expr} < ${br.maxH}`);
    return parts.length ? Prisma.sql`(${Prisma.join(parts, ' AND ')})` : Prisma.sql`true`;
  }

  private moneyBracket(col: 'fundingGoalHalalas' | 'raisedHalalas', br: { minH: number | null; maxH: number | null }): Prisma.Sql {
    return this.moneyBracketOn(Prisma.sql`p.${Prisma.raw(`"${col}"`)}`, br);
  }

  // ---- bookmarks ------------------------------------------------------------
  async bookmark(userId: string, projectId: string): Promise<{ saved: boolean }> {
    await this.prisma.savedProject.upsert({
      where: { userId_projectId: { userId, projectId } },
      create: { userId, projectId },
      update: {},
    });
    return { saved: true };
  }

  async unbookmark(userId: string, projectId: string): Promise<{ saved: boolean }> {
    await this.prisma.savedProject.deleteMany({ where: { userId, projectId } });
    return { saved: false };
  }

  /**
   * Batch ACCOUNT — «متابعة المشروع»: subscribe to a project's updates.
   *
   * NOT the same act as bookmark() above, and deliberately not the same row.
   * Saving is "read later" and silent; following is "tell me what happens".
   * The two are independent — you can hold either, both, or neither, and
   * un-saving must never quietly unsubscribe you.
   *
   * Idempotent via the unique (userId, projectId): a retried POST is one row.
   * Returns the resulting state so the UI never has to guess what it now holds.
   */
  async followProject(userId: string, projectId: string): Promise<{ following: boolean }> {
    await this.prisma.projectFollow.upsert({
      where: { userId_projectId: { userId, projectId } },
      create: { userId, projectId },
      update: {},
    });
    return { following: true };
  }

  async unfollowProject(userId: string, projectId: string): Promise<{ following: boolean }> {
    await this.prisma.projectFollow.deleteMany({ where: { userId, projectId } });
    return { following: false };
  }

  /** Projects this user subscribed to, newest first — the /following tab. */
  async listFollowedProjects(userId: string) {
    const rows = await this.prisma.projectFollow.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        project: {
          select: {
            id: true, slug: true, titleAr: true, status: true,
            mediaUrls: true, fundingGoalHalalas: true, raisedHalalas: true, deadline: true,
          },
        },
      },
    });
    return { items: rows.map((r) => ({ followedAt: r.createdAt, ...r.project })) };
  }

  private async buildCategoryFacet(own: Map<string, number>): Promise<
    Array<{ slug: string; nameAr: string; parentSlug: string | null; count: number }>
  > {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }],
      select: { id: true, slug: true, nameAr: true, parentId: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const childrenByParent = new Map<string, typeof rows>();
    for (const r of rows) {
      if (r.parentId) {
        const list = childrenByParent.get(r.parentId) ?? [];
        list.push(r);
        childrenByParent.set(r.parentId, list);
      }
    }
    const out: Array<{ slug: string; nameAr: string; parentSlug: string | null; count: number }> = [];
    for (const r of rows) {
      if (r.parentId) continue; // top-levels drive the ordering
      const childRows = childrenByParent.get(r.id) ?? [];
      const rolled = (own.get(r.id) ?? 0) + childRows.reduce((s, ch) => s + (own.get(ch.id) ?? 0), 0);
      out.push({ slug: r.slug, nameAr: r.nameAr, parentSlug: null, count: rolled });
      for (const ch of childRows) {
        const n = own.get(ch.id) ?? 0;
        if (n > 0) out.push({ slug: ch.slug, nameAr: ch.nameAr, parentSlug: r.slug, count: n });
      }
    }
    void byId;
    return out;
  }

  /**
   * STAKES/J4 — home rail for signed-in backers: LIVE projects in the
   * categories the user has backed (HELD/CAPTURED), excluding projects they
   * already back. `basedOn` carries the category names for the rail title.
   */
  async recommendedForUser(
    userId: string,
    limit = 8,
  ): Promise<{ items: Array<Record<string, unknown>>; basedOn: string[] }> {
    const pledges = await this.prisma.pledge.findMany({
      where: { backerId: userId, status: { in: ['HELD', 'CAPTURED'] } },
      distinct: ['projectId'],
      select: { projectId: true, project: { select: { categoryId: true } } },
    });
    const backedIds = pledges.map((p) => p.projectId);
    const catIds = [
      ...new Set(pledges.map((p) => p.project.categoryId).filter((c): c is string => !!c)),
    ];
    if (catIds.length === 0) return { items: [], basedOn: [] };

    const [items, cats] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          status: 'LIVE',
          publishedAt: { not: null },
          hiddenAt: null,
          // POLISH Unit 6 — automated-test fixtures never appear publicly.
          isTestFixture: false,
          id: { notIn: backedIds },
          categoryId: { in: catIds },
        },
        orderBy: { raisedHalalas: 'desc' },
        take: limit,
        select: {
          id: true,
          titleAr: true,
          shortDescAr: true,
          slug: true,
          status: true,
          raisedHalalas: true,
          fundingGoalHalalas: true,
          deadline: true,
        },
      }),
      this.prisma.category.findMany({
        where: { id: { in: catIds } },
        select: { nameAr: true },
      }),
    ]);

    return {
      items: items.map((p) => ({
        id: p.id,
        titleAr: p.titleAr,
        shortDescAr: p.shortDescAr,
        slug: p.slug,
        status: p.status,
        fundedPct:
          p.fundingGoalHalalas > 0n
            ? Math.round(Number((p.raisedHalalas * 100n) / p.fundingGoalHalalas))
            : 0,
        deadline: p.deadline.toISOString(),
      })),
      basedOn: cats.map((c) => c.nameAr),
    };
  }
}
