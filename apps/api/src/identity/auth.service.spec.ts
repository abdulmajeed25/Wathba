/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

/**
 * AuthService — Sprint 1 / P1-902.
 *   signUp: bcrypt cost 12, default BACKER role, duplicate email → 409
 *   signIn: wrong password → 401 + failure recorded
 *           5 failures within the window → 6th attempt 429 with retryAfter
 *           success clears the counter
 */

const EMAIL = 'backer@test.wathba.sa';
const PASS = 'Str0ngPass!x';

function makeUsers(user: any = null): any {
  return {
    findByEmail: jest.fn().mockResolvedValue(user),
    findById: jest.fn().mockResolvedValue(user ?? { id: 'u1', email: EMAIL, roles: ['BACKER'] }),
    toPublic: jest.fn().mockReturnValue({ id: 'u1', email: EMAIL }),
    // STAKES/C7 — signUp mints a public handle from the email local-part.
    generateHandle: jest.fn().mockResolvedValue('sara'),
  };
}

function makePrisma(): any {
  return {
    user: {
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'u1', ...data }),
      ),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn(),
    },
    // STAKES/S-12 F-11 — signup issues a verification token.
    emailVerifyToken: {
      create: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

function makeJwt(): any {
  return { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
}

describe('AuthService.signUp', () => {
  it('hashes with bcrypt cost 12 and defaults to BACKER role', async () => {
    const prisma = makePrisma();
    const svc = new AuthService(prisma, makeUsers(null), makeJwt(), { passwordReset: jest.fn().mockResolvedValue({}), verification: jest.fn().mockResolvedValue({}) } as never, { assertHuman: jest.fn().mockResolvedValue(undefined) } as never, { get: jest.fn().mockResolvedValue('2026-06-28') } as never);
    await svc.signUp({ name: 'سارة', email: EMAIL.toUpperCase(), password: PASS });
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.email).toBe(EMAIL); // lower-cased
    expect(data.roles).toEqual(['BACKER']);
    expect(data.passwordHash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, cost 12
    expect(await bcrypt.compare(PASS, data.passwordHash)).toBe(true);
  });

  // Batch OPS (Unit 6) — the consent version stamped on the account is read
  // through SettingsService (governed setting); its default equals the prior
  // env/constant so behaviour is unchanged until an operator publishes a new one.
  it('stamps consentVersion from the identity.consentVersion setting', async () => {
    const prisma = makePrisma();
    const settings = { get: jest.fn().mockResolvedValue('2027-09-01') };
    const svc = new AuthService(
      prisma,
      makeUsers(null),
      makeJwt(),
      { verification: jest.fn().mockResolvedValue({}) } as never,
      { assertHuman: jest.fn().mockResolvedValue(undefined) } as never,
      settings as never,
    );
    await svc.signUp({ name: 'سارة', email: EMAIL, password: PASS });
    expect(settings.get).toHaveBeenCalledWith('identity.consentVersion');
    expect(prisma.user.create.mock.calls[0][0].data.consentVersion).toBe('2027-09-01');
  });

  // STAKES/S-12 F-11 — 2xx-UNIFORM: a duplicate looks exactly like success
  // to the requester; the real owner gets the notice email.
  it('returns the identical {ok:true} for a duplicate email + notifies the owner', async () => {
    const prisma = makePrisma();
    const email = {
      passwordReset: jest.fn().mockResolvedValue({}),
      duplicateSignup: jest.fn().mockResolvedValue({ sent: true, stubbed: true }),
      verification: jest.fn().mockResolvedValue({}),
    };
    const svc = new AuthService(prisma, makeUsers({ id: 'u1' }), makeJwt(), email as never, { assertHuman: jest.fn().mockResolvedValue(undefined) } as never, { get: jest.fn().mockResolvedValue('2026-06-28') } as never);
    await expect(svc.signUp({ name: 'x', email: EMAIL, password: PASS })).resolves.toEqual({ ok: true });
    expect(email.duplicateSignup).toHaveBeenCalledWith(EMAIL);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(email.verification).not.toHaveBeenCalled();
  });

  it('signup email failure never blocks the uniform response', async () => {
    const email = {
      passwordReset: jest.fn(),
      duplicateSignup: jest.fn().mockRejectedValue(new Error('smtp down')),
      verification: jest.fn().mockResolvedValue({}),
    };
    const svc = new AuthService(makePrisma(), makeUsers({ id: 'u1' }), makeJwt(), email as never, { assertHuman: jest.fn().mockResolvedValue(undefined) } as never, { get: jest.fn().mockResolvedValue('2026-06-28') } as never);
    await expect(svc.signUp({ name: 'x', email: EMAIL, password: PASS })).resolves.toEqual({ ok: true });
  });

  it('a new signup is created UNVERIFIED and receives the verification link', async () => {
    const prisma = makePrisma();
    const email = {
      passwordReset: jest.fn(),
      verification: jest.fn().mockResolvedValue({}),
    };
    const svc = new AuthService(prisma, makeUsers(null), makeJwt(), email as never, { assertHuman: jest.fn().mockResolvedValue(undefined) } as never, { get: jest.fn().mockResolvedValue('2026-06-28') } as never);
    await expect(svc.signUp({ name: 'x', email: EMAIL, password: PASS })).resolves.toEqual({ ok: true });
    expect(prisma.user.create.mock.calls[0][0].data.emailVerified).toBe(false);
    expect(prisma.emailVerifyToken.create).toHaveBeenCalled();
    expect(email.verification).toHaveBeenCalledWith(EMAIL, expect.stringContaining('/verify-email?token='));
  });
});

describe('AuthService.signIn — lockout FSM', () => {
  const hashed = bcrypt.hashSync(PASS, 4); // cheap hash for test speed

  function svcWithUser(): AuthService {
    return new AuthService(
      makePrisma(),
      makeUsers({ id: 'u1', email: EMAIL, roles: ['BACKER'], passwordHash: hashed }),
      makeJwt(),
      { passwordReset: jest.fn().mockResolvedValue({}) } as never,
      { assertHuman: jest.fn().mockResolvedValue(undefined) } as never,
      { get: jest.fn().mockResolvedValue('2026-06-28') } as never,
    );
  }

  it('valid credentials return a token', async () => {
    const svc = svcWithUser();
    const out = await svc.signIn(EMAIL, PASS);
    expect(out.accessToken).toBe('signed.jwt.token');
  });

  it('wrong password → 401; 5 failures lock the 6th attempt with 429 + retryAfter', async () => {
    const svc = svcWithUser();
    for (let i = 0; i < 5; i++) {
      await expect(svc.signIn(EMAIL, 'wrong-pass')).rejects.toBeInstanceOf(UnauthorizedException);
    }
    // 6th attempt — even with the CORRECT password — is locked out.
    try {
      await svc.signIn(EMAIL, PASS);
      throw new Error('expected lockout');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const res = (err as HttpException).getResponse() as { statusCode: number; retryAfter: number };
      expect(res.statusCode).toBe(429);
      expect(res.retryAfter).toBeGreaterThan(0);
    }
  });

  it('a successful sign-in clears the failure counter', async () => {
    const svc = svcWithUser();
    for (let i = 0; i < 4; i++) {
      await expect(svc.signIn(EMAIL, 'wrong-pass')).rejects.toBeInstanceOf(UnauthorizedException);
    }
    await expect(svc.signIn(EMAIL, PASS)).resolves.toBeDefined(); // 5th, correct → clears
    // Counter reset: 4 more wrong attempts allowed again without lockout.
    for (let i = 0; i < 4; i++) {
      await expect(svc.signIn(EMAIL, 'wrong-pass')).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it('lockout is per-email — another account is unaffected', async () => {
    const svc = svcWithUser();
    for (let i = 0; i < 5; i++) {
      await expect(svc.signIn(EMAIL, 'wrong-pass')).rejects.toBeInstanceOf(UnauthorizedException);
    }
    await expect(svc.signIn('other@test.wathba.sa', PASS)).resolves.toBeDefined();
  });
});

describe('AuthService.refresh — rotation FSM (Sprint 2 / P1-502)', () => {
  const activeRow = {
    id: 'rt-1',
    userId: 'u1',
    tokenHash: 'h',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 86_400_000),
  };

  function svcWith(row: any): { svc: AuthService; prisma: any } {
    const prisma = makePrisma();
    prisma.refreshToken.findUnique = jest.fn().mockResolvedValue(row);
    const users = makeUsers({ id: 'u1', email: EMAIL, roles: ['BACKER'] });
    const svc = new AuthService(prisma, users, makeJwt(), { passwordReset: jest.fn().mockResolvedValue({}) } as never, { assertHuman: jest.fn().mockResolvedValue(undefined) } as never, { get: jest.fn().mockResolvedValue('2026-06-28') } as never);
    return { svc, prisma };
  }

  it('valid token → new pair + old token revoked with successor link', async () => {
    const { svc, prisma } = svcWith(activeRow);
    const out = await svc.refresh('raw-token-value-that-is-long-enough');
    expect(out.accessToken).toBe('signed.jwt.token');
    expect(out.refreshToken).toEqual(expect.any(String));
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rt-1' },
        data: expect.objectContaining({ revokedAt: expect.any(Date), replacedById: 'rt-1' }),
      }),
    );
  });

  it('replayed (already-revoked) token → 401 and ALL sessions revoked', async () => {
    const { svc, prisma } = svcWith({ ...activeRow, revokedAt: new Date() });
    await expect(svc.refresh('raw-token-value-that-is-long-enough')).rejects.toThrow(/reuse detected/);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', revokedAt: null } }),
    );
  });

  it('expired token → 401', async () => {
    const { svc } = svcWith({ ...activeRow, expiresAt: new Date(Date.now() - 1000) });
    await expect(svc.refresh('raw-token-value-that-is-long-enough')).rejects.toThrow(/expired/);
  });

  it('unknown token → 401', async () => {
    const { svc } = svcWith(null);
    await expect(svc.refresh('raw-token-value-that-is-long-enough')).rejects.toThrow(/invalid refresh/);
  });

  it('signOut revokes exactly the presented token (idempotent)', async () => {
    const { svc, prisma } = svcWith(activeRow);
    const r = await svc.signOut('raw-token-value-that-is-long-enough');
    expect(r.revoked).toBe(true);
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    expect((await svc.signOut('raw-token-value-that-is-long-enough')).revoked).toBe(false);
  });
});
