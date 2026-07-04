/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';

/**
 * CategoriesService — tree assembly + LIVE-count roll-up (Batch CAT / Part 1).
 * A project attaches to a top-level OR a subcategory; a parent's liveCount must
 * be its own + all descendants'.
 */

const ROWS = [
  { id: 't1', slug: 'art', nameAr: 'الفنون', nameEn: 'Art', sortOrder: 1, parentId: null },
  { id: 'c1', slug: 'painting', nameAr: 'الرسم', nameEn: 'Painting', sortOrder: 1, parentId: 't1' },
  { id: 'c2', slug: 'sculpture', nameAr: 'النحت', nameEn: 'Sculpture', sortOrder: 2, parentId: 't1' },
  { id: 't2', slug: 'food', nameAr: 'الغذاء', nameEn: 'Food', sortOrder: 2, parentId: null },
];

function makePrisma(counts: Array<{ categoryId: string; n: number }>): any {
  return {
    category: { findMany: jest.fn().mockResolvedValue(ROWS) },
    project: {
      groupBy: jest.fn().mockResolvedValue(
        counts.map((c) => ({ categoryId: c.categoryId, _count: { _all: c.n } })),
      ),
    },
  };
}

describe('CategoriesService.getTree', () => {
  it('nests children and rolls LIVE counts up to the parent', async () => {
    // Art: 2 directly + 3 (painting) + 1 (sculpture) = 6; Food: 0.
    const svc = new CategoriesService(
      makePrisma([{ categoryId: 't1', n: 2 }, { categoryId: 'c1', n: 3 }, { categoryId: 'c2', n: 1 }]),
    );
    const tree = await svc.getTree();
    expect(tree.map((t) => t.slug)).toEqual(['art', 'food']);
    const [art, food] = tree;
    expect(art?.children.map((c) => c.slug)).toEqual(['painting', 'sculpture']);
    expect(art?.children[0]?.liveCount).toBe(3);
    expect(art?.liveCount).toBe(6);
    expect(food?.liveCount).toBe(0);
  });

  it('memoises the tree (single DB read within the TTL)', async () => {
    const prisma = makePrisma([]);
    const svc = new CategoriesService(prisma);
    await svc.getTree();
    await svc.getTree();
    expect(prisma.category.findMany).toHaveBeenCalledTimes(1);
  });

  it('getBySlug throws 404 for an unknown top-level', async () => {
    const svc = new CategoriesService(makePrisma([]));
    await expect(svc.getBySlug('nope')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.getBySlug('art')).resolves.toMatchObject({ slug: 'art' });
  });
});
