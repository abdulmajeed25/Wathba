import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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

interface NormalizedFilters {
  statuses: string[];
  includeEnded: boolean;
  categoryIds: string[];
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
  slug: string | null;
  saved: boolean;
}

@Injectable()
export class DiscoverService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- category slug → id expansion (parent includes its children) ----------
  private async expandCategorySlugs(slugs: string[]): Promise<string[]> {
    if (slugs.length === 0) return [];
    const nodes = await this.prisma.category.findMany({
      where: { slug: { in: slugs } },
      select: { id: true, parentId: true },
    });
    const ids = new Set<string>();
    const topLevelIds: string[] = [];
    for (const n of nodes) {
      ids.add(n.id);
      if (n.parentId === null) topLevelIds.push(n.id);
    }
    if (topLevelIds.length) {
      const kids = await this.prisma.category.findMany({
        where: { parentId: { in: topLevelIds } },
        select: { id: true },
      });
      for (const k of kids) ids.add(k.id);
    }
    return [...ids];
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
      statuses: csv(q.status).filter((s) => s === 'live' || s === 'funded'),
      includeEnded: q.includeEnded === '1' || q.includeEnded === 'true',
      categoryIds: await this.expandCategorySlugs(csv(q.cat)),
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

    if (f.categoryIds.length) c.category = Prisma.sql`p."categoryId"::text = ANY(${f.categoryIds})`;
    if (f.region) c.region = Prisma.sql`p.region::text = ${f.region}`;

    const goal: Prisma.Sql[] = [];
    if (f.goalMinH != null) goal.push(Prisma.sql`p."fundingGoalHalalas" >= ${f.goalMinH}`);
    if (f.goalMaxH != null) goal.push(Prisma.sql`p."fundingGoalHalalas" <= ${f.goalMaxH}`);
    if (goal.length) c.goal = Prisma.sql`(${Prisma.join(goal, ' AND ')})`;

    const raised: Prisma.Sql[] = [];
    if (f.raisedMinH != null) raised.push(Prisma.sql`p."raisedHalalas" >= ${f.raisedMinH}`);
    if (f.raisedMaxH != null) raised.push(Prisma.sql`p."raisedHalalas" <= ${f.raisedMaxH}`);
    if (raised.length) c.raised = Prisma.sql`(${Prisma.join(raised, ' AND ')})`;

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
    return c;
  }

  private pctCondition(bucket: string): Prisma.Sql {
    const r = Prisma.sql`(p."raisedHalalas"::numeric * 100 / NULLIF(p."fundingGoalHalalas", 0)::numeric)`;
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

  private orderClause(sort: string, region?: string): Prisma.Sql {
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
        // Blend: staff-pick boost → 72h pledge velocity → recency → id.
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
    const order = this.orderClause(f.sort, f.region);
    const offset = f.page * f.take;

    const savedSel = f.viewerId
      ? Prisma.sql`EXISTS (SELECT 1 FROM "SavedProject" s WHERE s."projectId" = p.id AND s."userId" = ${f.viewerId}::uuid)`
      : Prisma.sql`false`;

    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT p.id, p."titleAr", p."shortDescAr", p."categoryId", p.region::text AS region,
             p."isStaffPick", p.status::text AS status, p."fundingGoalHalalas", p."raisedHalalas",
             p."backersCount", p.deadline, p."publishedAt", p."mediaUrls", p.slug,
             ${savedSel} AS saved
      FROM "Project" p
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
      slug: (r.slug as string) ?? null,
      saved: Boolean(r.saved),
    };
  }

  // ---- facets (live counts respecting the OTHER active filters) -------------
  async facets(q: DiscoverQueryDto, viewerId?: string): Promise<Record<string, unknown>> {
    const f = await this.normalize(q, viewerId);
    const c = this.conditions(f);

    const countWhere = async (except: string, extra?: Prisma.Sql): Promise<number> => {
      const base = this.whereClause(c, except);
      const where = extra ? this.combine(base, extra) : base;
      const rows = await this.prisma.$queryRaw<Array<{ n: number }>>(Prisma.sql`SELECT count(*)::int AS n FROM "Project" p ${where}`);
      return rows[0]?.n ?? 0;
    };

    // Category tree with own counts (except-category), rolled up to parents.
    const catWhere = this.combine(this.whereClause(c, 'category'), Prisma.sql`p."categoryId" IS NOT NULL`);
    const catRows = await this.prisma.$queryRaw<Array<{ categoryId: string; n: number }>>(Prisma.sql`
      SELECT p."categoryId" AS "categoryId", count(*)::int AS n
      FROM "Project" p ${catWhere}
      GROUP BY p."categoryId"
    `);

    const own = new Map<string, number>();
    for (const r of catRows) own.set(r.categoryId, r.n);
    const categories = await this.buildCategoryFacet(own);

    // Status facet (except-status): count each universe under the other filters.
    const statusWhere = this.whereClause(c, 'status');
    const statusRow = await this.prisma.$queryRaw<Array<{ live: number; funded: number; ended: number }>>(Prisma.sql`
      SELECT
        count(*) FILTER (WHERE p.status = 'LIVE' AND p.deadline >= now())::int AS live,
        count(*) FILTER (WHERE p.status::text = ANY(${FUNDED_SET}))::int AS funded,
        count(*) FILTER (WHERE p.status::text = ANY(${ENDED_SET}) OR (p.status = 'LIVE' AND p.deadline < now()))::int AS ended
      FROM "Project" p ${statusWhere}
    `);
    const statuses = statusRow[0] ?? { live: 0, funded: 0, ended: 0 };

    // Region facet (except-region).
    const regionWhere = this.combine(this.whereClause(c, 'region'), Prisma.sql`p.region IS NOT NULL`);
    const regionRows = await this.prisma.$queryRaw<Array<{ region: string; n: number }>>(Prisma.sql`
      SELECT p.region::text AS region, count(*)::int AS n
      FROM "Project" p ${regionWhere}
      GROUP BY p.region
    `);
    const regions = Object.fromEntries(regionRows.map((r) => [r.region, r.n]));

    // Percent buckets (except-pct).
    const pct: Record<string, number> = {};
    for (const b of PCT_BUCKETS) pct[b] = await countWhere('pct', this.pctCondition(b));

    // Goal + raised brackets.
    const goals: Record<string, number> = {};
    const raised: Record<string, number> = {};
    for (const br of MONEY_BRACKETS) {
      goals[br.key] = await countWhere('goal', this.moneyBracket('fundingGoalHalalas', br));
      raised[br.key] = await countWhere('raised', this.moneyBracket('raisedHalalas', br));
    }

    const staff = await countWhere('staff', Prisma.sql`p."isStaffPick" = true`);

    // Collection facet (active collections; counts under the other filters).
    const collRows = await this.prisma.$queryRaw<Array<{ slug: string; nameAr: string; n: number }>>(Prisma.sql`
      SELECT col.slug AS slug, col."nameAr" AS "nameAr", count(p.id)::int AS n
      FROM "Collection" col
        JOIN "ProjectCollection" pc ON pc."collectionId" = col.id
        JOIN "Project" p ON p.id = pc."projectId" AND (${this.predicate(c, 'collection')})
      WHERE col."isActive" = true
      GROUP BY col.slug, col."nameAr", col."sortOrder"
      ORDER BY col."sortOrder" ASC
    `);
    const collections = collRows.map((r) => ({ slug: r.slug, nameAr: r.nameAr, count: r.n }));

    return { statuses, categories, regions, pct, goals, raised, staff, collections };
  }

  private moneyBracket(col: 'fundingGoalHalalas' | 'raisedHalalas', br: { minH: number | null; maxH: number | null }): Prisma.Sql {
    const parts: Prisma.Sql[] = [];
    if (br.minH != null) parts.push(Prisma.sql`p.${Prisma.raw(`"${col}"`)} >= ${br.minH}`);
    if (br.maxH != null) parts.push(Prisma.sql`p.${Prisma.raw(`"${col}"`)} < ${br.maxH}`);
    return parts.length ? Prisma.sql`(${Prisma.join(parts, ' AND ')})` : Prisma.sql`true`;
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
}
