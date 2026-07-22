import { z } from 'zod';

import { OperationsRegistry, inputHashOf, readOnlyDb } from './operations.registry';
import { moneyOps } from './operations/money.ops';
import type { OperationContext, OperationDef } from './operation.types';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * OPS Part 0 — the guard tests ARE the deliverable:
 *  · zod input validation · permission refusal · reason forced on MONEY/
 *    SENSITIVE · idempotencyKey forced on MONEY · AGENT+MONEY refused
 *    regardless of role · step-up window (flag forced on) · four-eyes queue
 *  · preconditions → 422 with the Arabic reason
 *  · dryRun purity: writes are physically blocked
 *  · idempotent replay (same key+input) / conflict (same key, new input)
 *  · no audit = no commit (audit failure rolls the mutation back)
 *  · orchestrated claim lifecycle (CLAIMED → COMPLETED/FAILED)
 *  · money.milestone.release computes from REALIZED, never raised (27M proof)
 */

type Mock = jest.Mock;
interface MockModel {
  findUnique: Mock; findUniqueOrThrow: Mock; findFirst: Mock; findFirstOrThrow: Mock;
  findMany: Mock; count: Mock; create: Mock; update: Mock; updateMany: Mock;
  delete: Mock; deleteMany: Mock; upsert: Mock;
}
interface MockDb {
  project: MockModel; milestone: MockModel; payout: MockModel; pledge: MockModel;
  user: MockModel; comment: MockModel; commentReport: MockModel; projectReport: MockModel;
  editorialCard: MockModel; homepageSection: MockModel; collection: MockModel;
  projectCollection: MockModel; operationExecution: MockModel; auditLog: MockModel;
  operationProposal: MockModel; opsRole: MockModel; opsRoleGrant: MockModel;
  $transaction: Mock;
}

function buildPrisma(): MockDb {
  const model = () => ({
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
    project: model(), milestone: model(), payout: model(), pledge: model(),
    user: model(), comment: model(), commentReport: model(), projectReport: model(),
    editorialCard: model(), homepageSection: model(), collection: model(),
    projectCollection: model(), operationExecution: model(), auditLog: model(),
    operationProposal: model(), opsRole: model(), opsRoleGrant: model(),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

const asPrisma = (db: MockDb): PrismaService => db as unknown as PrismaService;

const HUMAN_ADMIN: OperationContext['actor'] = { id: 'admin-1', type: 'HUMAN', roles: ['ADMIN'] };
const ctx = (over: Partial<OperationContext> = {}): OperationContext => ({
  actor: HUMAN_ADMIN,
  // Part 1 — step-up is enforced unconditionally; tests carry a fresh
  // re-auth by default and override it to prove the refusal.
  stepUpVerifiedAt: new Date(),
  ...over,
});

function simpleOp(over: Partial<OperationDef<{ id: string }, { done: true }>> = {}): OperationDef<{ id: string }, { done: true }> {
  return {
    key: 'test.simple',
    titleAr: 'عملية اختبارية',
    descriptionAr: '—',
    inputSchema: z.object({ id: z.string() }),
    permission: 'test.perm',
    riskTier: 'STANDARD',
    reversible: true,
    requiresReason: false,
    preconditions: [],
    dryRun: async () => ({ summaryAr: 'ok', before: null, after: null }),
    execute: async (tx) => {
      await (tx as unknown as { project: { update: Mock } }).project.update({
        where: { id: 'x' },
        data: {},
      });
      return { done: true as const };
    },
    ...over,
  };
}

describe('OperationsRegistry — gates', () => {
  it('rejects invalid input via zod with Arabic message', async () => {
    const prisma = buildPrisma();
    const reg = new OperationsRegistry(asPrisma(prisma));
    reg.register(simpleOp());
    await expect(reg.execute('test.simple', { id: 42 }, ctx())).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'مدخلات غير صالحة' }),
    });
  });

  it('refuses an actor without the permission', async () => {
    const prisma = buildPrisma();
    const reg = new OperationsRegistry(asPrisma(prisma));
    reg.register(simpleOp());
    await expect(
      reg.execute('test.simple', { id: 'a' }, ctx({ actor: { id: 'u', type: 'HUMAN', roles: ['BACKER'] } })),
    ).rejects.toThrow(/الصلاحية/);
  });

  it('forces a written reason (≥10 chars) on MONEY and SENSITIVE tiers', async () => {
    const prisma = buildPrisma();
    const reg = new OperationsRegistry(asPrisma(prisma));
    reg.register(simpleOp({ key: 'test.sensitive', riskTier: 'SENSITIVE' }));
    await expect(reg.execute('test.sensitive', { id: 'a' }, ctx())).rejects.toThrow(/سبباً مكتوباً/);
    await expect(
      reg.execute('test.sensitive', { id: 'a' }, ctx({ reason: 'قصير' })),
    ).rejects.toThrow(/سبباً مكتوباً/);
    const ok = await reg.execute('test.sensitive', { id: 'a' }, ctx({ reason: 'سبب تشغيلي واضح ومكتوب' }));
    expect(ok.result).toEqual({ done: true });
  });

  it('MONEY requires an idempotencyKey', async () => {
    const prisma = buildPrisma();
    const reg = new OperationsRegistry(asPrisma(prisma));
    reg.register(simpleOp({ key: 'test.money', riskTier: 'MONEY' }));
    await expect(
      reg.execute('test.money', { id: 'a' }, ctx({ reason: 'سبب مالي مكتوب وواضح' })),
    ).rejects.toThrow(/idempotencyKey/);
  });

  it('HARD RULE: an AGENT can never execute MONEY — even with the ADMIN role', async () => {
    const prisma = buildPrisma();
    const reg = new OperationsRegistry(asPrisma(prisma));
    // Grant the agent EVERY permission — the refusal must ignore permissions.
    reg.permissionPort = { has: () => true };
    reg.register(simpleOp({ key: 'test.money', riskTier: 'MONEY' }));
    await expect(
      reg.execute(
        'test.money',
        { id: 'a' },
        ctx({
          actor: { id: 'agent-1', type: 'AGENT', roles: ['ADMIN'] },
          reason: 'سبب مالي مكتوب وواضح',
          idempotencyKey: 'k1',
        }),
      ),
    ).rejects.toThrow(/وكلاء/);
    // dryRun stays allowed for agents.
    prisma.project.findUnique.mockResolvedValue({ id: 'a' });
    const dry = await reg.dryRun('test.money', { id: 'a' }, ctx({ actor: { id: 'agent-1', type: 'AGENT', roles: ['ADMIN'] } }));
    expect(dry.ok).toBe(true);
  });

  it('step-up window enforced unconditionally on MONEY (Part 1 — no flag)', async () => {
    const prisma = buildPrisma();
    const reg = new OperationsRegistry(asPrisma(prisma));
    reg.register(simpleOp({ key: 'test.money', riskTier: 'MONEY' }));
    const base = { reason: 'سبب مالي مكتوب وواضح', idempotencyKey: 'k-step' };
    await expect(
      reg.execute('test.money', { id: 'a' }, ctx({ ...base, stepUpVerifiedAt: null })),
    ).rejects.toThrow(/إعادة توثيق/);
    await expect(
      reg.execute('test.money', { id: 'a' }, ctx({ ...base, stepUpVerifiedAt: new Date(Date.now() - 11 * 60_000) })),
    ).rejects.toThrow(/إعادة توثيق/);
    prisma.operationExecution.findUnique.mockResolvedValue(null);
    const ok = await reg.execute(
      'test.money',
      { id: 'a' },
      ctx({ ...base, idempotencyKey: 'k-step-2', stepUpVerifiedAt: new Date() }),
    );
    expect(ok.result).toEqual({ done: true });
  });

  it('four-eyes intercepts MONEY execution: a proposal is filed with the dryRun snapshot, NOTHING executes', async () => {
    const prisma = buildPrisma();
    const reg = new OperationsRegistry(asPrisma(prisma));
    reg.fourEyesPort = { mustQueue: async () => true };
    reg.register(simpleOp({ key: 'test.money', riskTier: 'MONEY' }));
    prisma.operationExecution.findUnique.mockResolvedValue(null);
    prisma.operationProposal.findUnique.mockResolvedValue(null);
    const out = await reg.execute(
      'test.money',
      { id: 'a' },
      ctx({ reason: 'سبب مالي مكتوب وواضح', idempotencyKey: 'k2' }),
    );
    expect(out.queued).toBe(true);
    expect(out.result).toBeNull();
    expect(out.executionId).toBeNull();
    expect(out.proposalId).toBeTruthy();
    // Nothing mutated, no execution row — only the proposal + its audit row.
    expect(prisma.project.update).not.toHaveBeenCalled();
    expect(prisma.operationExecution.create).not.toHaveBeenCalled();
    expect(prisma.operationProposal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        operationKey: 'test.money',
        riskTier: 'MONEY',
        proposedById: 'admin-1',
        idempotencyKey: 'k2',
        preview: expect.objectContaining({ summaryAr: 'ok' }),
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'ops.proposal.create' }),
    });
  });

  it('replaying the queued idempotencyKey returns the SAME proposal, no duplicate', async () => {
    const prisma = buildPrisma();
    const reg = new OperationsRegistry(asPrisma(prisma));
    reg.fourEyesPort = { mustQueue: async () => true };
    reg.register(simpleOp({ key: 'test.money', riskTier: 'MONEY' }));
    prisma.operationExecution.findUnique.mockResolvedValue(null);
    prisma.operationProposal.findUnique.mockResolvedValue({
      id: 'prop-1',
      operationKey: 'test.money',
      inputHash: inputHashOf({ id: 'a' }),
      status: 'PENDING',
    });
    const out = await reg.execute(
      'test.money',
      { id: 'a' },
      ctx({ reason: 'سبب مالي مكتوب وواضح', idempotencyKey: 'k2' }),
    );
    expect(out).toMatchObject({ queued: true, replayed: true, proposalId: 'prop-1' });
    expect(prisma.operationProposal.create).not.toHaveBeenCalled();
  });

  it('a failing precondition refuses with its Arabic reason (422)', async () => {
    const prisma = buildPrisma();
    const reg = new OperationsRegistry(asPrisma(prisma));
    reg.register(
      simpleOp({
        preconditions: [
          { code: 'blocked', reasonAr: 'شرط مسبق فشل — سبب عربي', check: async () => false },
        ],
      }),
    );
    await expect(reg.execute('test.simple', { id: 'a' }, ctx())).rejects.toMatchObject({
      response: expect.objectContaining({ reasonAr: 'شرط مسبق فشل — سبب عربي' }),
    });
    const dry = await reg.dryRun('test.simple', { id: 'a' }, ctx());
    expect(dry.ok).toBe(false);
    expect(dry.blockers[0]).toEqual({ code: 'blocked', reasonAr: 'شرط مسبق فشل — سبب عربي' });
  });
});

describe('OperationsRegistry — dryRun purity', () => {
  it('physically blocks writes inside dryRun (proxy throws)', async () => {
    const prisma = buildPrisma();
    const reg = new OperationsRegistry(asPrisma(prisma));
    reg.register(
      simpleOp({
        dryRun: async (db) => {
          await (db as unknown as { project: { update: Mock } }).project.update({
            where: { id: 'x' },
            data: {},
          });
          return { summaryAr: 'never', before: null, after: null };
        },
      }),
    );
    await expect(reg.dryRun('test.simple', { id: 'a' }, ctx())).rejects.toThrow(/purity violation/);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('the read-only proxy blocks $transaction and raw writes too', () => {
    const prisma = buildPrisma();
    const db = readOnlyDb(asPrisma(prisma));
    expect(() => (db as unknown as { $transaction: unknown }).$transaction).toThrow(/purity/);
  });
});

describe('OperationsRegistry — idempotency + audit-in-tx', () => {
  it('same key + same input replays the stored result without re-executing', async () => {
    const prisma = buildPrisma();
    const reg = new OperationsRegistry(asPrisma(prisma));
    const op = simpleOp();
    const spy = jest.spyOn(op, 'execute');
    reg.register(op);
    prisma.operationExecution.findUnique.mockResolvedValueOnce(null);
    const first = await reg.execute('test.simple', { id: 'a' }, ctx({ idempotencyKey: 'K' }));
    expect(first.replayed).toBe(false);
    prisma.operationExecution.findUnique.mockResolvedValueOnce({
      id: 'exec-1',
      operationKey: 'test.simple',
      inputHash: inputHashOf({ id: 'a' }),
      status: 'COMPLETED',
      result: { done: true },
    });
    const second = await reg.execute('test.simple', { id: 'a' }, ctx({ idempotencyKey: 'K' }));
    expect(second.replayed).toBe(true);
    expect(second.result).toEqual({ done: true });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('same key + different input is refused (409)', async () => {
    const prisma = buildPrisma();
    const reg = new OperationsRegistry(asPrisma(prisma));
    reg.register(simpleOp());
    prisma.operationExecution.findUnique.mockResolvedValue({
      id: 'exec-1',
      operationKey: 'test.simple',
      inputHash: inputHashOf({ id: 'a' }),
      status: 'COMPLETED',
      result: { done: true },
    });
    await expect(
      reg.execute('test.simple', { id: 'DIFFERENT' }, ctx({ idempotencyKey: 'K' })),
    ).rejects.toThrow(/بمدخلات مختلفة/);
  });

  it('NO AUDIT = NO COMMIT: an audit-write failure rejects the whole execution', async () => {
    const prisma = buildPrisma();
    prisma.auditLog.create.mockRejectedValue(new Error('audit sink down'));
    const reg = new OperationsRegistry(asPrisma(prisma));
    reg.register(simpleOp());
    // $transaction mock propagates the rejection exactly like a rollback.
    await expect(reg.execute('test.simple', { id: 'a' }, ctx())).rejects.toThrow('audit sink down');
    // The mutation ran inside the same (rolled-back) tx — registry must NOT
    // have swallowed the failure the way the legacy AuditService did.
  });

  it('orchestrated ops: claim → COMPLETED on success, FAILED on error, CLAIMED refuses replay', async () => {
    const prisma = buildPrisma();
    const reg = new OperationsRegistry(asPrisma(prisma));
    let fail = true;
    reg.register(
      simpleOp({
        key: 'test.orch',
        riskTier: 'MONEY',
        orchestrated: true,
        execute: async () => {
          if (fail) throw new Error('psp down');
          return { done: true as const };
        },
      }),
    );
    const base = { reason: 'سبب مالي مكتوب وواضح' };
    prisma.operationExecution.findUnique.mockResolvedValue(null);
    await expect(
      reg.execute('test.orch', { id: 'a' }, ctx({ ...base, idempotencyKey: 'O1' })),
    ).rejects.toThrow('psp down');
    expect(prisma.operationExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    fail = false;
    const ok = await reg.execute('test.orch', { id: 'a' }, ctx({ ...base, idempotencyKey: 'O2' }));
    expect(ok.result).toEqual({ done: true });
    expect(prisma.operationExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
    );
    // A CLAIMED row (crash mid-flight) refuses silent auto-replay.
    prisma.operationExecution.findUnique.mockResolvedValue({
      id: 'exec-1', operationKey: 'test.orch', inputHash: inputHashOf({ id: 'a' }), status: 'CLAIMED',
    });
    await expect(
      reg.execute('test.orch', { id: 'a' }, ctx({ ...base, idempotencyKey: 'O2' })),
    ).rejects.toThrow(/CLAIMED/);
  });
});

describe('money.milestone.release — realized-basis proof (ported from milestones spec)', () => {
  function regWithMoneyOps(prisma: ReturnType<typeof buildPrisma>): OperationsRegistry {
    const reg = new OperationsRegistry(asPrisma(prisma));
    for (const op of moneyOps({
      prisma: asPrisma(prisma),
      funding: {} as never,
      disburser: {} as never,
      escrow: {} as never,
      moyasar: {} as never,
      zatca: {} as never,
      notifications: { create: jest.fn().mockResolvedValue(null) } as never,
      email: { milestoneReleased: jest.fn().mockResolvedValue({}) } as never,
    }))
      reg.register(op);
    return reg;
  }
  const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
  const MILESTONE_ID = '22222222-2222-4222-8222-222222222222';

  it('releases 30% of REALIZED (90M → 27M), never raised (100M), and queues the PENDING payout', async () => {
    const prisma = buildPrisma();
    const project = {
      id: PROJECT_ID, status: 'FUNDED',
      raisedHalalas: 100_000_000n, realizedHalalas: 90_000_000n,
      createdById: 'u1', titleAr: 'مشروع',
    };
    const milestone = { id: MILESTONE_ID, projectId: PROJECT_ID, status: 'APPROVED', releasePct: 30, titleAr: 'م١', evidenceUrl: 'https://x/1' };
    prisma.project.findUnique.mockResolvedValue(project);
    prisma.project.findUniqueOrThrow.mockResolvedValue(project);
    prisma.milestone.findFirst.mockResolvedValue(milestone);
    prisma.milestone.findFirstOrThrow.mockResolvedValue(milestone);
    prisma.milestone.update.mockResolvedValue({ ...milestone, status: 'RELEASED', releasedHalalas: 27_000_000n });
    const reg = regWithMoneyOps(prisma);
    prisma.operationExecution.findUnique.mockResolvedValue(null);
    const out = await reg.execute<{ amountHalalas: string }>(
      'money.milestone.release',
      { projectId: PROJECT_ID, milestoneId: MILESTONE_ID },
      ctx({ reason: 'صرف المرحلة الأولى بعد التحقق من الدليل', idempotencyKey: 'REL-1' }),
    );
    expect(out.result!.amountHalalas).toBe('27000000'); // 30% of REALIZED 90M
    expect(prisma.payout.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: PROJECT_ID, creatorId: 'u1', milestoneId: MILESTONE_ID,
        amountHalalas: 27_000_000n, status: 'PENDING',
      }),
    });
    // First release flips FUNDED → IN_PRODUCTION.
    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'IN_PRODUCTION' } }),
    );
  });

  it('refuses release when the project is not FUNDED/IN_PRODUCTION (Arabic precondition)', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID, status: 'LIVE', realizedHalalas: 1n });
    prisma.milestone.findFirst.mockResolvedValue({ id: MILESTONE_ID, status: 'APPROVED' });
    const reg = regWithMoneyOps(prisma);
    prisma.operationExecution.findUnique.mockResolvedValue(null);
    await expect(
      reg.execute(
        'money.milestone.release',
        { projectId: PROJECT_ID, milestoneId: MILESTONE_ID },
        ctx({ reason: 'صرف المرحلة الأولى تجريبياً', idempotencyKey: 'REL-2' }),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'project-not-funded' }),
    });
  });

  it('refuses release when the milestone is not APPROVED', async () => {
    const prisma = buildPrisma();
    prisma.project.findUnique.mockResolvedValue({
      id: PROJECT_ID, status: 'FUNDED', realizedHalalas: 90_000_000n,
    });
    prisma.milestone.findFirst.mockResolvedValue({ id: MILESTONE_ID, status: 'SUBMITTED' });
    const reg = regWithMoneyOps(prisma);
    prisma.operationExecution.findUnique.mockResolvedValue(null);
    await expect(
      reg.execute(
        'money.milestone.release',
        { projectId: PROJECT_ID, milestoneId: MILESTONE_ID },
        ctx({ reason: 'صرف المرحلة الأولى تجريبياً', idempotencyKey: 'REL-3' }),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'not-approved' }),
    });
  });

  it('money.deadline.override enforces the 120-day policy cap', async () => {
    const prisma = buildPrisma();
    const published = new Date('2026-01-01T00:00:00Z');
    prisma.project.findUnique.mockResolvedValue({
      id: PROJECT_ID, status: 'LIVE', publishedAt: published, titleAr: 'م', deadline: new Date(),
    });
    const reg = regWithMoneyOps(prisma);
    prisma.operationExecution.findUnique.mockResolvedValue(null);
    await expect(
      reg.execute(
        'money.deadline.override',
        { projectId: PROJECT_ID, deadline: new Date('2026-06-01T00:00:00Z').toISOString() },
        ctx({ reason: 'تمديد يتجاوز السقف عمداً', idempotencyKey: 'DL-1' }),
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'beyond-duration-cap' }) });
    // Past deadline (settlement drill) stays allowed.
    const ok = await reg.execute(
      'money.deadline.override',
      { projectId: PROJECT_ID, deadline: new Date('2026-01-02T00:00:00Z').toISOString() },
      ctx({ reason: 'مقعد تسوية تشغيلي للاختبار', idempotencyKey: 'DL-2' }),
    );
    expect((ok.result as { ok: boolean }).ok).toBe(true);
  });
});
