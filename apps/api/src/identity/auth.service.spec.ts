/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConflictException, HttpException, UnauthorizedException } from '@nestjs/common';
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
  };
}

function makePrisma(): any {
  return {
    user: {
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'u1', ...data }),
      ),
    },
  };
}

function makeJwt(): any {
  return { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
}

describe('AuthService.signUp', () => {
  it('hashes with bcrypt cost 12 and defaults to BACKER role', async () => {
    const prisma = makePrisma();
    const svc = new AuthService(prisma, makeUsers(null), makeJwt());
    await svc.signUp({ name: 'سارة', email: EMAIL.toUpperCase(), password: PASS });
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.email).toBe(EMAIL); // lower-cased
    expect(data.roles).toEqual(['BACKER']);
    expect(data.passwordHash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, cost 12
    expect(await bcrypt.compare(PASS, data.passwordHash)).toBe(true);
  });

  it('rejects an already-registered email with 409', async () => {
    const svc = new AuthService(makePrisma(), makeUsers({ id: 'u1' }), makeJwt());
    await expect(svc.signUp({ name: 'x', email: EMAIL, password: PASS })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('AuthService.signIn — lockout FSM', () => {
  const hashed = bcrypt.hashSync(PASS, 4); // cheap hash for test speed

  function svcWithUser(): AuthService {
    return new AuthService(
      makePrisma(),
      makeUsers({ id: 'u1', email: EMAIL, roles: ['BACKER'], passwordHash: hashed }),
      makeJwt(),
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
