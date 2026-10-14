import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JWT authorization follows the live account', () => {
  const payload = { sub: 'test-user', email: 'test@example.test', roles: ['ADMIN'] as never };
  function strategy(user: unknown) {
    return new JwtStrategy({ get: () => 'local-test-secret-at-least-16' } as never,
      { user: { findUnique: jest.fn().mockResolvedValue(user) } } as never);
  }
  it('revoking ADMIN also revokes an already issued token permission', async () => {
    const result = await strategy({ suspendedAt: null, roles: ['BACKER'] }).validate(payload);
    expect(result.roles).toEqual(['BACKER']);
  });
  it('a removed account cannot continue with its old token', async () => {
    await expect(strategy(null).validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('a suspended account cannot continue with its old token', async () => {
    await expect(strategy({ suspendedAt: new Date(), roles: ['ADMIN'] }).validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
