import { OperationsRegistry } from './operations.registry';
import { categoriesOps } from './operations/categories.ops';
import type { CategoriesOpsDeps } from './operations/categories.ops';
import type { OperationContext } from './operation.types';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Batch OPS (registry completion) — content.categories.* guard tests:
 *  · BUG-2 runtime exclusion — an excluded slug OR an Arabic excluded name
 *    fragment refuses the create (same constants as the seed guard)
 *  · two-level depth policy — a child-of-child is refused
 *  · slug uniqueness within the scope
 *  · create defaults sortOrder to max+1 within the scope
 *  · set-active refuses a no-op state change
 *  · reorder refuses ids outside the scope and writes index → sortOrder
 *  · EVERY mutation invalidates the 60s memoised category tree exactly once
 */

type Mock = jest.Mock;
interface MockModel {
  findUnique: Mock; findUniqueOrThrow: Mock; findFirst: Mock; findFirstOrThrow: Mock;
  findMany: Mock; count: Mock; create: Mock; update: Mock; updateMany: Mock;
  delete: Mock; deleteMany: Mock; upsert: Mock;
}
interface MockDb {
  category: MockModel; project: MockModel;
  operationExecution: MockModel; auditLog: MockModel; operationProposal: MockModel;
  $transaction: Mock;
}

function buildPrisma(): MockDb {
  const model = () => ({
    findUnique: jest.fn().mockResolvedValue(null),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn().mockResolvedValue(null),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'row-1', ...data })),
    update: jest.fn().mockImplementation(({ where }: { where: { id?: string } }) =>
      Promise.resolve({ id: where.id ?? 'row-1' })),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
  });
  const prisma: MockDb = {
    category: model(), project: model(),
    operationExecution: model(), auditLog: model(), operationProposal: model(),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

const asPrisma = (db: MockDb): PrismaService => db as unknown as PrismaService;

const ctx = (over: Partial<OperationContext> = {}): OperationContext => ({
  actor: { id: 'admin-1', type: 'HUMAN', roles: ['OWNER'], permissions: ['*'] },
  reason: 'سبب اختباري كافٍ للطول',
  stepUpVerifiedAt: new Date(),
  ...over,
});

const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const CAT_ID = '22222222-2222-4222-8222-222222222222';
const CAT_ID_2 = '33333333-3333-4333-8333-333333333333';

function build(): { prisma: MockDb; reg: OperationsRegistry; deps: CategoriesOpsDeps } {
  const prisma = buildPrisma();
  const reg = new OperationsRegistry(asPrisma(prisma));
  reg.permissionPort = { has: () => true };
  const deps = { categories: { invalidate: jest.fn() } } as unknown as CategoriesOpsDeps;
  for (const op of categoriesOps(deps)) reg.register(op);
  return { prisma, reg, deps };
}

/** afterCommit is fire-and-forget — drain the microtask queue before asserting. */
const settled = () => new Promise((r) => setImmediate(r));

describe('content.categories.create', () => {
  it('refuses an excluded slug (BUG-2 runtime guard)', async () => {
    const { reg } = build();
    await expect(
      reg.execute('content.categories.create', { slug: 'music', nameAr: 'فئة جديدة' }, ctx()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'excluded-category' }),
    });
  });

  it('refuses an Arabic name containing an excluded fragment', async () => {
    const { reg } = build();
    await expect(
      reg.execute(
        'content.categories.create',
        { slug: 'sound-arts', nameAr: 'فنون موسيقية' },
        ctx(),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'excluded-category' }),
    });
  });

  it('refuses a parent that is itself a subcategory (two-level depth policy)', async () => {
    const { prisma, reg } = build();
    // The named parent exists but has a parent of its own → depth would be 3.
    prisma.category.findUnique.mockResolvedValue({ id: CAT_ID, parentId: PARENT_ID });
    await expect(
      reg.execute(
        'content.categories.create',
        { slug: 'new-sub', nameAr: 'فئة فرعية', parentId: CAT_ID },
        ctx(),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'parent-not-toplevel' }),
    });
  });

  it('refuses a slug already taken within the same scope', async () => {
    const { prisma, reg } = build();
    prisma.category.findFirst.mockResolvedValue({ id: CAT_ID });
    await expect(
      reg.execute('content.categories.create', { slug: 'crafts', nameAr: 'الحِرف' }, ctx()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'slug-taken' }),
    });
  });

  it('defaults sortOrder to max+1 within the scope and invalidates the tree cache', async () => {
    const { prisma, reg, deps } = build();
    // slug-taken lookups (no orderBy) find nothing; the max-sortOrder lookup
    // (orderBy desc) finds the current tail of the scope.
    prisma.category.findFirst.mockImplementation((args: { orderBy?: unknown }) =>
      Promise.resolve(args?.orderBy ? { sortOrder: 7 } : null),
    );
    const out = await reg.execute(
      'content.categories.create',
      { slug: 'new-cat', nameAr: 'فئة جديدة' },
      ctx(),
    );
    expect(out.result).toEqual({ id: 'row-1' });
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: {
        slug: 'new-cat',
        nameAr: 'فئة جديدة',
        nameEn: 'new-cat',
        parentId: null,
        sortOrder: 8,
        isActive: true,
      },
    });
    await settled();
    expect(deps.categories.invalidate).toHaveBeenCalledTimes(1);
  });
});

describe('content.categories.update', () => {
  it('requires at least one field (zod refine → Arabic 400)', async () => {
    const { reg } = build();
    await expect(
      reg.execute('content.categories.update', { categoryId: CAT_ID }, ctx()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'مدخلات غير صالحة' }),
    });
  });

  it('refuses renaming into an excluded name, and invalidates on success', async () => {
    const { prisma, reg, deps } = build();
    prisma.category.findUnique.mockResolvedValue({
      id: CAT_ID, parentId: null, slug: 'art', nameAr: 'الفنون', nameEn: 'Art',
    });
    await expect(
      reg.execute(
        'content.categories.update',
        { categoryId: CAT_ID, nameAr: 'موسيقى الفنون' },
        ctx(),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'excluded-category' }),
    });
    expect(deps.categories.invalidate).not.toHaveBeenCalled();

    await reg.execute(
      'content.categories.update',
      { categoryId: CAT_ID, nameAr: 'الفنون البصرية' },
      ctx(),
    );
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: CAT_ID },
      data: { nameAr: 'الفنون البصرية' },
    });
    await settled();
    expect(deps.categories.invalidate).toHaveBeenCalledTimes(1);
  });

  it('refuses a new slug already taken in the category scope', async () => {
    const { prisma, reg } = build();
    prisma.category.findUnique.mockResolvedValue({ id: CAT_ID, parentId: null });
    prisma.category.findFirst.mockResolvedValue({ id: CAT_ID_2 }); // sibling owns the slug
    await expect(
      reg.execute('content.categories.update', { categoryId: CAT_ID, slug: 'design' }, ctx()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'slug-taken' }),
    });
  });
});

describe('content.categories.set-active', () => {
  it('refuses a no-op state change', async () => {
    const { prisma, reg } = build();
    prisma.category.findUnique.mockResolvedValue({ id: CAT_ID, isActive: true });
    await expect(
      reg.execute('content.categories.set-active', { categoryId: CAT_ID, isActive: true }, ctx()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'no-change' }),
    });
  });

  it('dryRun reports attached projects + child categories when deactivating a top-level', async () => {
    const { prisma, reg } = build();
    prisma.category.findUnique.mockResolvedValue({
      id: CAT_ID, nameAr: 'الفنون', parentId: null, isActive: true,
    });
    prisma.project.count.mockResolvedValue(4);
    prisma.category.count.mockResolvedValue(3);
    const dry = await reg.dryRun(
      'content.categories.set-active',
      { categoryId: CAT_ID, isActive: false },
      ctx(),
    );
    expect(dry.ok).toBe(true);
    expect(dry.preview!.counts).toEqual({ projectsAttached: 4, childCategories: 3 });
    expect(dry.preview!.summaryAr).toContain('يحتفظ بفئته');
    // dryRun purity — nothing written.
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it('flips isActive and invalidates the tree cache once', async () => {
    const { prisma, reg, deps } = build();
    prisma.category.findUnique.mockResolvedValue({ id: CAT_ID, isActive: true, parentId: null });
    const out = await reg.execute(
      'content.categories.set-active',
      { categoryId: CAT_ID, isActive: false },
      ctx(),
    );
    expect(out.result).toEqual({ id: CAT_ID, isActive: false });
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: CAT_ID },
      data: { isActive: false },
    });
    await settled();
    expect(deps.categories.invalidate).toHaveBeenCalledTimes(1);
  });
});

describe('content.categories.reorder', () => {
  it('refuses duplicate ids', async () => {
    const { reg } = build();
    await expect(
      reg.execute(
        'content.categories.reorder',
        { parentId: null, orderedIds: [CAT_ID, CAT_ID] },
        ctx(),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'duplicate-ids' }),
    });
  });

  it('refuses ids that do not all belong to the scope', async () => {
    const { prisma, reg } = build();
    prisma.category.count.mockResolvedValue(1); // only one of the two is in scope
    await expect(
      reg.execute(
        'content.categories.reorder',
        { parentId: PARENT_ID, orderedIds: [CAT_ID, CAT_ID_2] },
        ctx(),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ids-scope-mismatch' }),
    });
  });

  it('writes index → sortOrder for each id and invalidates the tree cache once', async () => {
    const { prisma, reg, deps } = build();
    prisma.category.count.mockResolvedValue(2);
    const out = await reg.execute(
      'content.categories.reorder',
      { parentId: null, orderedIds: [CAT_ID_2, CAT_ID] },
      ctx(),
    );
    expect(out.result).toEqual({ reordered: 2 });
    expect(prisma.category.update).toHaveBeenNthCalledWith(1, {
      where: { id: CAT_ID_2 }, data: { sortOrder: 0 },
    });
    expect(prisma.category.update).toHaveBeenNthCalledWith(2, {
      where: { id: CAT_ID }, data: { sortOrder: 1 },
    });
    await settled();
    expect(deps.categories.invalidate).toHaveBeenCalledTimes(1);
  });

  it('dryRun shows before/after order as slugs', async () => {
    const { prisma, reg } = build();
    prisma.category.count.mockResolvedValue(2);
    prisma.category.findMany.mockResolvedValue([
      { id: CAT_ID, slug: 'art' },
      { id: CAT_ID_2, slug: 'design' },
    ]);
    const dry = await reg.dryRun(
      'content.categories.reorder',
      { parentId: null, orderedIds: [CAT_ID_2, CAT_ID] },
      ctx(),
    );
    expect(dry.ok).toBe(true);
    expect(dry.preview!.before).toEqual({ order: ['art', 'design'] });
    expect(dry.preview!.after).toEqual({ order: ['design', 'art'] });
    expect(dry.preview!.counts).toEqual({ categories: 2 });
  });
});
