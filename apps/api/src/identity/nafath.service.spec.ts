/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { NafathService } from './nafath.service';

/**
 * NafathService — Sprint 2 / P0-501 branch coverage:
 *   stub: initiate → confirm verifies · foreign/unknown tx → 404
 *   prod without credentials → 503 (no silent auto-approve in prod)
 *   real mode: COMPLETED → verified · REJECTED → rejected (NOT verified)
 *             · WAITING → pending · EXPIRED → expired
 */

function makePrisma(): any {
  return { user: { update: jest.fn().mockResolvedValue({}) } };
}

function cfg(key = ''): any {
  return {
    get: jest.fn((k: string) => (k === 'NAFATH_API_KEY' ? key : undefined)),
  };
}

function mockFetch(status: string): jest.SpyInstance {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ status, transId: 'tx-real-1', random: '42' }),
  } as unknown as Response);
}

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.NODE_ENV_OVERRIDE;
});

describe('NafathService — stub mode', () => {
  it('initiate → confirm marks the user verified (dev only)', async () => {
    const prisma = makePrisma();
    const svc = new NafathService(prisma, cfg(''));
    const { transactionId } = await svc.initiate('user-1', '1234567890');
    const r = await svc.confirm('user-1', transactionId);
    expect(r.outcome).toBe('verified');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nafathVerified: true }),
      }),
    );
  });

  it("rejects another user's transaction with 404", async () => {
    const svc = new NafathService(makePrisma(), cfg(''));
    const { transactionId } = await svc.initiate('user-1', '1234567890');
    await expect(svc.confirm('user-2', transactionId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to run unconfigured in production (503)', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const svc = new NafathService(makePrisma(), cfg(''));
      await expect(svc.initiate('user-1', '1234567890')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});

describe('NafathService — real mode (mocked Nafath API)', () => {
  it('COMPLETED → verified', async () => {
    mockFetch('COMPLETED');
    const prisma = makePrisma();
    const svc = new NafathService(prisma, cfg('real-key'));
    const r = await svc.confirm('user-1', 'tx-real-1');
    expect(r.outcome).toBe('verified');
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('REJECTED → rejected and user is NOT verified', async () => {
    mockFetch('REJECTED');
    const prisma = makePrisma();
    const svc = new NafathService(prisma, cfg('real-key'));
    const r = await svc.confirm('user-1', 'tx-real-1');
    expect(r.outcome).toBe('rejected');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('WAITING → pending (poll again)', async () => {
    mockFetch('WAITING');
    const svc = new NafathService(makePrisma(), cfg('real-key'));
    expect((await svc.confirm('user-1', 'tx-real-1')).outcome).toBe('pending');
  });

  it('EXPIRED → expired', async () => {
    mockFetch('EXPIRED');
    const svc = new NafathService(makePrisma(), cfg('real-key'));
    expect((await svc.confirm('user-1', 'tx-real-1')).outcome).toBe('expired');
  });
});
