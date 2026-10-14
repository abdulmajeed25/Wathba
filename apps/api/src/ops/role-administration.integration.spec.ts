import { createHash, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { OperationsRegistry } from './operations.registry';
import { usersOps } from './operations/users.ops';
import { OpsRbacService } from './ops-rbac.service';
import { OpsAuthService } from './ops-auth.service';
import { OpsAuthController } from './ops-auth.controller';
import { OpsSessionGuard, OpsIpAllowlistGuard } from './ops-session.guard';
import type { OperationContext } from './operation.types';
import { PdplService } from '../identity/pdpl.service';

const enabled = process.env.WATHBA_CONSENT_DB_TESTS === '1';
if (enabled) {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/wathba_audit') {
    throw new Error('Role administration requires the isolated audit database');
  }
}
const suite = enabled ? describe : describe.skip;
suite('Owner-only role administration and live catalogue', () => {
  const db = new PrismaClient();
  const cfg = { get: (key: string) => key === 'OPS_TOTP_REQUIRED' ? '0' : undefined };
  const rbac = new OpsRbacService(db as never, cfg as never);
  const registry = new OperationsRegistry(db as never);
  registry.permissionPort = rbac;
  for (const operation of usersOps()) registry.register(operation);
  let owner: string, manager: string, target: string, ownerRole: string, customRole: string;
  const createdUsers: string[] = [];
  const createdRoles: string[] = [];
  const context = (id: string, permissions: string[] = ['users.roles.assign']): OperationContext => ({
    actor: { id, roles: ['ADMIN'], permissions, type: 'HUMAN' }, surface: 'ops',
    stepUpVerifiedAt: new Date(), reason: 'تغيير أدوار لحساب اختبار محلي معزول',
  });
  beforeAll(async () => { await db.$connect(); });
  beforeEach(async () => {
    const users = await Promise.all(['owner', 'manager', 'target'].map(name => db.user.create({
      data: { email: `role-${name}-${randomUUID()}@local.test`, name, roles: ['ADMIN'] },
    })));
    owner = users[0]!.id; manager = users[1]!.id; target = users[2]!.id;
    createdUsers.push(...users.map(user => user.id));
    ownerRole = (await db.opsRole.findUniqueOrThrow({ where: { key: 'OWNER' } })).id;
    await db.opsRoleGrant.create({ data: { userId: owner, roleId: ownerRole } });
    const role = await db.opsRole.create({ data: { key: `TEST_${randomUUID().slice(0, 12)}`, nameAr: 'دور اختبار مخصص', permissions: ['projects.review'], isSystem: false } });
    customRole = role.key; createdRoles.push(role.id);
  });
  afterEach(async () => {
    await db.opsRoleGrant.deleteMany({ where: { userId: { in: [owner, manager, target] } } });
  });
  afterAll(async () => {
    await db.opsRole.deleteMany({ where: { id: { in: createdRoles } } });
    // Retain users referenced by the append-only operation audit; no real accounts are involved.
    await db.opsSession.deleteMany({ where: { userId: { in: createdUsers } } });
    await db.$disconnect();
  });

  it.each(['REVIEWER', 'FINANCE', 'OWNER'])('manager cannot preview or execute granting %s even with role-assignment permission', async roleKey => {
    const input = { userId: target, roleKey };
    const preview = await registry.dryRun('users.ops-role.grant', input, context(manager));
    expect(preview).toMatchObject({ ok: false, blockers: expect.arrayContaining([expect.objectContaining({ code: 'owner-required' })]) });
    await expect(registry.execute('users.ops-role.grant', input, context(manager))).rejects.toThrow();
    expect(await db.opsRoleGrant.count({ where: { userId: target } })).toBe(0);
  });
  it('wildcard permission without a live OWNER membership cannot administer roles', async () => {
    await expect(registry.execute('users.ops-role.grant', { userId: target, roleKey: customRole }, context(manager, ['*']))).rejects.toThrow();
    expect(await db.opsRoleGrant.count({ where: { userId: target } })).toBe(0);
  });
  it('owner grants a live custom role, manager cannot revoke it, and owner can revoke it', async () => {
    const input = { userId: target, roleKey: customRole };
    await registry.execute('users.ops-role.grant', input, context(owner, ['*']));
    expect((await rbac.permissionsForUser(target)).roleKeys).toContain(customRole);
    await expect(registry.execute('users.ops-role.revoke', input, context(manager))).rejects.toThrow();
    expect((await rbac.permissionsForUser(target)).roleKeys).toContain(customRole);
    await registry.execute('users.ops-role.revoke', input, context(owner, ['*']));
    expect((await rbac.permissionsForUser(target)).roleKeys).not.toContain(customRole);
  });
  it('owner membership removed after preview is rechecked before execution', async () => {
    const input = { userId: target, roleKey: customRole };
    expect((await registry.dryRun('users.ops-role.grant', input, context(owner, ['*']))).ok).toBe(true);
    await db.opsRoleGrant.deleteMany({ where: { userId: owner } });
    await expect(registry.execute('users.ops-role.grant', input, context(owner, ['*']))).rejects.toThrow();
    expect(await db.opsRoleGrant.count({ where: { userId: target } })).toBe(0);
  });
  it('concurrent owners cannot both revoke each other with stale membership', async () => {
    await db.opsRoleGrant.create({ data: { userId: manager, roleId: ownerRole } });
    const results = await Promise.allSettled([
      registry.execute('users.ops-role.revoke', { userId: manager, roleKey: 'OWNER' }, context(owner, ['*'])),
      registry.execute('users.ops-role.revoke', { userId: owner, roleKey: 'OWNER' }, context(manager, ['*'])),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.opsRoleGrant.count({ where: { roleId: ownerRole, userId: { in: [owner, manager] } } })).toBe(1);
  });
  it('catalogue reads persisted role changes and returns no user memberships', async () => {
    await db.opsRole.update({ where: { key: customRole }, data: { permissions: ['procurement.read', 'trust.appeals'] } });
    const catalogue = await rbac.roleCatalogue();
    expect(catalogue.roles.find(role => role.key === customRole)?.permissions).toEqual(['procurement.read', 'trust.appeals']);
    expect(catalogue.permissions).toEqual(expect.arrayContaining(['procurement.read', 'trust.appeals']));
    expect(Object.keys(catalogue.roles[0]!).sort()).toEqual(['key', 'nameAr', 'permissions']);
  });
  it('catalogue HTTP requires the real separate ops session and rejects it after revocation', async () => {
    const auth = new OpsAuthService(db as never, {} as never, cfg as never, rbac, {} as never);
    const module = await Test.createTestingModule({ controllers: [OpsAuthController], providers: [
      { provide: OpsAuthService, useValue: auth }, { provide: OpsRbacService, useValue: rbac },
      { provide: ConfigService, useValue: cfg }, OpsSessionGuard, OpsIpAllowlistGuard,
    ] }).compile();
    const app = module.createNestApplication(); await app.listen(0, '127.0.0.1');
    const token = randomUUID(); const session = await db.opsSession.create({ data: { userId: manager, tokenHash: createHash('sha256').update(token).digest('hex') } });
    try {
      const url = `${await app.getUrl()}/ops/auth/roles`;
      expect((await fetch(url)).status).toBe(401);
      expect((await fetch(url, { headers: { Authorization: `Bearer ${token}` } })).status).toBe(401);
      const response = await fetch(url, { headers: { 'x-ops-token': token } });
      expect(response.status).toBe(200);
      const payload = await response.json() as { roles: Array<{ key: string }> };
      expect(payload.roles).toEqual(expect.arrayContaining([expect.objectContaining({ key: customRole })]));
      await db.opsSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      expect((await fetch(url, { headers: { 'x-ops-token': token } })).status).toBe(401);
    } finally { await app.close(); }
  }, 30000);

  it.each(['source', 'target'])('merge cannot use an owner as %s to bypass role administration', async side => {
    await db.user.update({ where: { id: manager }, data: { roles: ['BACKER'] } });
    const input = side === 'source' ? { sourceUserId: owner, targetUserId: manager } : { sourceUserId: manager, targetUserId: owner };
    const before = await db.user.findUniqueOrThrow({ where: { id: owner } });
    const preview = await registry.dryRun('users.merge', input, context(target));
    expect(preview.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'administrative-identity' })]));
    await expect(registry.execute('users.merge', input, context(target))).rejects.toThrow();
    expect(await db.opsRoleGrant.count({ where: { userId: owner, roleId: ownerRole } })).toBe(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: owner } })).email).toBe(before.email);
    expect(await db.opsRoleGrant.count({ where: { userId: manager } })).toBe(0);
  });

  it.each(['ADMIN', 'OWNER', 'FINANCE'])('erasure cannot disable a protected %s identity even outside the ops controller', async protection => {
    if (protection !== 'ADMIN') {
      await db.user.update({ where: { id: target }, data: { roles: ['BACKER'] } });
      const role = await db.opsRole.findUniqueOrThrow({ where: { key: protection } });
      await db.opsRoleGrant.create({ data: { userId: target, roleId: role.id } });
    }
    const before = await db.user.findUniqueOrThrow({ where: { id: target } });
    const audit = { log: jest.fn() };
    const pdpl = new PdplService(db as never, audit as never);
    expect((await registry.dryRun('users.pdpl.erase', { userId: target }, context(manager))).ok).toBe(false);
    await expect(pdpl.eraseAccount(target)).rejects.toThrow('حسابات إدارة المنصة');
    expect((await db.user.findUniqueOrThrow({ where: { id: target } })).email).toBe(before.email);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('merge transaction rechecks administrative identity after a previously safe preview', async () => {
    await db.user.updateMany({ where: { id: { in: [manager, target] } }, data: { roles: ['BACKER'] } });
    const input = { sourceUserId: manager, targetUserId: target };
    expect((await registry.dryRun('users.merge', input, context(owner, ['*']))).ok).toBe(true);
    await db.opsRoleGrant.create({ data: { userId: target, roleId: ownerRole } });
    const merge = usersOps({ prisma: db } as never).find(op => op.key === 'users.merge')!;
    await expect(merge.execute(db as never, input as never, context(owner, ['*']))).rejects.toThrow('حسابات إدارة المنصة');
    expect(await db.opsRoleGrant.count({ where: { userId: target, roleId: ownerRole } })).toBe(1);
  });

  async function identityTokens(userId: string) {
    const expiresAt = new Date(Date.now() + 3600000);
    return {
      refresh: await db.refreshToken.create({ data: { userId, tokenHash: randomUUID(), expiresAt } }),
      reset: await db.passwordResetToken.create({ data: { userId, tokenHash: randomUUID(), expiresAt } }),
      verify: await db.emailVerifyToken.create({ data: { userId, tokenHash: randomUUID(), expiresAt } }),
      ops: await db.opsSession.create({ data: { userId, tokenHash: randomUUID() } }),
    };
  }
  async function expectRevoked(userId: string, tokens: Awaited<ReturnType<typeof identityTokens>>) {
    expect(await db.refreshToken.findUnique({ where: { id: tokens.refresh.id } })).toMatchObject({ userId, revokedAt: expect.any(Date) });
    expect(await db.passwordResetToken.findUnique({ where: { id: tokens.reset.id } })).toMatchObject({ userId, usedAt: expect.any(Date) });
    expect(await db.emailVerifyToken.findUnique({ where: { id: tokens.verify.id } })).toMatchObject({ userId, usedAt: expect.any(Date) });
    expect(await db.opsSession.findUnique({ where: { id: tokens.ops.id } })).toMatchObject({ userId, revokedAt: expect.any(Date) });
  }
  it('ordinary account merge revokes source credentials without transferring them to the target', async () => {
    await db.user.updateMany({ where: { id: { in: [manager, target] } }, data: { roles: ['BACKER'] } });
    const tokens = await identityTokens(manager);
    const targetTokens = await identityTokens(target);
    const merge = usersOps({ prisma: db } as never).find(op => op.key === 'users.merge')!;
    await merge.execute(db as never, { sourceUserId: manager, targetUserId: target } as never, context(owner, ['*']));
    await expectRevoked(manager, tokens);
    expect(await db.refreshToken.findUnique({ where: { id: targetTokens.refresh.id } })).toMatchObject({ userId: target, revokedAt: null });
    expect(await db.passwordResetToken.findUnique({ where: { id: targetTokens.reset.id } })).toMatchObject({ userId: target, usedAt: null });
  });
  it('ordinary erasure disables old credentials and preserves their original account linkage', async () => {
    await db.user.update({ where: { id: target }, data: { roles: ['BACKER'] } });
    const tokens = await identityTokens(target);
    const pdpl = new PdplService(db as never, { log: jest.fn() } as never);
    await pdpl.eraseAccount(target);
    await expectRevoked(target, tokens);
    expect((await db.user.findUniqueOrThrow({ where: { id: target } })).email).toBe(`erased-${target}@erased.wathba.sa`);
  });
});
