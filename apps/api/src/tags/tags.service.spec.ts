import { TagsService } from './tags.service';

/**
 * Batch DISCOVERY-ENGINE — the tag write path.
 *
 * The interesting behaviour is all in `setProjectTags`, and all of it is about
 * what happens when the creator's form and the ops vocabulary disagree — which
 * they will, because ops can retire a tag between the page loading and the
 * creator pressing save.
 */

type Mock = ReturnType<typeof jest.fn>;

function makePrisma(over: Record<string, unknown> = {}) {
  const base = {
    tag: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    projectTag: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({}),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
    $queryRaw: jest.fn().mockResolvedValue([]),
    ...over,
  };
  return base as unknown as ConstructorParameters<typeof TagsService>[0] & typeof base;
}

describe('setProjectTags', () => {
  it('drops slugs the vocabulary does not have, and reports what it applied', async () => {
    const prisma = makePrisma();
    (prisma.tag.findMany as Mock).mockResolvedValue([{ id: 't1', slug: 'handmade' }]);
    const svc = new TagsService(prisma);

    // The creator submitted two; ops only recognises one.
    const applied = await svc.setProjectTags('p1', ['handmade', 'retired-tag']);

    // Not an error: a creator cannot act on "that tag no longer exists", and
    // failing the whole save would lose their other edits with it.
    expect(applied).toEqual(['handmade']);
    expect(prisma.projectTag.create).toHaveBeenCalledTimes(1);
  });

  it('is whole-set: the old attachments go before the new ones land', async () => {
    const prisma = makePrisma();
    (prisma.tag.findMany as Mock).mockResolvedValue([{ id: 't2', slug: 'rural' }]);
    const svc = new TagsService(prisma);

    await svc.setProjectTags('p1', ['rural']);

    // The picker holds the complete list and saves it, so the write has to be a
    // replace. An add-only write would make deselecting a tag impossible.
    expect(prisma.projectTag.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'p1' } });
  });

  it('recounts the tags it removed, not just the ones it added', async () => {
    const prisma = makePrisma();
    (prisma.projectTag.findMany as Mock).mockResolvedValue([{ tagId: 'old' }]);
    (prisma.tag.findMany as Mock).mockResolvedValue([{ id: 'new', slug: 'rural' }]);
    (prisma.projectTag.groupBy as Mock).mockResolvedValue([
      { tagId: 'new', _count: { projectId: 3 } },
    ]);
    const svc = new TagsService(prisma);

    await svc.setProjectTags('p1', ['rural']);

    // The tag that LOST a project has to be recounted too, or its usageCount
    // ratchets upward forever and the typeahead's ordering rots.
    const ids = (prisma.tag.update as Mock).mock.calls.map((c) => c[0].where.id);
    expect(ids).toContain('old');
    expect(ids).toContain('new');
    // Recomputed from the join table, not incremented: a double-submit must
    // converge rather than inflate.
    const updates = (prisma.tag.update as Mock).mock.calls.map((c) => c[0].data.usageCount);
    expect(updates).toContain(3);
    expect(updates).toContain(0);
  });

  it('clearing all tags is a legal save, not a no-op', async () => {
    const prisma = makePrisma();
    (prisma.projectTag.findMany as Mock).mockResolvedValue([{ tagId: 'old' }]);
    const svc = new TagsService(prisma);

    const applied = await svc.setProjectTags('p1', []);

    expect(applied).toEqual([]);
    expect(prisma.projectTag.deleteMany).toHaveBeenCalled();
    // …and the tag that lost its last project still gets recounted.
    expect(prisma.tag.update).toHaveBeenCalled();
  });

  it('caps the set so a project cannot be tagged with the whole vocabulary', async () => {
    const prisma = makePrisma();
    const svc = new TagsService(prisma);
    await svc.setProjectTags('p1', Array.from({ length: 25 }, (_, i) => `tag-${i}`));
    // A project tagged with everything is tagged with nothing — the facet stops
    // discriminating. The cap is enforced before the lookup so the query stays
    // bounded too.
    const where = (prisma.tag.findMany as Mock).mock.calls[0][0].where;
    expect(where.slug.in).toHaveLength(10);
  });

  it('de-duplicates and trims before it looks anything up', async () => {
    const prisma = makePrisma();
    const svc = new TagsService(prisma);
    await svc.setProjectTags('p1', [' rural ', 'rural', '', '   ']);
    const where = (prisma.tag.findMany as Mock).mock.calls[0][0].where;
    expect(where.slug.in).toEqual(['rural']);
  });

  it('only offers active tags — a retired one cannot be re-attached', async () => {
    const prisma = makePrisma();
    const svc = new TagsService(prisma);
    await svc.setProjectTags('p1', ['handmade']);
    expect((prisma.tag.findMany as Mock).mock.calls[0][0].where.isActive).toBe(true);
  });
});

describe('suggest', () => {
  it('uses the trigram OPERATOR, not the similarity() function', async () => {
    const prisma = makePrisma();
    const svc = new TagsService(prisma);
    await svc.suggest('تراث');

    // This is the mistake the project search made and paid for: `similarity(a,b)
    // > 0.25` is a function call the GIN trigram index cannot serve, so it
    // silently degrades to a full scan AND never fires for short queries. The
    // `%` operator form is indexable.
    const sql = (prisma.$queryRaw as Mock).mock.calls[0][0].join('?');
    expect(sql).toContain('%');
    expect(sql).not.toMatch(/similarity\([^)]*\)\s*>/);
  });

  it('an empty query returns the head of the vocabulary rather than nothing', async () => {
    const prisma = makePrisma();
    (prisma.tag.findMany as Mock).mockResolvedValue([
      { slug: 'a', nameAr: 'أ', nameEn: 'A', usageCount: 9 },
    ]);
    const svc = new TagsService(prisma);
    const r = await svc.suggest('  ');
    // An empty picker is a dead end; the creator should see the popular tags.
    expect(r.items).toHaveLength(1);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
