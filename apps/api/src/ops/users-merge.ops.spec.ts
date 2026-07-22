import { OperationsRegistry } from './operations.registry';
import { usersOps } from './operations/users.ops';
import type { OperationContext } from './operation.types';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * OPS-PRO Phase 1 — users.merge guard + repoint tests. The merge is the
 * highest-privilege user op (users.roles.assign); its correctness IS the
 * deliverable: it refuses the degenerate cases, repoints every relation, skips
 * unique collisions instead of crashing, and hands the source to PDPL erase.
 */

type Mock = jest.Mock;

/** A single model delegate — every Prisma method is a jest.fn with the same
 *  benign defaults the registry harness uses. */
function model() {
  return {
    findUnique: jest.fn().mockResolvedValue(null),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: { amountHalalas: null, addOnsHalalas: null } }),
    groupBy: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'row-1', ...data }),
    ),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
  };
}

type Model = ReturnType<typeof model>;

/** Proxy prisma: any model name lazily yields a memoized delegate, so the 30+
 *  relations users.merge touches don't need enumerating, and assertions read
 *  the same instance the op wrote to. */
function buildPrisma(): { proxy: PrismaService; m: (name: string) => Model } {
  const models = new Map<string, Model>();
  const get = (name: string): Model => {
    let existing = models.get(name);
    if (!existing) {
      existing = model();
      models.set(name, existing);
    }
    return existing;
  };
  const proxy = new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== 'string') return undefined;
        if (prop === '$transaction') {
          return (fn: (tx: unknown) => unknown) => fn(proxy);
        }
        return get(prop);
      },
    },
  ) as unknown as PrismaService;
  return { proxy, m: get };
}

const SOURCE = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';

const ctx = (over: Partial<OperationContext> = {}): OperationContext => ({
  actor: { id: 'admin-1', type: 'HUMAN', roles: ['OWNER'], permissions: ['*'] },
  reason: 'دمج حسابين مكررين لنفس الشخص بعد التحقق',
  idempotencyKey: 'merge-k1',
  stepUpVerifiedAt: new Date(),
  ...over,
});

function regWith(proxy: PrismaService): {
  reg: OperationsRegistry;
  pdpl: { eraseAccount: Mock; exportData: Mock };
} {
  const reg = new OperationsRegistry(proxy);
  reg.permissionPort = { has: () => true };
  const pdpl = { eraseAccount: jest.fn().mockResolvedValue({ erased: true }), exportData: jest.fn() };
  const deps = {
    prisma: proxy,
    notifications: { create: jest.fn().mockResolvedValue(null) },
    email: {},
    pdpl,
  };
  for (const op of usersOps(deps as never)) reg.register(op);
  return { reg, pdpl };
}

describe('users.merge — guards', () => {
  it('refuses merging an account into itself (same-user)', async () => {
    const { proxy } = buildPrisma();
    const { reg } = regWith(proxy);
    await expect(
      reg.execute('users.merge', { sourceUserId: SOURCE, targetUserId: SOURCE }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'same-user' }) });
  });

  it('refuses when either account is missing (user-missing)', async () => {
    const { proxy, m } = buildPrisma();
    m('user').findUnique.mockResolvedValue(null); // neither exists
    const { reg } = regWith(proxy);
    await expect(
      reg.execute('users.merge', { sourceUserId: SOURCE, targetUserId: TARGET }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'user-missing' }) });
  });

  it('refuses when the source still has HELD pledges (source-has-held-pledges)', async () => {
    const { proxy, m } = buildPrisma();
    m('user').findUnique.mockResolvedValue({ id: 'x', email: 'u@wathba.sa', name: 'ن' });
    m('pledge').count.mockResolvedValue(3); // HELD money in flight
    const { reg } = regWith(proxy);
    await expect(
      reg.execute('users.merge', { sourceUserId: SOURCE, targetUserId: TARGET }, ctx()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'source-has-held-pledges' }),
    });
  });
});

describe('users.merge — repoint + erase', () => {
  /** All preconditions green. */
  function greenPrisma() {
    const built = buildPrisma();
    built.m('user').findUnique.mockResolvedValue({ id: 'x', email: 'u@wathba.sa', name: 'ن' });
    built.m('pledge').count.mockResolvedValue(0);
    built.m('project').count.mockResolvedValue(0);
    return built;
  }

  it('repoints the simple relations source→target via updateMany', async () => {
    const { proxy, m } = greenPrisma();
    const { reg } = regWith(proxy);
    const out = await reg.execute(
      'users.merge',
      { sourceUserId: SOURCE, targetUserId: TARGET },
      ctx(),
    );
    expect((out.result as { merged: boolean }).merged).toBe(true);
    // A representative sample of the simple repoint set.
    expect(m('pledge').updateMany).toHaveBeenCalledWith({
      where: { backerId: SOURCE },
      data: { backerId: TARGET },
    });
    expect(m('project').updateMany).toHaveBeenCalledWith({
      where: { createdById: SOURCE },
      data: { createdById: TARGET },
    });
    expect(m('comment').updateMany).toHaveBeenCalledWith({
      where: { userId: SOURCE },
      data: { userId: TARGET },
    });
    // SupportTicket is repointed on BOTH FKs.
    expect(m('supportTicket').updateMany).toHaveBeenCalledWith({
      where: { userId: SOURCE },
      data: { userId: TARGET },
    });
    expect(m('supportTicket').updateMany).toHaveBeenCalledWith({
      where: { assignedToId: SOURCE },
      data: { assignedToId: TARGET },
    });
  });

  it('skips (drops) the source rows that would collide on a composite unique', async () => {
    const { proxy, m } = greenPrisma();
    // savedProject unique (userId, projectId): target already saved p1; source
    // saved p1 (collides) and p2 (moves).
    m('savedProject').findMany.mockImplementation(
      ({ where }: { where: { userId: string } }) =>
        where.userId === TARGET
          ? Promise.resolve([{ projectId: 'p1' }])
          : Promise.resolve([{ projectId: 'p1' }, { projectId: 'p2' }]),
    );
    const { reg } = regWith(proxy);
    await reg.execute('users.merge', { sourceUserId: SOURCE, targetUserId: TARGET }, ctx());
    // Non-colliding rows move…
    expect(m('savedProject').updateMany).toHaveBeenCalledWith({
      where: { userId: SOURCE, projectId: { notIn: ['p1'] } },
      data: { userId: TARGET },
    });
    // …the colliding source row is dropped, not crashed on.
    expect(m('savedProject').deleteMany).toHaveBeenCalledWith({
      where: { userId: SOURCE, projectId: { in: ['p1'] } },
    });
  });

  it('afterCommit anonymizes the source via PdplService.eraseAccount(source)', async () => {
    const { proxy } = greenPrisma();
    const { reg, pdpl } = regWith(proxy);
    // Drive afterCommit deterministically (the registry fires it detached).
    const merge = usersOps({
      prisma: proxy,
      notifications: { create: jest.fn() } as never,
      email: {} as never,
      pdpl: pdpl as never,
    }).find((o) => o.key === 'users.merge')!;
    await merge.afterCommit!(
      { merged: true, repointed: {} } as never,
      { sourceUserId: SOURCE, targetUserId: TARGET } as never,
      ctx(),
    );
    expect(pdpl.eraseAccount).toHaveBeenCalledWith(SOURCE);
    expect(pdpl.eraseAccount).not.toHaveBeenCalledWith(TARGET);
    void reg;
  });

  it('dryRun previews per-relation move counts + collision skips without writing', async () => {
    const { proxy, m } = greenPrisma();
    // The HELD precondition filters by status (→0, passes); the dryRun body
    // counts all of the source's pledges (→4, the "would move" figure).
    m('pledge').count.mockImplementation(({ where }: { where: { status?: unknown } }) =>
      Promise.resolve(where.status ? 0 : 4),
    );
    const { reg } = regWith(proxy);
    const dry = await reg.dryRun(
      'users.merge',
      { sourceUserId: SOURCE, targetUserId: TARGET },
      ctx(),
    );
    expect(dry.ok).toBe(true);
    expect(dry.preview!.counts).toEqual(
      expect.objectContaining({ 'pledge.backerId': 4, collisionsSkipped: 0 }),
    );
    // Purity: no write method touched during the preview.
    expect(m('pledge').updateMany).not.toHaveBeenCalled();
    expect(m('savedProject').deleteMany).not.toHaveBeenCalled();
  });
});
