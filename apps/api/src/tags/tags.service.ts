import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Batch DISCOVERY-ENGINE — the curated tag vocabulary.
 *
 * Two readers, deliberately different:
 *
 *  - `list()` is the whole active vocabulary, memoised, for the facet sidebar
 *    and the creator picker. 40-ish rows that change roughly never, so a cache
 *    is worth more than freshness.
 *  - `suggest()` is the creator typeahead, which runs per keystroke. It is NOT
 *    served from the cache because it has to be forgiving of partial and
 *    slightly-misspelled Arabic, and that is a trigram question the database
 *    answers better than a JS filter over a cached array would.
 */

/** Long enough to spare the DB, short enough that an ops edit lands promptly. */
const TTL_MS = 60_000;

export interface TagRow {
  slug: string;
  nameAr: string;
  nameEn: string;
  usageCount: number;
}

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  private cache: { at: number; rows: TagRow[] } | null = null;

  /** The full active vocabulary, most-used first. */
  async list(): Promise<{ items: TagRow[] }> {
    if (this.cache && Date.now() - this.cache.at < TTL_MS) return { items: this.cache.rows };
    const rows = await this.prisma.tag.findMany({
      where: { isActive: true },
      orderBy: [{ usageCount: 'desc' }, { sortOrder: 'asc' }, { nameAr: 'asc' }],
      select: { slug: true, nameAr: true, nameEn: true, usageCount: true },
    });
    this.cache = { at: Date.now(), rows };
    return { items: rows };
  }

  /**
   * Creator typeahead.
   *
   * Ordered by trigram similarity first and popularity second, so a creator
   * typing «تراث» gets «تراث سعودي» ahead of a more-used tag that merely
   * contains the letters. `%` is the operator form rather than `similarity() >
   * x`, so the GIN trigram index on nameAr can actually serve it — the mistake
   * the project search made and paid for.
   *
   * The ILIKE arm carries prefix and substring matches that trigram scores
   * below the similarity threshold, which is most 2-3 character queries.
   */
  async suggest(q: string, limit = 8): Promise<{ items: TagRow[] }> {
    const cleaned = q.trim().slice(0, 60);
    if (!cleaned) return this.list().then((r) => ({ items: r.items.slice(0, limit) }));
    const rows = await this.prisma.$queryRaw<TagRow[]>`
      SELECT t.slug, t."nameAr", t."nameEn", t."usageCount"
      FROM "Tag" t
      WHERE t."isActive" = true
        AND (t."nameAr" ILIKE ${'%' + cleaned + '%'}
             OR t."nameEn" ILIKE ${'%' + cleaned + '%'}
             OR t.slug ILIKE ${cleaned + '%'}
             OR t."nameAr" % ${cleaned})
      ORDER BY similarity(t."nameAr", ${cleaned}) DESC, t."usageCount" DESC
      LIMIT ${limit}::int`;
    return { items: rows };
  }

  /**
   * Replace a project's tags, by slug.
   *
   * Whole-set semantics rather than add/remove, because that is what the
   * creator UI expresses — the picker holds the complete list and saves it.
   * Unknown or inactive slugs are dropped rather than rejected: a creator whose
   * tag was retired by ops between page load and save should not get an error
   * they cannot act on.
   *
   * Returns the slugs actually applied so the caller can tell the creator what
   * happened rather than silently disagreeing with the form they submitted.
   */
  async setProjectTags(projectId: string, slugs: string[]): Promise<string[]> {
    const wanted = [...new Set(slugs.map((s) => s.trim()).filter(Boolean))].slice(0, 10);
    const tags = wanted.length
      ? await this.prisma.tag.findMany({
          where: { slug: { in: wanted }, isActive: true },
          select: { id: true, slug: true },
        })
      : [];

    const before = await this.prisma.projectTag.findMany({
      where: { projectId },
      select: { tagId: true },
    });

    await this.prisma.$transaction([
      this.prisma.projectTag.deleteMany({ where: { projectId } }),
      ...tags.map((t) =>
        this.prisma.projectTag.create({ data: { projectId, tagId: t.id } }),
      ),
    ]);

    // Recompute only the counters that could have moved — the union of what the
    // project had and what it now has. Recompute rather than increment, so a
    // double-submit converges instead of inflating.
    const touched = [...new Set([...before.map((b) => b.tagId), ...tags.map((t) => t.id)])];
    if (touched.length) await this.recount(touched);
    this.cache = null;
    return tags.map((t) => t.slug);
  }

  /** Set usageCount from the join table for the given tags. */
  async recount(tagIds: string[]): Promise<void> {
    const counts = await this.prisma.projectTag.groupBy({
      by: ['tagId'],
      where: { tagId: { in: tagIds } },
      _count: { projectId: true },
    });
    const byId = new Map(counts.map((c) => [c.tagId, c._count.projectId]));
    await this.prisma.$transaction(
      tagIds.map((id) =>
        this.prisma.tag.update({ where: { id }, data: { usageCount: byId.get(id) ?? 0 } }),
      ),
    );
  }
}
