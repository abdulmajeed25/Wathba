import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';

import { OpsAuthService, OPS_ABSOLUTE_MS, OPS_IDLE_MS } from './ops-auth.service';
import { ipAllowed, normalizeIp } from './ops-session.guard';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuditService } from '../identity/audit.service';
import type { ConfigService } from '@nestjs/config';

/**
 * OPS Part 1 — the hardened-session tests ARE the deliverable:
 *  · enter demands the password again (public JWT alone is never enough)
 *  · opaque token: only the SHA-256 is stored; 60-min idle + 8-hr absolute
 *  · role revoked mid-session → the ops session dies on next resolve
 *  · step-up stamps a 10-minute window; bad attempts = anomaly audit rows
 *  · TOTP lifecycle: setup → confirm (backup codes ONCE) → enforced on enter;
 *    backup codes are single-use; disable refused while OPS_TOTP_REQUIRED=1
 *  · IP allowlist matching (exact, CIDR, IPv6-mapped normalization)
 */

const PASSWORD = 'correct-horse';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const ADMIN_ID = '00000000-0000-4000-8000-000000000001';

interface SessionRow {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  lastSeenAt: Date;
  stepUpAt: Date | null;
  revokedAt: Date | null;
  ip: string | null;
}

function build(env: Record<string, string> = {}) {
  const users: Record<string, { passwordHash: string; email: string; roles: string[] }> = {
    [ADMIN_ID]: { passwordHash: HASH, email: 'ops@wathba.sa', roles: ['ADMIN', 'BACKER'] },
  };
  const sessions: SessionRow[] = [];
  const creds = new Map<string, {
    userId: string; totpSecretEnc: string | null; totpEnabledAt: Date | null; backupCodeHashes: string[];
  }>();

  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => users[where.id] ?? null),
    },
    opsSession: {
      create: jest.fn(async ({ data }: { data: Partial<SessionRow> }) => {
        const row: SessionRow = {
          id: `sess-${sessions.length + 1}`,
          createdAt: new Date(),
          lastSeenAt: new Date(),
          revokedAt: null,
          userId: data.userId!,
          tokenHash: data.tokenHash!,
          stepUpAt: data.stepUpAt ?? null,
          ip: data.ip ?? null,
        };
        sessions.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: { where: { tokenHash: string } }) =>
        sessions.find((s) => s.tokenHash === where.tokenHash) ?? null),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<SessionRow> }) => {
        const row = sessions.find((s) => s.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
    opsCredential: {
      findUnique: jest.fn(async ({ where }: { where: { userId: string } }) =>
        creds.get(where.userId) ?? null),
      upsert: jest.fn(async ({ where, create, update }: {
        where: { userId: string };
        create: { userId: string; totpSecretEnc?: string | null };
        update: { totpSecretEnc?: string | null };
      }) => {
        const existing = creds.get(where.userId);
        if (existing) { Object.assign(existing, update); return existing; }
        const row = {
          totpEnabledAt: null,
          backupCodeHashes: [] as string[],
          userId: where.userId,
          totpSecretEnc: create.totpSecretEnc ?? null,
        };
        creds.set(where.userId, row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: {
        where: { userId: string };
        data: Partial<{ totpSecretEnc: string | null; totpEnabledAt: Date | null; backupCodeHashes: string[] }>;
      }) => {
        const row = creds.get(where.userId)!;
        Object.assign(row, data);
        return row;
      }),
    },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const cfg = { get: jest.fn((k: string) => env[k]) };
  const svc = new OpsAuthService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    cfg as unknown as ConfigService,
  );
  return { svc, prisma, audit, sessions, users, env };
}

const enterInput = (extra: Partial<{ password: string; totp: string }> = {}) => ({
  userId: ADMIN_ID,
  email: 'ops@wathba.sa',
  roles: ['ADMIN', 'BACKER'],
  password: PASSWORD,
  ip: '10.0.0.9',
  ...extra,
});

describe('OpsAuthService — enter (دخول إلى مركز العمليات)', () => {
  it('refuses a wrong password with 401 and writes an anomaly audit row', async () => {
    const { svc, audit } = build();
    await expect(svc.enter(enterInput({ password: 'nope' }))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ops.auth.enter.failed', actorId: ADMIN_ID }),
    );
  });

  it('creates a separate session: opaque token, only the hash stored, step-up stamped', async () => {
    const { svc, sessions } = build();
    const out = await svc.enter(enterInput());
    expect(out.totpPending).toBe(false);
    expect(out.token).toHaveLength(96);
    expect(sessions[0]!.tokenHash).not.toContain(out.token);
    expect(sessions[0]!.stepUpAt).toBeInstanceOf(Date);
    const p = await svc.resolve(out.token);
    expect(p.userId).toBe(ADMIN_ID);
    expect(p.roles).toContain('ADMIN');
  });

  it('OPS_TOTP_REQUIRED=1 without enrollment → entry allowed but stepUpAt=NULL (enroll-only session)', async () => {
    const { svc, sessions } = build({ OPS_TOTP_REQUIRED: '1' });
    const out = await svc.enter(enterInput());
    expect(out.totpPending).toBe(true);
    expect(sessions[0]!.stepUpAt).toBeNull();
  });
});

describe('OpsAuthService — session lifetime', () => {
  it('rejects an unknown token', async () => {
    const { svc } = build();
    await expect(svc.resolve('deadbeef')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('expires after 60 minutes idle', async () => {
    const { svc, sessions } = build();
    const { token } = await svc.enter(enterInput());
    sessions[0]!.lastSeenAt = new Date(Date.now() - OPS_IDLE_MS - 1_000);
    await expect(svc.resolve(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('expires after the 8-hour absolute cap even when active', async () => {
    const { svc, sessions } = build();
    const { token } = await svc.enter(enterInput());
    sessions[0]!.createdAt = new Date(Date.now() - OPS_ABSOLUTE_MS - 1_000);
    sessions[0]!.lastSeenAt = new Date();
    await expect(svc.resolve(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('slides the idle window on activity (throttled write)', async () => {
    const { svc, sessions } = build();
    const { token } = await svc.enter(enterInput());
    sessions[0]!.lastSeenAt = new Date(Date.now() - 5 * 60_000);
    await svc.resolve(token);
    expect(Date.now() - sessions[0]!.lastSeenAt.getTime()).toBeLessThan(2_000);
  });

  it('kills the session instantly when the ADMIN role is revoked mid-session', async () => {
    const { svc, users, sessions } = build();
    const { token } = await svc.enter(enterInput());
    users[ADMIN_ID]!.roles = ['BACKER'];
    await expect(svc.resolve(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions[0]!.revokedAt).toBeInstanceOf(Date);
  });

  it('leave() revokes; the token is dead afterwards', async () => {
    const { svc } = build();
    const { token } = await svc.enter(enterInput());
    const p = await svc.resolve(token);
    await svc.leave(p);
    await expect(svc.resolve(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('OpsAuthService — step-up', () => {
  it('re-stamps stepUpAt on a fresh password', async () => {
    const { svc, sessions } = build();
    const { token } = await svc.enter(enterInput());
    sessions[0]!.stepUpAt = new Date(Date.now() - 60 * 60_000);
    const p = await svc.resolve(token);
    const at = await svc.stepUp(p, PASSWORD);
    expect(Date.now() - at.getTime()).toBeLessThan(2_000);
    expect(sessions[0]!.stepUpAt).toBe(at);
  });

  it('refuses a bad password with an anomaly audit row', async () => {
    const { svc, audit } = build();
    const { token } = await svc.enter(enterInput());
    const p = await svc.resolve(token);
    await expect(svc.stepUp(p, 'nope')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ops.auth.stepup.failed' }),
    );
  });

  it('stepUpFromToken: absent → null, dead → null, live → the session stepUpAt', async () => {
    const { svc } = build();
    expect(await svc.stepUpFromToken(undefined)).toBeNull();
    expect(await svc.stepUpFromToken('garbage')).toBeNull();
    const { token } = await svc.enter(enterInput());
    expect(await svc.stepUpFromToken(token)).toBeInstanceOf(Date);
  });
});

describe('OpsAuthService — TOTP lifecycle', () => {
  async function enroll(svc: OpsAuthService) {
    const { token } = await svc.enter(enterInput());
    let p = await svc.resolve(token);
    const { secret, otpauth } = await svc.totpSetup(p, PASSWORD);
    expect(otpauth).toContain('otpauth://totp/');
    const { backupCodes } = await svc.totpConfirm(p, authenticator.generate(secret));
    p = await svc.resolve(token);
    return { token, p, secret, backupCodes };
  }

  it('setup → confirm enables TOTP and returns exactly 10 backup codes ONCE', async () => {
    const { svc } = build();
    const { p, backupCodes } = await enroll(svc);
    expect(backupCodes).toHaveLength(10);
    expect(p.totpEnabled).toBe(true);
  });

  it('confirm with a wrong code refuses and audits', async () => {
    const { svc, audit } = build();
    const { token } = await svc.enter(enterInput());
    const p = await svc.resolve(token);
    await svc.totpSetup(p, PASSWORD);
    await expect(svc.totpConfirm(p, '000000')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ops.auth.totp-confirm.failed' }),
    );
  });

  it('once enrolled, enter DEMANDS the second factor', async () => {
    const { svc } = build();
    const { secret } = await enroll(svc);
    await expect(svc.enter(enterInput())).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(svc.enter(enterInput({ totp: '000000' }))).rejects.toBeInstanceOf(UnauthorizedException);
    const ok = await svc.enter(enterInput({ totp: authenticator.generate(secret) }));
    expect(ok.totpPending).toBe(false);
  });

  it('backup codes are single-use', async () => {
    const { svc } = build();
    const { backupCodes } = await enroll(svc);
    const code = backupCodes[0]!;
    await svc.enter(enterInput({ totp: code }));
    await expect(svc.enter(enterInput({ totp: code }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('disable is refused while OPS_TOTP_REQUIRED=1, allowed when the flag is off', async () => {
    const flagged = build({ OPS_TOTP_REQUIRED: '1' });
    const a = await enroll(flagged.svc);
    await expect(
      flagged.svc.totpDisable(a.p, PASSWORD, authenticator.generate(a.secret)),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const open = build();
    const b = await enroll(open.svc);
    await open.svc.totpDisable(b.p, PASSWORD, authenticator.generate(b.secret));
    const after = await open.svc.resolve(b.token);
    expect(after.totpEnabled).toBe(false);
  });

  it('re-setup while enabled is refused (disable first, audited)', async () => {
    const { svc } = build();
    const { p } = await enroll(svc);
    await expect(svc.totpSetup(p, PASSWORD)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('Ops IP allowlist matching', () => {
  it('normalizes IPv4-mapped IPv6 and matches exact + CIDR entries', () => {
    expect(normalizeIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
    const list = '203.0.113.7, 198.51.100.0/24, 2001:db8::1';
    expect(ipAllowed('203.0.113.7', list)).toBe(true);
    expect(ipAllowed('198.51.100.200', list)).toBe(true);
    expect(ipAllowed('198.51.101.1', list)).toBe(false);
    expect(ipAllowed('2001:db8::1', list)).toBe(true);
    expect(ipAllowed('8.8.8.8', list)).toBe(false);
  });
});
