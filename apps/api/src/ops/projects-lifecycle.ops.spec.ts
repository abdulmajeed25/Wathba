import { OperationsRegistry } from './operations.registry';
import { projectsLifecycleOps } from './operations/projects-lifecycle.ops';
import type { OperationContext } from './operation.types';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * OPS-PRO Phase 1 — project-lifecycle guard + delegation tests:
 *  · force-close refuses a non-closeable (settled) campaign, claims LIVE→FAILED
 *    atomically, and delegates the refund sweep to EscrowService.
 *  · pause.admin refuses a non-LIVE campaign and writes PAUSED + pausedAt.
 *  · unpause.admin accrues the elapsed paused time toward the cumulative total.
 */

type Mock = jest.Mock;

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
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
  };
}

type Model = ReturnType<typeof model>;

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
        if (prop === '$transaction') return (fn: (tx: unknown) => unknown) => fn(proxy);
        return get(prop);
      },
    },
  ) as unknown as PrismaService;
  return { proxy, m: get };
}

const PROJECT = '33333333-3333-4333-8333-333333333333';

const ctx = (over: Partial<OperationContext> = {}): OperationContext => ({
  actor: { id: 'admin-1', type: 'HUMAN', roles: ['OWNER'], permissions: ['*'] },
  reason: 'إغلاق قسري لحملة مخالفة بعد قرار الامتثال',
  idempotencyKey: 'pl-k1',
  stepUpVerifiedAt: new Date(),
  ...over,
});

function regWith(proxy: PrismaService): {
  reg: OperationsRegistry;
  escrow: { adminRefundProject: Mock };
  notifications: { create: Mock };
} {
  const reg = new OperationsRegistry(proxy);
  reg.permissionPort = { has: () => true };
  const escrow = {
    adminRefundProject: jest
      .fn()
      .mockResolvedValue({ refunded: 5, failed: 0, totalHalalas: 90_000_000n }),
  };
  const notifications = { create: jest.fn().mockResolvedValue(null) };
  const deps = { prisma: proxy, escrow, notifications, email: {} };
  for (const op of projectsLifecycleOps(deps as never)) reg.register(op);
  return { reg, escrow, notifications };
}

describe('projects.force-close', () => {
  it('refuses a settled/terminal campaign (not-closeable)', async () => {
    const { proxy, m } = buildPrisma();
    m('project').findUnique.mockResolvedValue({ id: PROJECT, status: 'FUNDED', titleAr: 'م' });
    const { reg } = regWith(proxy);
    await expect(
      reg.execute('projects.force-close', { projectId: PROJECT }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'not-closeable' }) });
  });

  it('claims LIVE→FAILED atomically and delegates the refund sweep to escrow', async () => {
    const { proxy, m } = buildPrisma();
    m('project').findUnique.mockResolvedValue({ id: PROJECT, status: 'LIVE', titleAr: 'م', createdById: 'c1' });
    const { reg, escrow } = regWith(proxy);
    const out = await reg.execute('projects.force-close', { projectId: PROJECT }, ctx());
    expect((out.result as { closed: boolean }).closed).toBe(true);
    expect(m('project').updateMany).toHaveBeenCalledWith({
      where: { id: PROJECT, status: { in: ['LIVE', 'PAUSED', 'UNDER_REVIEW', 'SCHEDULED'] } },
      data: { status: 'FAILED' },
    });
    expect(escrow.adminRefundProject).toHaveBeenCalledWith(PROJECT);
    expect((out.result as { totalHalalas: string }).totalHalalas).toBe('90000000');
  });

  it('no-ops (no refund sweep) when the atomic claim loses the race', async () => {
    const { proxy, m } = buildPrisma();
    m('project').findUnique.mockResolvedValue({ id: PROJECT, status: 'LIVE', titleAr: 'م' });
    m('project').updateMany.mockResolvedValue({ count: 0 }); // a concurrent settle won
    const { reg, escrow } = regWith(proxy);
    const out = await reg.execute('projects.force-close', { projectId: PROJECT }, ctx());
    expect((out.result as { closed: boolean }).closed).toBe(false);
    expect(escrow.adminRefundProject).not.toHaveBeenCalled();
  });
});

describe('projects.pause.admin', () => {
  it('refuses a non-LIVE campaign (not-live)', async () => {
    const { proxy, m } = buildPrisma();
    m('project').findUnique.mockResolvedValue({ id: PROJECT, status: 'PAUSED', titleAr: 'م' });
    const { reg } = regWith(proxy);
    await expect(
      reg.execute('projects.pause.admin', { projectId: PROJECT }, ctx({ reason: undefined })),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'not-live' }) });
  });

  it('writes PAUSED + pausedAt on a LIVE campaign (bypassing the creator cap)', async () => {
    const { proxy, m } = buildPrisma();
    m('project').findUnique.mockResolvedValue({ id: PROJECT, status: 'LIVE', titleAr: 'م' });
    const { reg } = regWith(proxy);
    await reg.execute('projects.pause.admin', { projectId: PROJECT }, ctx({ reason: undefined }));
    expect(m('project').updateMany).toHaveBeenCalledWith({
      where: { id: PROJECT, status: 'LIVE' },
      data: { status: 'PAUSED', pausedAt: expect.any(Date) },
    });
  });
});

describe('projects.unpause.admin', () => {
  it('accrues the elapsed paused time and returns to LIVE', async () => {
    const { proxy, m } = buildPrisma();
    m('project').findUnique.mockResolvedValue({ id: PROJECT, status: 'PAUSED', titleAr: 'م' });
    m('project').findUniqueOrThrow.mockResolvedValue({
      pausedAt: new Date(Date.now() - 10_000), // paused 10s ago
      pausedMsAccrued: 5_000n,
    });
    const { reg } = regWith(proxy);
    const out = await reg.execute('projects.unpause.admin', { projectId: PROJECT }, ctx({ reason: undefined }));
    const call = m('project').updateMany.mock.calls.find(
      (c) => (c[0] as { data: { status?: string } }).data.status === 'LIVE',
    )!;
    const data = (call[0] as { data: { status: string; pausedAt: unknown; pausedMsAccrued: bigint } })
      .data;
    expect(data.status).toBe('LIVE');
    expect(data.pausedAt).toBeNull();
    // 5s prior + ~10s just elapsed → at least 15s accrued.
    expect(data.pausedMsAccrued).toBeGreaterThanOrEqual(15_000n);
    expect(BigInt((out.result as { pausedMsAccrued: string }).pausedMsAccrued)).toBeGreaterThanOrEqual(
      15_000n,
    );
  });
});
