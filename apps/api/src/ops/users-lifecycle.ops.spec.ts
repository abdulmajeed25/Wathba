import { createHash } from 'node:crypto';

import { OperationsRegistry } from './operations.registry';
import { usersOps } from './operations/users.ops';
import type { UsersOpsDeps } from './operations/users.ops';
import type { OperationContext } from './operation.types';
import type { PrismaService } from '../prisma/prisma.service';
import { JwtStrategy } from '../identity/jwt.strategy';

/**
 * Batch OPS (registry completion) — USERS group.
 *   suspend: refusals (missing / already-suspended / ops-role holder),
 *            fields set + every active session revoked in the same tx
 *   reactivate: refuses non-suspended and BANNED (moderation's job)
 *   force-password-reset: token hashed (sha256) not raw, priors invalidated,
 *            sessions revoked, ledger stores ONLY {tokenIssued:true}
 *   sessions.revoke: returns the revoked count
 *   pdpl.export: bundle to the caller, redacted in the ledger
 *   pdpl.erase: preconditions mirror PdplService's refusals (honest dryRun)
 *   JwtStrategy: a suspended user's live token dies at validate()
 */

type Mock = jest.Mock;
interface MockModel {
  findUnique: Mock; findUniqueOrThrow: Mock; findFirst: Mock; findFirstOrThrow: Mock;
  findMany: Mock; count: Mock; create: Mock; update: Mock; updateMany: Mock;
  delete: Mock; deleteMany: Mock; upsert: Mock;
}
interface MockDb {
  user: MockModel; refreshToken: MockModel; passwordResetToken: MockModel;
  opsRole: MockModel; opsRoleGrant: MockModel; pledge: MockModel; project: MockModel;
  comment: MockModel; address: MockModel; notification: MockModel;
  creatorFollow: MockModel; payoutBeneficiary: MockModel; supportTicket: MockModel;
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
    user: model(), refreshToken: model(), passwordResetToken: model(),
    opsRole: model(), opsRoleGrant: model(), pledge: model(), project: model(),
    comment: model(), address: model(), notification: model(),
    creatorFollow: model(), payoutBeneficiary: model(), supportTicket: model(),
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

const U = '33333333-3333-4333-8333-333333333333';

function makeDeps(prisma: MockDb): {
  deps: UsersOpsDeps;
  notifications: { create: Mock };
  email: { accountSuspended: Mock; accountReactivated: Mock; passwordReset: Mock };
  pdpl: { exportData: Mock; eraseAccount: Mock };
} {
  const notifications = { create: jest.fn().mockResolvedValue(null) };
  const email = {
    accountSuspended: jest.fn().mockResolvedValue({}),
    accountReactivated: jest.fn().mockResolvedValue({}),
    passwordReset: jest.fn().mockResolvedValue({}),
  };
  const pdpl = {
    exportData: jest.fn().mockResolvedValue({ profile: { email: 'raw@pii.sa' }, pledges: [] }),
    eraseAccount: jest.fn().mockResolvedValue({ erased: true }),
  };
  return {
    deps: {
      prisma: asPrisma(prisma),
      notifications: notifications as never,
      email: email as never,
      pdpl: pdpl as never,
    },
    notifications,
    email,
    pdpl,
  };
}

function makeRegistry(prisma: MockDb): {
  reg: OperationsRegistry;
  notifications: { create: Mock };
  email: { accountSuspended: Mock; accountReactivated: Mock; passwordReset: Mock };
  pdpl: { exportData: Mock; eraseAccount: Mock };
} {
  const reg = new OperationsRegistry(asPrisma(prisma));
  reg.permissionPort = { has: () => true };
  const { deps, notifications, email, pdpl } = makeDeps(prisma);
  for (const op of usersOps(deps)) reg.register(op);
  return { reg, notifications, email, pdpl };
}

/** afterCommit is fire-and-forget — flush the microtask queue to observe it. */
const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

const activeUser = { id: U, name: 'سارة', email: 's@x.sa', suspendedAt: null, suspendedKind: null };
const suspendedUser = {
  id: U, name: 'سارة', email: 's@x.sa',
  suspendedAt: new Date('2026-07-01T00:00:00Z'), suspendedKind: 'SUSPENDED', suspendedReasonAr: 'سبب',
};

describe('users.suspend', () => {
  it('refuses a missing user', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const { reg } = makeRegistry(prisma);
    await expect(reg.execute('users.suspend', { userId: U }, ctx())).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'user-missing' }),
    });
  });

  it('refuses an already suspended/banned account', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(suspendedUser);
    const { reg } = makeRegistry(prisma);
    await expect(reg.execute('users.suspend', { userId: U }, ctx())).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'already-suspended' }),
    });
  });

  it('refuses a target holding an ops role (revoke ops roles first)', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(activeUser);
    prisma.opsRoleGrant.count.mockResolvedValue(1);
    const { reg } = makeRegistry(prisma);
    await expect(reg.execute('users.suspend', { userId: U }, ctx())).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'target-is-operator' }),
    });
  });

  it('sets the suspension fields with ctx.reason and revokes every active session in the tx', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(activeUser);
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });
    const { reg, notifications, email } = makeRegistry(prisma);
    const out = await reg.execute<{ sessionsRevoked: number }>(
      'users.suspend', { userId: U }, ctx({ reason: 'مخالفة شروط الاستخدام المتكررة' }),
    );
    expect(out.result!.sessionsRevoked).toBe(3);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: U },
      data: expect.objectContaining({
        suspendedAt: expect.any(Date),
        suspendedKind: 'SUSPENDED',
        suspendedReasonAr: 'مخالفة شروط الاستخدام المتكررة',
      }),
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: U, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    await flush();
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: U, kind: 'ACCOUNT_SUSPENDED' }),
    );
    expect(email.accountSuspended).toHaveBeenCalledWith('s@x.sa', {
      banned: false,
      reasonAr: 'مخالفة شروط الاستخدام المتكررة',
    });
  });

  it('dryRun previews the status flip and counts.sessionsToRevoke', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(activeUser);
    prisma.refreshToken.count.mockResolvedValue(2);
    const { reg } = makeRegistry(prisma);
    const dry = await reg.dryRun('users.suspend', { userId: U }, ctx());
    expect(dry.ok).toBe(true);
    expect(dry.preview!.before).toEqual({ suspendedAt: null, suspendedKind: null });
    expect(dry.preview!.after).toEqual({ suspendedKind: 'SUSPENDED' });
    expect(dry.preview!.counts).toEqual({ sessionsToRevoke: 2 });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});

describe('users.reactivate', () => {
  it('refuses an account that is not suspended', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(activeUser);
    const { reg } = makeRegistry(prisma);
    await expect(reg.execute('users.reactivate', { userId: U }, ctx())).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'not-suspended' }),
    });
  });

  it('refuses a BANNED account — unbanning is moderation.user.unban', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ ...suspendedUser, suspendedKind: 'BANNED' });
    const { reg } = makeRegistry(prisma);
    await expect(reg.execute('users.reactivate', { userId: U }, ctx())).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'banned-not-suspended' }),
    });
  });

  it('nulls the three suspension fields and notifies', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(suspendedUser);
    const { reg, notifications, email } = makeRegistry(prisma);
    const out = await reg.execute('users.reactivate', { userId: U }, ctx());
    expect(out.result).toEqual({ reactivated: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: U },
      data: { suspendedAt: null, suspendedKind: null, suspendedReasonAr: null },
    });
    await flush();
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: U, kind: 'ACCOUNT_REACTIVATED' }),
    );
    expect(email.accountReactivated).toHaveBeenCalledWith('s@x.sa', 'سارة');
  });
});

describe('users.force-password-reset', () => {
  it('refuses a suspended account (reactivate first)', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(suspendedUser);
    const { reg } = makeRegistry(prisma);
    await expect(
      reg.execute('users.force-password-reset', { userId: U }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'suspended-user' }) });
  });

  it('stores sha256(token) never the raw, invalidates priors, revokes sessions; the ledger sees ONLY {tokenIssued:true}', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(activeUser);
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
    const { reg, email } = makeRegistry(prisma);
    const out = await reg.execute<{ tokenIssued: true; rawToken: string; sessionsRevoked: number }>(
      'users.force-password-reset', { userId: U }, ctx(),
    );
    const raw = out.result!.rawToken;
    expect(raw).toEqual(expect.any(String));
    // Prior tokens invalidated the service's way (usedAt, not delete).
    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: U, usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    // The row stores the sha256 hex of the raw token, 30-min TTL.
    const created = prisma.passwordResetToken.create.mock.calls[0][0].data;
    expect(created.tokenHash).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(created.tokenHash).not.toBe(raw);
    const ttlMs = created.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(29 * 60_000);
    expect(ttlMs).toBeLessThanOrEqual(30 * 60_000);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: U, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    // redactResult: the persisted execution result carries no token at all.
    const persisted = prisma.operationExecution.create.mock.calls[0][0].data;
    expect(persisted.result).toEqual({ tokenIssued: true });
    expect(JSON.stringify(persisted)).not.toContain(raw);
    // afterCommit: the raw token reaches the USER's inbox, not the actor.
    await flush();
    expect(email.passwordReset).toHaveBeenCalledWith(
      's@x.sa',
      expect.stringContaining(`/reset-password?token=${raw}`),
    );
  });
});

describe('users.sessions.revoke', () => {
  it('refuses a missing user', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const { reg } = makeRegistry(prisma);
    await expect(reg.execute('users.sessions.revoke', { userId: U }, ctx())).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'user-missing' }),
    });
  });

  it('revokes all active refresh tokens and returns the count; dryRun counts.activeSessions', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(activeUser);
    prisma.refreshToken.count.mockResolvedValue(4);
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 4 });
    const { reg } = makeRegistry(prisma);
    const dry = await reg.dryRun('users.sessions.revoke', { userId: U }, ctx());
    expect(dry.preview!.counts).toEqual({ activeSessions: 4 });
    const out = await reg.execute('users.sessions.revoke', { userId: U }, ctx());
    expect(out.result).toEqual({ revoked: 4 });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: U, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe('users.pdpl.export', () => {
  it('returns the PII bundle to the caller but persists only {exported:true}', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(activeUser);
    const { reg, pdpl } = makeRegistry(prisma);
    const out = await reg.execute<Record<string, unknown>>(
      'users.pdpl.export', { userId: U }, ctx(),
    );
    expect(pdpl.exportData).toHaveBeenCalledWith(U);
    expect(out.result).toEqual({ profile: { email: 'raw@pii.sa' }, pledges: [] });
    // Orchestrated: the claim row's COMPLETED update stores the redaction.
    const completed = prisma.operationExecution.update.mock.calls.find(
      (c: unknown[]) => (c[0] as { data: { status?: string } }).data.status === 'COMPLETED',
    );
    expect((completed![0] as { data: { result: unknown } }).data.result).toEqual({ exported: true });
    expect(JSON.stringify(completed![0])).not.toContain('raw@pii.sa');
  });

  it('dryRun counts what will be exported without touching PdplService', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(activeUser);
    prisma.pledge.count.mockResolvedValue(3);
    prisma.project.count.mockResolvedValue(1);
    prisma.comment.count.mockResolvedValue(7);
    const { reg, pdpl } = makeRegistry(prisma);
    const dry = await reg.dryRun('users.pdpl.export', { userId: U }, ctx());
    expect(dry.ok).toBe(true);
    expect(dry.preview!.counts).toEqual({ pledges: 3, projects: 1, comments: 7 });
    expect(pdpl.exportData).not.toHaveBeenCalled();
  });
});

describe('users.pdpl.erase', () => {
  it('refuses while pledges are HELD (mirrors the service refusal)', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(activeUser);
    prisma.pledge.count.mockResolvedValue(2);
    const { reg, pdpl } = makeRegistry(prisma);
    await expect(reg.execute('users.pdpl.erase', { userId: U }, ctx())).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'held-pledges' }),
    });
    expect(pdpl.eraseAccount).not.toHaveBeenCalled();
  });

  it('refuses while campaigns are active', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(activeUser);
    prisma.project.count.mockResolvedValue(1);
    const { reg } = makeRegistry(prisma);
    await expect(reg.execute('users.pdpl.erase', { userId: U }, ctx())).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'active-campaigns' }),
    });
  });

  it('refuses an already-erased shell (erased-… email)', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({
      ...activeUser, email: `erased-${U}@erased.wathba.sa`,
    });
    const { reg } = makeRegistry(prisma);
    await expect(reg.execute('users.pdpl.erase', { userId: U }, ctx())).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'already-erased' }),
    });
  });

  it('delegates to PdplService.eraseAccount (orchestrated — owns its own tx)', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(activeUser);
    const { reg, pdpl } = makeRegistry(prisma);
    const out = await reg.execute('users.pdpl.erase', { userId: U }, ctx());
    expect(pdpl.eraseAccount).toHaveBeenCalledWith(U);
    expect(out.result).toEqual({ erased: true });
  });

  it('dryRun masks the email and counts the satellites to be dropped', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(activeUser);
    prisma.address.count.mockResolvedValue(2);
    prisma.notification.count.mockResolvedValue(5);
    prisma.creatorFollow.count.mockResolvedValue(1);
    prisma.payoutBeneficiary.count.mockResolvedValue(1);
    const { reg } = makeRegistry(prisma);
    const dry = await reg.dryRun('users.pdpl.erase', { userId: U }, ctx());
    expect(dry.ok).toBe(true);
    expect(dry.preview!.before).toEqual({ email: 's***@x***.sa', name: 'سارة' });
    expect(dry.preview!.counts).toEqual({
      addresses: 2, notifications: 5, follows: 1, payoutBeneficiary: 1,
    });
    expect(JSON.stringify(dry.preview)).not.toContain('s@x.sa');
  });
});

describe('JwtStrategy — suspension enforcement on the live token', () => {
  const cfg = { get: () => 'a-sufficiently-long-jwt-secret' } as never;
  const payload = { sub: U, email: 's@x.sa', roles: ['BACKER'] } as never;

  it('rejects a suspended user with the Arabic 401', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ suspendedAt: new Date() }) },
    } as never;
    const strategy = new JwtStrategy(cfg, prisma);
    await expect(strategy.validate(payload)).rejects.toThrow('الحساب موقوف');
  });

  it('passes the payload through for an active user', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ suspendedAt: null }) },
    } as never;
    const strategy = new JwtStrategy(cfg, prisma);
    await expect(strategy.validate(payload)).resolves.toBe(payload);
  });
});
