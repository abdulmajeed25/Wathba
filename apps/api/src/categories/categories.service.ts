import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Batch CAT — the two-level category tree reader.
 *
 * `liveCount` on each node = LIVE projects attached to it, rolled up to the
 * parent (a project attaches to a top-level OR a subcategory). Counts come from
 * a SINGLE `groupBy` — never N+1 — and the whole assembled tree is memoised for
 * a short TTL (the structure is effectively static; only the counts drift).
 */

export interface CategoryNode {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
  liveCount: number;
  children: CategoryNode[];
}

const TREE_TTL_MS = 60_000;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private cache: { at: number; tree: CategoryNode[] } | null = null;

  /** Full active tree with rolled-up LIVE counts (cached). */
  async getTree(): Promise<CategoryNode[]> {
    if (this.cache && Date.now() - this.cache.at < TREE_TTL_MS) {
      return this.cache.tree;
    }
    const tree = await this.buildTree();
    this.cache = { at: Date.now(), tree };
    return tree;
  }

  /** A single top-level node + its children + counts (public discover header). */
  async getBySlug(slug: string): Promise<CategoryNode> {
    const tree = await this.getTree();
    const node = tree.find((t) => t.slug === slug);
    if (!node) throw new NotFoundException('الفئة غير موجودة');
    return node;
  }

  /** Invalidate the memoised tree (called after admin taxonomy edits, if any). */
  invalidate(): void {
    this.cache = null;
  }

  private async buildTree(): Promise<CategoryNode[]> {
    const [rows, counts] = await Promise.all([
      this.prisma.category.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }],
        select: { id: true, slug: true, nameAr: true, nameEn: true, sortOrder: true, parentId: true },
      }),
      this.prisma.project.groupBy({
        by: ['categoryId'],
        // Batch OPS — public counts skip moderation-hidden projects.
        where: { status: 'LIVE', categoryId: { not: null }, hiddenAt: null, isTestFixture: false },
        _count: { _all: true },
      }),
    ]);

    const own = new Map<string, number>();
    for (const c of counts) {
      if (c.categoryId) own.set(c.categoryId, c._count._all);
    }

    const byParent = new Map<string | null, typeof rows>();
    for (const r of rows) {
      const key = r.parentId ?? null;
      const list = byParent.get(key) ?? [];
      list.push(r);
      byParent.set(key, list);
    }

    const toNode = (r: (typeof rows)[number]): CategoryNode => {
      const children = (byParent.get(r.id) ?? []).map(toNode);
      const liveCount =
        (own.get(r.id) ?? 0) + children.reduce((sum, ch) => sum + ch.liveCount, 0);
      return {
        id: r.id,
        slug: r.slug,
        nameAr: r.nameAr,
        nameEn: r.nameEn,
        sortOrder: r.sortOrder,
        liveCount,
        children,
      };
    };

    return (byParent.get(null) ?? []).map(toNode);
  }
}
