import { z } from 'zod';

import { OperationsRegistry, inputHashOf } from './operations.registry';
import { OpsRbacService } from './ops-rbac.service';
import { ALL_PERMISSIONS, ROLE_MATRIX, holdsMoneyPermission } from './permissions';
import { maskEmail, maskPhone } from './pii';
import { usersOps } from './operations/users.ops';
import type { OperationContext, OperationDef } from './operation.types';
import type { PrismaService } from '../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';

/**
 * OPS Part 2 — the guard tests ARE the deliverable:
 *  · RBAC: wildcard/exact permission match; a permission-less actor is
 *    refused; the legacy-ADMIN net only catches actors WITHOUT a resolved
 *    permissions list
 *  · FOUR-EYES: auto-ON the moment a 2nd money admin exists (flag ignored),
 *    config-controlled before that, env override is the ONLY off switch
 *  · approval queue: approve executes with audit; SELF-APPROVAL REFUSED at
 *    the domain level; approver needs money.approve + step-up + reason;
 *    input-hash mismatch refused; double-approve races lose
 *  · PDPL: masks; users.pii.unmask returns values to the CALLER but the
 *    execution ledger stores a redacted result
 *  · role matrix sanity: 8 roles, only OWNER holds '*', every key valid
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
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}
const asPrisma = (db: unknown): PrismaService => db as PrismaService;
const cfgOf = (env: Record<string, string>): ConfigService =>
  ({ get: (k: string) => env[k] }) as unknown as ConfigService;

const actor = (id: string, permissions?: string[]): OperationContext['actor'] => ({
  id, type: 'HUMAN', roles: ['ADMIN'], permissions,
});
const ctx = (over: Partial<OperationContext> = {}): OperationContext => ({
  actor: actor('admin-1', ['*']),
  stepUpVerifiedAt: new Date(),
  ...over,
});

const moneyOp = (over: Partial<OperationDef<{ id: string }, { done: true }>> = {}): OperationDef<{ id: string }, { done: true }> => ({
  key: 'test.money',
  titleAr: 'عملية مالية اختبارية',
  descriptionAr: '—',
  inputSchema: z.object({ id: z.string() }),
  permission: 'money.execute',
  riskTier: 'MONEY',
  reversible: false,
  requiresReason: true,
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

/* ── RBAC — PermissionPort ─────────────────────────────────────────────── */

describe('OpsRbacService — permission matrix', () => {
  const svc = () => new OpsRbacService(asPrisma(buildPrisma()), cfgOf({}));

  it("matches exact keys and the OWNER wildcard '*'", () => {
    expect(svc().has(actor('u', ['projects.review']), 'projects.review')).toBe(true);
    expect(svc().has(actor('u', ['*']), 'money.execute')).toBe(true);
    expect(svc().has(actor('u', ['projects.review']), 'money.execute')).toBe(false);
  });

  it('an actor WITH a resolved (empty) permission list is strictly refused — ADMIN enum alone buys nothing', () => {
    expect(svc().has(actor('u', []), 'projects.review')).toBe(false);
  });

  it('the legacy net only catches actors WITHOUT a resolved list (pre-Part-2 seams)', () => {
    expect(svc().has(actor('u', undefined), 'projects.review')).toBe(true); // ADMIN roles, no list
    expect(svc().has({ id: 'u', type: 'HUMAN', roles: ['BACKER'] }, 'projects.review')).toBe(false);
    expect(svc().has({ id: 'a', type: 'AGENT', roles: ['ADMIN'] }, 'projects.review')).toBe(false);
  });
});

/* ── FOUR-EYES — auto-on at the 2nd money admin ────────────────────────── */

function rbacWithMoneyAdmins(userIds: string[], env: Record<string, string> = {}) {
  const prisma = buildPrisma();
  prisma.opsRole.findMany.mockResolvedValue([
    { grants: userIds.map((userId) => ({ userId })) },
  ]);
  return { svc: new OpsRbacService(asPrisma(prisma), cfgOf(env)), prisma };
}

describe('OpsRbacService — four-eyes switch', () => {
  it('single-operator mode: OFF by default, ON only via FOUR_EYES_MONEY=1', async () => {
    expect(await rbacWithMoneyAdmins(['owner']).svc.fourEyesEffective()).toBe(false);
    expect(
      await rbacWithMoneyAdmins(['owner'], { FOUR_EYES_MONEY: '1' }).svc.fourEyesEffective(),
    ).toBe(true);
  });

  it('AUTO-ON the moment a SECOND money admin exists — the config flag is ignored', async () => {
    const { svc } = rbacWithMoneyAdmins(['owner', 'finance-2']); // flag NOT set
    expect(await svc.fourEyesEffective()).toBe(true);
    expect(await svc.mustQueue('MONEY', ctx())).toBe(true);
    expect(await svc.mustQueue('CONTENT', ctx())).toBe(false);
  });

  it('counts DISTINCT users across money roles (owner holding two roles ≠ two admins)', async () => {
    const prisma = buildPrisma();
    prisma.opsRole.findMany.mockResolvedValue([
      { grants: [{ userId: 'owner' }] },
      { grants: [{ userId: 'owner' }] },
    ]);
    const svc = new OpsRbacService(asPrisma(prisma), cfgOf({}));
    expect(await svc.moneyAdminCount()).toBe(1);
    expect(await svc.fourEyesEffective()).toBe(false);
  });

  it('the env override is the ONLY off switch with 2+ admins, and it screams in the log', async () => {
    const { svc } = rbacWithMoneyAdmins(['owner', 'finance-2'], {
      FOUR_EYES_MONEY_OVERRIDE: 'off',
    });
    const errorSpy = jest.spyOn(svc['logger'], 'error');
    expect(await svc.fourEyesEffective()).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('FOUR_EYES_MONEY'));
  });
});

/* ── The approval queue — executeProposal ──────────────────────────────── */

const PROPOSAL = {
  id: 'prop-1',
  operationKey: 'test.money',
  input: { id: 'a' },
  inputHash: inputHashOf({ id: 'a' }),
  preview: { summaryAr: 'ok' },
  reason: 'سبب الاقتراح الأصلي',
  riskTier: 'MONEY',
  status: 'PENDING',
  proposedById: 'proposer-1',
  proposedByType: 'HUMAN',
  idempotencyKey: 'k-prop',
};

function regWithProposal(proposal: Record<string, unknown> = PROPOSAL) {
  const prisma = buildPrisma();
  const reg = new OperationsRegistry(asPrisma(prisma));
  // The REAL Part-2 port — approval tests must run against the RBAC matrix,
  // not the fail-open Part-0 default.
  reg.permissionPort = new OpsRbacService(asPrisma(prisma), cfgOf({}));
  reg.register(moneyOp());
  prisma.operationProposal.findUnique.mockResolvedValue(proposal);
  prisma.operationExecution.findUnique.mockResolvedValue(null);
  return { reg, prisma };
}

const approverCtx = (over: Partial<OperationContext> = {}) =>
  ctx({
    actor: actor('approver-2', ['money.approve']),
    reason: 'اعتماد بعد مراجعة المعاينة والدليل',
    ...over,
  });

describe('OperationsRegistry — executeProposal (the second pair of eyes)', () => {
  it('a DIFFERENT user with money.approve + step-up + reason executes; proposal → EXECUTED with the executionId', async () => {
    const { reg, prisma } = regWithProposal();
    const out = await reg.executeProposal<{ done: true }>('prop-1', approverCtx());
    expect(out.result).toEqual({ done: true });
    expect(out.proposalId).toBe('prop-1');
    // Atomic claim happened, then the terminal EXECUTED update.
    expect(prisma.operationProposal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'prop-1', status: 'PENDING' } }),
    );
    expect(prisma.operationProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'EXECUTED' }) }),
    );
    // Execution carries the PROPOSER's idempotencyKey (replay-safe forever).
    expect(prisma.operationExecution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ idempotencyKey: 'k-prop' }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('SELF-APPROVAL is refused at the domain level — no role combination allows it', async () => {
    const { reg, prisma } = regWithProposal();
    await expect(
      reg.executeProposal('prop-1', approverCtx({ actor: actor('proposer-1', ['*']) })),
    ).rejects.toThrow(/اعتماد اقتراحك بنفسك/);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('an approver without money.approve is refused; an AGENT is refused before permissions', async () => {
    const { reg } = regWithProposal();
    await expect(
      reg.executeProposal('prop-1', approverCtx({ actor: actor('approver-2', ['money.execute']) })),
    ).rejects.toThrow(/money\.approve/);
    await expect(
      reg.executeProposal(
        'prop-1',
        approverCtx({ actor: { id: 'bot', type: 'AGENT', roles: [], permissions: ['*'] } }),
      ),
    ).rejects.toThrow(/وكلاء/);
  });

  it('a stale step-up refuses; a missing written reason refuses', async () => {
    const { reg } = regWithProposal();
    await expect(
      reg.executeProposal('prop-1', approverCtx({ stepUpVerifiedAt: new Date(Date.now() - 11 * 60_000) })),
    ).rejects.toThrow(/إعادة توثيق/);
    await expect(
      reg.executeProposal('prop-1', approverCtx({ reason: 'قصير' })),
    ).rejects.toThrow(/سبباً مكتوباً/);
  });

  it('input-hash mismatch (tampered stored input) refuses execution', async () => {
    const { reg } = regWithProposal({ ...PROPOSAL, inputHash: 'tampered' });
    await expect(reg.executeProposal('prop-1', approverCtx())).rejects.toThrow(/بصمة المدخلات/);
  });

  it('losing the double-approve race (claim count 0) → conflict, nothing executes', async () => {
    const { reg, prisma } = regWithProposal();
    prisma.operationProposal.updateMany.mockResolvedValue({ count: 0 });
    await expect(reg.executeProposal('prop-1', approverCtx())).rejects.toThrow(/ليس معلّقاً/);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('a failing execution marks the proposal FAILED (terminal, visible) and rethrows', async () => {
    const { reg, prisma } = regWithProposal();
    prisma.project.update.mockRejectedValue(new Error('psp down'));
    await expect(reg.executeProposal('prop-1', approverCtx())).rejects.toThrow('psp down');
    expect(prisma.operationProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });
});

/* ── PDPL — masks + the unmask operation ───────────────────────────────── */

describe('PII masking (PDPL)', () => {
  it('maskEmail / maskPhone never leak the middle', () => {
    expect(maskEmail('mohammed@alqassim.sa')).toBe('m***@a***.sa');
    expect(maskPhone('+966501234567')).toMatch(/^\*+67$/);
    expect(maskEmail(null)).toBeNull();
    expect(maskPhone('12')).toBe('****');
  });

  it('users.pii.unmask returns the values to the caller but REDACTS the stored result', async () => {
    const prisma = buildPrisma();
    const reg = new OperationsRegistry(asPrisma(prisma));
    for (const op of usersOps()) reg.register(op);
    const userId = '00000000-0000-4000-8000-0000000000aa';
    prisma.user.findUnique.mockResolvedValue({ id: userId, email: 'x@y.sa', phone: '0500000000' });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ email: 'x@y.sa', phone: '0500000000' });
    prisma.operationExecution.findUnique.mockResolvedValue(null);

    const out = await reg.execute<{ values: Record<string, string | null> }>(
      'users.pii.unmask',
      { userId, fields: ['email', 'phone'] },
      ctx({ actor: actor('support-1', ['users.pii.unmask']), reason: 'تذكرة دعم رقم ٤٥١ تتطلب التواصل' }),
    );
    expect(out.result!.values).toEqual({ email: 'x@y.sa', phone: '0500000000' });
    // The execution ledger stores the redaction, never the value.
    const stored = prisma.operationExecution.create.mock.calls[0]![0].data;
    expect(JSON.stringify(stored.result)).not.toContain('x@y.sa');
    expect(JSON.stringify(stored.result)).not.toContain('0500000000');
  });
});

/* ── The role matrix itself ────────────────────────────────────────────── */

describe('ROLE_MATRIX sanity', () => {
  it('exactly 8 roles, unique keys, only OWNER holds the wildcard', () => {
    expect(ROLE_MATRIX).toHaveLength(8);
    expect(new Set(ROLE_MATRIX.map((r) => r.key)).size).toBe(8);
    for (const r of ROLE_MATRIX) {
      if (r.key === 'OWNER') expect(r.permissions).toEqual(['*']);
      else expect(r.permissions).not.toContain('*');
    }
  });

  it('every permission in the matrix exists in the catalog', () => {
    for (const r of ROLE_MATRIX) {
      for (const p of r.permissions) {
        if (p !== '*') expect(ALL_PERMISSIONS).toContain(p);
      }
    }
  });

  it('money permissions live ONLY on OWNER and FINANCE; REVIEWER is review-only', () => {
    for (const r of ROLE_MATRIX) {
      if (r.key === 'OWNER' || r.key === 'FINANCE') {
        expect(holdsMoneyPermission(r.permissions)).toBe(true);
      } else {
        expect(holdsMoneyPermission(r.permissions)).toBe(false);
      }
    }
    expect(ROLE_MATRIX.find((r) => r.key === 'REVIEWER')!.permissions).toEqual(['projects.review']);
  });

  /* ── OPS-360 Phase B Unit 1 — census A6 RBAC gap closures ─────────────── */
  const perms = (key: string) => ROLE_MATRIX.find((r) => r.key === key)!.permissions;

  it('A6.1: MODERATOR is no longer blind — holds analytics.read (dashboard) alongside moderation.queue', () => {
    expect(perms('MODERATOR')).toEqual(expect.arrayContaining(['moderation.queue', 'analytics.read']));
    // still non-money, non-wildcard
    expect(holdsMoneyPermission(perms('MODERATOR'))).toBe(false);
    expect(perms('MODERATOR')).not.toContain('*');
  });

  it('A6.3: OPS_MANAGER can staff-pick and merge/grant-ops-roles — holds projects.feature + users.roles.assign (never money)', () => {
    expect(perms('OPS_MANAGER')).toEqual(expect.arrayContaining(['projects.feature', 'users.roles.assign']));
    expect(holdsMoneyPermission(perms('OPS_MANAGER'))).toBe(false);
  });

  it('A6.2: destructive/procurement perms re-homed OFF SUPPORT — SUPPORT lacks users.roles.assign (pdpl.erase) and cannot reach projects.lifecycle (suppliers.verify)', () => {
    expect(perms('SUPPORT')).not.toContain('users.roles.assign');
    expect(perms('SUPPORT')).not.toContain('projects.lifecycle');
    // SUPPORT keeps its legitimate lifecycle powers
    expect(perms('SUPPORT')).toEqual(expect.arrayContaining(['users.lifecycle', 'support.tickets']));
  });

  it('A6.4: procurement.read is a distinct catalog key held by OPS_MANAGER, NOT by REVIEWER', () => {
    expect(ALL_PERMISSIONS).toContain('procurement.read');
    expect(perms('OPS_MANAGER')).toContain('procurement.read');
    expect(perms('REVIEWER')).not.toContain('procurement.read');
  });
});
