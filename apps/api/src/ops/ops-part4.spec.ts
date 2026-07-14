import { z } from 'zod';

import { OperationsRegistry, inputHashOf } from './operations.registry';
import { OpsAgentsService } from './ops-agents.service';
import { agentsOps } from './operations/agents.ops';
import type { OperationContext, OperationDef } from './operation.types';
import type { PrismaService } from '../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';

/**
 * OPS Part 4 — the agent-surface guard tests ARE the deliverable:
 *  · AGENT + MONEY execute → refused before permissions (role-independent)
 *  · AGENT + SENSITIVE execute → refused (propose only)
 *  · AGENT + CONTENT/STANDARD execute → refused WITHOUT a fresh matching
 *    dryRun (no blind writes); allowed with one; hash mismatch refused
 *  · propose(): SENSITIVE/MONEY only; files a proposal, executes nothing
 *  · an AGENT can never approve a proposal (any tier)
 *  · SENSITIVE proposals are approved with the op's OWN permission
 *  · kill switch: AGENTS_ENABLED=false refuses every token instantly
 *  · tokens expire; inactive agents refuse; per-agent rate limit trips
 *  · agents.create refuses the OWNER role; minted tokens are never stored
 */

type Mock = jest.Mock;
const model = () => ({
  findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), findFirst: jest.fn(),
  findFirstOrThrow: jest.fn(), findMany: jest.fn().mockResolvedValue([]),
  count: jest.fn().mockResolvedValue(0),
  create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'row-1', ...data })),
  update: jest.fn().mockResolvedValue({}),
  updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  delete: jest.fn().mockResolvedValue({}),
  deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  upsert: jest.fn().mockResolvedValue({}),
});

function buildPrisma() {
  const prisma = {
    project: model(), user: model(), opsRole: model(), opsRoleGrant: model(),
    operationProposal: model(), operationExecution: model(), auditLog: model(),
    agentAccount: model(), agentDryRun: model(),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}
const asPrisma = (db: unknown): PrismaService => db as PrismaService;
const cfgOf = (env: Record<string, string>): ConfigService =>
  ({ get: (k: string) => env[k] }) as unknown as ConfigService;

const AGENT = (permissions: string[] = ['*']): OperationContext['actor'] => ({
  id: '00000000-0000-4000-8000-00000000a9e1',
  type: 'AGENT',
  roles: ['CONTENT_EDITOR'],
  permissions,
});
const ctx = (over: Partial<OperationContext> = {}): OperationContext => ({
  actor: AGENT(),
  stepUpVerifiedAt: null,
  ...over,
});

const opOf = (
  tier: 'CONTENT' | 'STANDARD' | 'SENSITIVE' | 'MONEY',
  over: Partial<OperationDef<{ id: string }, { done: true }>> = {},
): OperationDef<{ id: string }, { done: true }> => ({
  key: `test.${tier.toLowerCase()}`,
  titleAr: 'عملية اختبارية',
  descriptionAr: '—',
  inputSchema: z.object({ id: z.string() }),
  permission: 'test.perm',
  riskTier: tier,
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
});

function buildRegistry() {
  const prisma = buildPrisma();
  const reg = new OperationsRegistry(asPrisma(prisma));
  reg.permissionPort = {
    has: (a, p) => (a.permissions ?? []).includes('*') || (a.permissions ?? []).includes(p),
  };
  prisma.operationExecution.findUnique.mockResolvedValue(null);
  prisma.operationProposal.findUnique.mockResolvedValue(null);
  return { reg, prisma };
}

describe('OperationsRegistry — the agent hard rules', () => {
  it('AGENT + MONEY execute is refused before permissions; SENSITIVE is propose-only', async () => {
    const { reg, prisma } = buildRegistry();
    reg.register(opOf('MONEY'));
    reg.register(opOf('SENSITIVE'));
    await expect(
      reg.execute('test.money', { id: 'a' }, ctx({ reason: 'سبب مكتوب طويل كافٍ', idempotencyKey: 'k' })),
    ).rejects.toThrow(/لا يُنفّذون عمليات مالية/);
    await expect(
      reg.execute('test.sensitive', { id: 'a' }, ctx({ reason: 'سبب مكتوب طويل كافٍ' })),
    ).rejects.toThrow(/dryRun واقتراح فقط/);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('AGENT CONTENT execute without a fresh matching dryRun → refused (no blind writes)', async () => {
    const { reg, prisma } = buildRegistry();
    reg.register(opOf('CONTENT'));
    // default gate refuses
    await expect(reg.execute('test.content', { id: 'a' }, ctx())).rejects.toThrow(/لا تنفيذ أعمى/);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('with a fresh matching dryRun the execute passes; a different input refuses', async () => {
    const { reg, prisma } = buildRegistry();
    reg.register(opOf('CONTENT'));
    const seen: string[] = [];
    reg.agentGatePort = {
      recordDryRun: async (_a, _k, hash) => void seen.push(hash),
      hasFreshDryRun: async (_a, _k, hash) => seen.includes(hash),
    };
    // dryRun records the hash…
    const dry = await reg.dryRun('test.content', { id: 'a' }, ctx());
    expect(dry.ok).toBe(true);
    expect(seen).toContain(inputHashOf({ id: 'a' }));
    // …licensing the SAME input only.
    const out = await reg.execute('test.content', { id: 'a' }, ctx());
    expect(out.result).toEqual({ done: true });
    await expect(reg.execute('test.content', { id: 'DIFFERENT' }, ctx())).rejects.toThrow(
      /لا تنفيذ أعمى/,
    );
    expect(prisma.project.update).toHaveBeenCalledTimes(1);
  });

  it('propose(): SENSITIVE/MONEY only, needs a reason, files a proposal and executes NOTHING', async () => {
    const { reg, prisma } = buildRegistry();
    reg.register(opOf('CONTENT'));
    reg.register(opOf('MONEY'));
    await expect(
      reg.propose('test.content', { id: 'a' }, ctx({ reason: 'سبب مكتوب طويل كافٍ' })),
    ).rejects.toThrow(/تُنفَّذ مباشرة/);
    await expect(reg.propose('test.money', { id: 'a' }, ctx())).rejects.toThrow(/سبباً مكتوباً/);

    const out = await reg.propose(
      'test.money',
      { id: 'a' },
      ctx({ reason: 'اقتراح صرف من وكيل مالي', idempotencyKey: 'k-prop' }),
    );
    expect(out.queued).toBe(true);
    expect(prisma.operationProposal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ proposedByType: 'AGENT', riskTier: 'MONEY' }),
    });
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('an AGENT can never approve a proposal — any tier', async () => {
    const { reg, prisma } = buildRegistry();
    reg.register(opOf('SENSITIVE'));
    prisma.operationProposal.findUnique.mockResolvedValue({
      id: 'p1', operationKey: 'test.sensitive', input: { id: 'a' },
      inputHash: inputHashOf({ id: 'a' }), preview: {}, reason: 'أصل',
      riskTier: 'SENSITIVE', status: 'PENDING', proposedById: 'someone-else',
      proposedByType: 'HUMAN', idempotencyKey: null,
    });
    await expect(
      reg.executeProposal('p1', ctx({ reason: 'محاولة اعتماد من وكيل' })),
    ).rejects.toThrow(/لا يعتمدون الاقتراحات/);
  });

  it('a SENSITIVE proposal is approved with the op\'s OWN permission, not money.approve', async () => {
    const { reg, prisma } = buildRegistry();
    reg.register(opOf('SENSITIVE'));
    prisma.operationProposal.findUnique.mockResolvedValue({
      id: 'p1', operationKey: 'test.sensitive', input: { id: 'a' },
      inputHash: inputHashOf({ id: 'a' }), preview: { summaryAr: 'ok', before: null, after: null },
      reason: 'أصل السبب', riskTier: 'SENSITIVE', status: 'PENDING',
      proposedById: 'agent-1', proposedByType: 'AGENT', idempotencyKey: null,
    });
    const human = (perms: string[]): OperationContext =>
      ctx({
        actor: { id: 'human-1', type: 'HUMAN', roles: ['ADMIN'], permissions: perms },
        reason: 'اعتماد بعد مراجعة المعاينة',
        stepUpVerifiedAt: new Date(),
      });
    await expect(reg.executeProposal('p1', human(['money.approve']))).rejects.toThrow(/test\.perm/);
    const out = await reg.executeProposal('p1', human(['test.perm']));
    expect(out.result).toEqual({ done: true });
  });
});

describe('OpsAgentsService — token lifecycle', () => {
  const AGENT_ROW = (over: Record<string, unknown> = {}) => ({
    id: 'agent-1',
    nameAr: 'وكيل المحتوى',
    isActive: true,
    tokenExpiresAt: new Date(Date.now() + 60_000),
    lastUsedAt: new Date(),
    role: { key: 'CONTENT_EDITOR', permissions: ['content.editorial'] },
    ...over,
  });

  function build(env: Record<string, string> = {}, row: Record<string, unknown> | null = AGENT_ROW()) {
    const prisma = buildPrisma();
    prisma.agentAccount.findUnique.mockResolvedValue(row);
    return { svc: new OpsAgentsService(asPrisma(prisma), cfgOf(env)), prisma };
  }

  it('the kill switch refuses EVERY token instantly', async () => {
    const { svc } = build({ AGENTS_ENABLED: 'false' });
    await expect(svc.resolve('any')).rejects.toThrow(/AGENTS_ENABLED/);
  });

  it('expired and inactive tokens are refused', async () => {
    const expired = build({}, AGENT_ROW({ tokenExpiresAt: new Date(Date.now() - 1000) }));
    await expect(expired.svc.resolve('t')).rejects.toThrow(/منتهي/);
    const inactive = build({}, AGENT_ROW({ isActive: false }));
    await expect(inactive.svc.resolve('t')).rejects.toThrow(/غير صالح أو معطّل/);
  });

  it('resolves a live token to the role\'s permissions and rate-limits per agent', async () => {
    const { svc } = build({ AGENT_RATE_LIMIT_PER_MIN: '2' });
    const p1 = await svc.resolve('t');
    expect(p1.permissions).toEqual(['content.editorial']);
    await svc.resolve('t');
    await expect(svc.resolve('t')).rejects.toThrow(/حد الطلبات/);
  });
});

describe('agents.* operations', () => {
  it('agents.create refuses the OWNER role as a precondition', async () => {
    const create = agentsOps().find((o) => o.key === 'agents.create')!;
    const owner = create.preconditions.find((p) => p.code === 'owner-forbidden')!;
    expect(await owner.check({} as never, { nameAr: 'وكيل', roleKey: 'OWNER' } as never, ctx())).toBe(false);
    expect(await owner.check({} as never, { nameAr: 'وكيل', roleKey: 'REVIEWER' } as never, ctx())).toBe(true);
  });

  it('minted tokens are NEVER stored: redactResult strips them (create + rotate)', () => {
    for (const key of ['agents.create', 'agents.token.rotate'] as const) {
      const op = agentsOps().find((o) => o.key === key)!;
      const stored = op.redactResult!({
        agentId: 'a1',
        token: 'wagent_secret',
        tokenExpiresAt: 'x',
      } as never) as { token: string };
      expect(stored.token).not.toContain('wagent_');
    }
  });
});
