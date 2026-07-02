/* eslint-disable @typescript-eslint/no-explicit-any */
import { PayoutStatus } from '@prisma/client';
import { PayoutDisburser } from './payout.disburser';

function mockFetchOk(ref: string): jest.SpyInstance {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ id: ref }),
  } as unknown as Response);
}

function mockFetchErr(status = 402): jest.SpyInstance {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ message: 'insufficient provider balance' }),
  } as unknown as Response);
}

afterEach(() => jest.restoreAllMocks());

/**
 * PayoutDisburser — Sprint 1 / P0-301.
 *   - stub mode: PENDING → SENT + sentAt + PAYOUT_SENT ledger row
 *   - a single failure doesn't stop later payouts, failed stays PENDING
 *   - empty queue → 0/0
 */

function payout(id: string): any {
  return {
    id,
    projectId: 'proj-1',
    creatorId: 'creator-1',
    milestoneId: `m-${id}`,
    amountHalalas: BigInt(5_000_000),
    status: PayoutStatus.PENDING,
    zatcaInvoiceId: null,
    sentAt: null,
    createdAt: new Date(),
  };
}

function cfg(key = ''): any {
  return {
    get: jest.fn((k: string) => (k === 'PAYOUT_PROVIDER_KEY' ? key : undefined)),
  };
}

function zatcaMock(): any {
  return { generateForPayout: jest.fn().mockResolvedValue({ invoiceNumber: 'WTB-2026-000001' }) };
}

function heartbeatMock(): any {
  return { beat: jest.fn() };
}

function ledgerMock(): any {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

function makePrisma(pending: any[]): any {
  return {
    payout: {
      findMany: jest.fn().mockResolvedValue(pending),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('PayoutDisburser.disbursePending', () => {
  it('returns 0/0 on an empty queue', async () => {
    const prisma = makePrisma([]);
    const d = new PayoutDisburser(prisma, ledgerMock(), zatcaMock(), heartbeatMock(), cfg());
    expect(await d.disbursePending()).toEqual({ sent: 0, failed: 0 });
    expect(prisma.payout.update).not.toHaveBeenCalled();
  });

  it('stub mode sends each PENDING payout and journals PAYOUT_SENT', async () => {
    const prisma = makePrisma([payout('a'), payout('b')]);
    const ledger = ledgerMock();
    const d = new PayoutDisburser(prisma, ledger, zatcaMock(), heartbeatMock(), cfg());
    expect(await d.disbursePending()).toEqual({ sent: 2, failed: 0 });
    expect(prisma.payout.update).toHaveBeenCalledTimes(2);
    expect(prisma.payout.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PayoutStatus.SENT }),
      }),
    );
    expect(ledger.record).toHaveBeenCalledTimes(2);
    expect(ledger.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entryType: 'PAYOUT_SENT',
        amountHalalas: BigInt(5_000_000),
        source: 'disburser',
      }),
    );
  });

  it('a failing payout stays PENDING and later ones still send', async () => {
    const prisma = makePrisma([payout('x'), payout('y')]);
    // First update throws (provider ok but DB write fails) → failed++,
    // second payout still processed.
    prisma.payout.update = jest
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce({});
    const d = new PayoutDisburser(prisma, ledgerMock(), zatcaMock(), heartbeatMock(), cfg());
    expect(await d.disbursePending()).toEqual({ sent: 1, failed: 1 });
  });

  it('real provider mode: SENT with the provider transfer ref in the ledger (Sprint 5 / #4)', async () => {
    mockFetchOk('trf_live_9x');
    const prisma = makePrisma([payout('z')]);
    const ledger = ledgerMock();
    const d = new PayoutDisburser(prisma, ledger, zatcaMock(), heartbeatMock(), cfg('real-key'));
    expect(await d.disbursePending()).toEqual({ sent: 1, failed: 0 });
    // idempotency key + endpoint were used
    const [url, init] = (globalThis.fetch as unknown as jest.Mock).mock.calls[0];
    expect(String(url)).toContain('/payouts');
    expect((init.headers as Record<string, string>)['idempotency-key']).toBe('payout-z');
    // ledger carries the REAL provider ref, not a stub
    expect(ledger.record).toHaveBeenCalledWith(
      expect.objectContaining({ entryType: 'PAYOUT_SENT', pspRef: 'trf_live_9x' }),
    );
  });

  it('real provider error → payout stays PENDING (never marked SENT unconfirmed)', async () => {
    mockFetchErr(402);
    const prisma = makePrisma([payout('z')]);
    const d = new PayoutDisburser(prisma, ledgerMock(), zatcaMock(), heartbeatMock(), cfg('real-key'));
    expect(await d.disbursePending()).toEqual({ sent: 0, failed: 1 });
    expect(prisma.payout.update).not.toHaveBeenCalled();
  });
});
