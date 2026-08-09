import { OperationsRegistry } from './operations.registry';
import { moderationOps } from './operations/moderation.ops';
import type { ModerationOpsDeps } from './operations/moderation.ops';
import type { OperationContext } from './operation.types';
import type { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { SearchService } from '../projects/search.service';
import { DiscoverService } from '../discover/discover.service';
import { HomeService } from '../home/home.service';
import { CategoriesService } from '../categories/categories.service';

/**
 * Batch OPS (registry completion) — TRUST & SAFETY group:
 *  · moderation.comment.moderate gains the 'unhide' action
 *  · moderation.project.hide / unhide — the takedown pair (hiddenAt)
 *  · moderation.user.ban / unban — permanent BANNED, session-killing,
 *    never against an ops-role holder
 *  · every touched PUBLIC read now filters hiddenAt (the creator's own
 *    detail read is the single exemption).
 */

type Mock = jest.Mock;
interface MockModel {
  findUnique: Mock; findUniqueOrThrow: Mock; findFirst: Mock; findFirstOrThrow: Mock;
  findMany: Mock; count: Mock; create: Mock; update: Mock; updateMany: Mock;
  delete: Mock; deleteMany: Mock; upsert: Mock;
}
interface MockDb {
  project: MockModel; user: MockModel; comment: MockModel; commentReport: MockModel;
  projectReport: MockModel; refreshToken: MockModel; opsRoleGrant: MockModel;
  operationExecution: MockModel; auditLog: MockModel; operationProposal: MockModel;
  $transaction: Mock;
}

function buildPrisma(): MockDb {
  const model = (): MockModel => ({
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'exec-1', ...data })),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
  });
  const prisma: MockDb = {
    project: model(), user: model(), comment: model(), commentReport: model(),
    projectReport: model(), refreshToken: model(), opsRoleGrant: model(),
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
  idempotencyKey: 'k1',
  stepUpVerifiedAt: new Date(),
  ...over,
});

interface Deps extends ModerationOpsDeps {
  notifications: ModerationOpsDeps['notifications'] & { create: Mock };
  email: ModerationOpsDeps['email'] & { accountSuspended: Mock; accountReactivated: Mock };
}

function buildRegistry(prisma: MockDb): { reg: OperationsRegistry; deps: Deps } {
  const deps = {
    prisma: asPrisma(prisma),
    notifications: { create: jest.fn().mockResolvedValue(null) },
    email: {
      accountSuspended: jest.fn().mockResolvedValue({}),
      accountReactivated: jest.fn().mockResolvedValue({}),
    },
  } as unknown as Deps;
  const reg = new OperationsRegistry(asPrisma(prisma));
  reg.permissionPort = { has: () => true };
  for (const op of moderationOps(deps)) reg.register(op);
  return { reg, deps };
}

const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

const COMMENT = '11111111-1111-4111-8111-111111111111';
const PROJECT = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';

describe('moderation.comment.moderate — unhide action', () => {
  it('unhide flips hidden back to false (dryRun previews it, execute writes it)', async () => {
    const prisma = buildPrisma();
    prisma.comment.findUnique.mockResolvedValue({ id: COMMENT, hidden: true, reportCount: 2, bodyAr: 'نص' });
    const { reg } = buildRegistry(prisma);

    const dry = await reg.dryRun('moderation.comment.moderate', { commentId: COMMENT, action: 'unhide' }, ctx());
    expect(dry.ok).toBe(true);
    expect(dry.preview!.summaryAr).toContain('إظهار');
    expect(dry.preview!.after).toEqual({ hidden: false, reportCount: 2 });

    const out = await reg.execute('moderation.comment.moderate', { commentId: COMMENT, action: 'unhide' }, ctx());
    expect(out.result).toEqual({ ok: true, action: 'unhide' });
    expect(prisma.comment.update).toHaveBeenCalledWith({
      where: { id: COMMENT },
      data: { hidden: false },
    });
    // unhide never touches the reports.
    expect(prisma.commentReport.deleteMany).not.toHaveBeenCalled();
  });

  it('hide behavior is unchanged by the new action', async () => {
    const prisma = buildPrisma();
    prisma.comment.findUnique.mockResolvedValue({ id: COMMENT, hidden: false, reportCount: 1, bodyAr: 'نص' });
    const { reg } = buildRegistry(prisma);
    await reg.execute('moderation.comment.moderate', { commentId: COMMENT, action: 'hide' }, ctx());
    expect(prisma.comment.update).toHaveBeenCalledWith({
      where: { id: COMMENT },
      data: { hidden: true },
    });
  });
});

describe('moderation.project.hide / unhide', () => {
  it('hide stamps hiddenAt + hiddenReasonAr from the written reason', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({
      id: PROJECT, titleAr: 'مشروع سِرب', hiddenAt: null, status: 'LIVE',
    });
    const { reg } = buildRegistry(prisma);

    const dry = await reg.dryRun('moderation.project.hide', { projectId: PROJECT }, ctx());
    expect(dry.ok).toBe(true);
    expect(dry.preview!.summaryAr).toContain('مشروع سِرب');
    expect(dry.preview!.before).toMatchObject({ visiblePublicly: true });
    expect(dry.preview!.after).toMatchObject({ visiblePublicly: false });

    await reg.execute('moderation.project.hide', { projectId: PROJECT }, ctx({ reason: 'مخالفة محتوى موثقة بالتفصيل' }));
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: PROJECT },
      data: { hiddenAt: expect.any(Date), hiddenReasonAr: 'مخالفة محتوى موثقة بالتفصيل' },
    });
  });

  it('hide refuses an already-hidden project (422 already-hidden)', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT, hiddenAt: new Date(), titleAr: 'م' });
    const { reg } = buildRegistry(prisma);
    await expect(
      reg.execute('moderation.project.hide', { projectId: PROJECT }, ctx()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'already-hidden' }),
    });
  });

  it('unhide refuses a project that is not hidden (422 not-hidden)', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT, hiddenAt: null, titleAr: 'م' });
    const { reg } = buildRegistry(prisma);
    await expect(
      reg.execute('moderation.project.unhide', { projectId: PROJECT }, ctx()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'not-hidden' }),
    });
  });

  it('unhide nulls both takedown fields', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({
      id: PROJECT, titleAr: 'م', hiddenAt: new Date(), hiddenReasonAr: 'سبب',
    });
    const { reg } = buildRegistry(prisma);
    await reg.execute('moderation.project.unhide', { projectId: PROJECT }, ctx());
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: PROJECT },
      data: { hiddenAt: null, hiddenReasonAr: null },
    });
  });
});

describe('moderation.user.ban / unban', () => {
  it('ban sets BANNED + the reason, revokes every active session, then notifies + emails', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: USER, name: 'مخالف', email: 'x@y.sa', suspendedAt: null, suspendedKind: null,
    });
    prisma.opsRoleGrant.count.mockResolvedValue(0);
    prisma.refreshToken.count.mockResolvedValue(3);
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });
    const { reg, deps } = buildRegistry(prisma);

    const out = await reg.execute<{ sessionsRevoked: number }>(
      'moderation.user.ban',
      { userId: USER },
      ctx({ reason: 'احتيال موثق على الداعمين' }),
    );
    expect(out.result!.sessionsRevoked).toBe(3);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER },
      data: {
        suspendedAt: expect.any(Date),
        suspendedKind: 'BANNED',
        suspendedReasonAr: 'احتيال موثق على الداعمين',
      },
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: USER, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });

    await flush(); // afterCommit is fire-and-forget
    expect(deps.notifications.create).toHaveBeenCalledWith({
      userId: USER,
      kind: 'ACCOUNT_SUSPENDED',
      payload: { banned: true, reasonAr: 'احتيال موثق على الداعمين' },
    });
    expect(deps.email.accountSuspended).toHaveBeenCalledWith('x@y.sa', {
      banned: true,
      reasonAr: 'احتيال موثق على الداعمين',
    });
  });

  it('ban refuses a target holding any ops role (422 target-is-operator)', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ id: USER, suspendedAt: null });
    prisma.opsRoleGrant.count.mockResolvedValue(1);
    const { reg } = buildRegistry(prisma);
    await expect(
      reg.execute('moderation.user.ban', { userId: USER }, ctx()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'target-is-operator' }),
    });
  });

  it('ban refuses an already suspended/banned account (422 already-suspended)', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ id: USER, suspendedAt: new Date() });
    prisma.opsRoleGrant.count.mockResolvedValue(0);
    const { reg } = buildRegistry(prisma);
    await expect(
      reg.execute('moderation.user.ban', { userId: USER }, ctx()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'already-suspended' }),
    });
  });

  it('unban refuses a SUSPENDED (not BANNED) account — that is users.reactivate territory', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: USER, suspendedAt: new Date(), suspendedKind: 'SUSPENDED',
    });
    const { reg } = buildRegistry(prisma);
    await expect(
      reg.execute('moderation.user.unban', { userId: USER }, ctx()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'not-banned' }),
    });
  });

  it('unban clears the three suspension fields and reactivates by notification + email', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: USER, name: 'عائد', email: 'x@y.sa',
      suspendedAt: new Date(), suspendedKind: 'BANNED', suspendedReasonAr: 'سبب',
    });
    const { reg, deps } = buildRegistry(prisma);
    await reg.execute('moderation.user.unban', { userId: USER }, ctx());
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER },
      data: { suspendedAt: null, suspendedKind: null, suspendedReasonAr: null },
    });
    await flush();
    expect(deps.notifications.create).toHaveBeenCalledWith({
      userId: USER,
      kind: 'ACCOUNT_REACTIVATED',
      payload: {},
    });
    expect(deps.email.accountReactivated).toHaveBeenCalledWith('x@y.sa', 'عائد');
  });
});

/* ── public reads exclude hidden projects ───────────────────────────────── */

/** Extract the SQL text out of a Prisma.sql tagged-template argument. */
function sqlText(arg: unknown): string {
  const sql = arg as { strings?: string[] };
  return Array.isArray(sql.strings) ? sql.strings.join('?') : String(arg);
}

describe('public reads filter hiddenAt', () => {
  it('ProjectsService.list always ANDs hiddenAt: null into the public where-clause', async () => {
    const prisma = {
      project: { findMany: jest.fn().mockResolvedValue([]) },
      category: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const svc = new ProjectsService(prisma, { log: jest.fn() } as never, { get: jest.fn() } as never, { setProjectTags: jest.fn() } as never);
    await svc.list({} as never);
    const where = (prisma.project.findMany as Mock).mock.calls[0][0].where;
    expect(where.hiddenAt).toBeNull();
  });

  it('ProjectsService.similar excludes hidden projects from the rail', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: PROJECT, categoryId: 'cat-1', category: null, categoryRef: { parentId: null },
        }),
        findMany,
      },
    } as unknown as PrismaService;
    const svc = new ProjectsService(prisma, { log: jest.fn() } as never, { get: jest.fn() } as never, { setProjectTags: jest.fn() } as never);
    await svc.similar(PROJECT);
    for (const call of findMany.mock.calls) {
      expect(call[0].where.hiddenAt).toBeNull();
    }
  });

  it('ProjectsService.findByIdOrSlug 404s a hidden project for strangers but not its creator', async () => {
    const hidden = {
      id: PROJECT, createdById: USER, hiddenAt: new Date(),
      rewardTiers: [],
    };
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue(hidden) },
    } as unknown as PrismaService;
    const svc = new ProjectsService(prisma, { log: jest.fn() } as never, { get: jest.fn() } as never, { setProjectTags: jest.fn() } as never);
    // anonymous + a different viewer → the not-found behavior
    await expect(svc.findByIdOrSlug(PROJECT)).rejects.toThrow('project not found');
    await expect(svc.findByIdOrSlug(PROJECT, 'someone-else')).rejects.toThrow('project not found');
    // the creator keeps seeing their own hidden project
    await expect(svc.findByIdOrSlug(PROJECT, USER)).resolves.toMatchObject({ id: PROJECT });
  });

  it('SearchService.search SQL requires p."hiddenAt" IS NULL', async () => {
    const $queryRaw = jest.fn().mockResolvedValue([]);
    const prisma = { $queryRaw, category: { findFirst: jest.fn() } } as unknown as PrismaService;
    const svc = new SearchService(prisma);
    await svc.search('قهوة');
    expect(sqlText({ strings: $queryRaw.mock.calls[0][0] })).toContain('p."hiddenAt" IS NULL');
  });

  it('DiscoverService.list (and its total) carry the hiddenAt predicate', async () => {
    const $queryRaw = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ n: 0 }]);
    const prisma = { $queryRaw } as unknown as PrismaService;
    const svc = new DiscoverService(prisma);
    await svc.list({});
    expect(sqlText($queryRaw.mock.calls[0][0])).toContain('p."hiddenAt" IS NULL');
    expect(sqlText($queryRaw.mock.calls[1][0])).toContain('p."hiddenAt" IS NULL');
  });

  it('HomeService rails (featured + trending) filter hiddenAt: null', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      homepageSection: {
        findMany: jest.fn().mockResolvedValue([{ key: 'featured_recommended', sortOrder: 1 }]),
      },
      editorialCard: { findMany: jest.fn().mockResolvedValue([]) },
      project: { findMany },
    } as unknown as PrismaService;
    const svc = new HomeService(prisma);
    await svc.compose();
    expect(findMany).toHaveBeenCalled();
    for (const call of findMany.mock.calls) {
      expect(call[0].where.hiddenAt).toBeNull();
    }
  });

  it('CategoriesService live counts group only over non-hidden projects', async () => {
    const groupBy = jest.fn().mockResolvedValue([]);
    const prisma = {
      category: { findMany: jest.fn().mockResolvedValue([]) },
      project: { groupBy },
    } as unknown as PrismaService;
    const svc = new CategoriesService(prisma);
    await svc.getTree();
    expect(groupBy.mock.calls[0][0].where).toMatchObject({ hiddenAt: null });
  });
});
