/* eslint-disable @typescript-eslint/no-explicit-any */
import { PayoutStatus } from '@prisma/client';
import { PayoutDisburser, buildPayoutRequest, sequenceNumberFor } from './payout.disburser';



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

function cfg(key = '', sourceId = ''): any {
  return {
    get: jest.fn((k: string) => {
      if (k === 'PAYOUT_PROVIDER_KEY') return key;
      if (k === 'MOYASAR_PAYOUT_SOURCE_ID') return sourceId;
      return undefined;
    }),
  };
}

function beneficiaryMock(dest: unknown = null): any {
  return { resolveDestination: jest.fn().mockResolvedValue(dest) };
}

function mockFetchOk(id: string, status = 'queued'): jest.SpyInstance {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true, status: 201, json: async () => ({ id, status }),
  } as unknown as Response);
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
    // STAKES follow-up — creator + project lookups for the payout-sent comms.
    user: { findUnique: jest.fn().mockResolvedValue({ email: 'creator@test.sa' }) },
    project: { findUnique: jest.fn().mockResolvedValue({ titleAr: 'مشروع' }) },
  };
}

// STAKES follow-up (F2/F4) — stubs for the payout-sent email + notification.
const makeEmail = (): any => ({ payoutSent: jest.fn().mockResolvedValue({ sent: false, stubbed: true }) });
const makeNotif = (): any => ({ create: jest.fn().mockResolvedValue({}) });

describe('PayoutDisburser.disbursePending', () => {
  it('returns 0/0 on an empty queue', async () => {
    const prisma = makePrisma([]);
    const d = new PayoutDisburser(prisma, ledgerMock(), zatcaMock(), heartbeatMock(), beneficiaryMock(null), cfg(), makeEmail(), makeNotif());
    expect(await d.disbursePending()).toEqual({ sent: 0, failed: 0 });
    expect(prisma.payout.update).not.toHaveBeenCalled();
  });

  it('stub mode sends each PENDING payout and journals PAYOUT_SENT', async () => {
    const prisma = makePrisma([payout('a'), payout('b')]);
    const ledger = ledgerMock();
    const email = makeEmail();
    const notif = makeNotif();
    const d = new PayoutDisburser(prisma, ledger, zatcaMock(), heartbeatMock(), beneficiaryMock(null), cfg(), email, notif);
    expect(await d.disbursePending()).toEqual({ sent: 2, failed: 0 });
    // STAKES follow-up — each sent payout emails + notifies the creator.
    expect(email.payoutSent).toHaveBeenCalledTimes(2);
    expect(notif.create).toHaveBeenCalledWith(expect.objectContaining({ kind: 'PAYOUT_SENT' }));
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
    const d = new PayoutDisburser(prisma, ledgerMock(), zatcaMock(), heartbeatMock(), beneficiaryMock(null), cfg(), makeEmail(), makeNotif());
    expect(await d.disbursePending()).toEqual({ sent: 1, failed: 1 });
  });

  it('real mode without MOYASAR_PAYOUT_SOURCE_ID → stays PENDING (never SENT)', async () => {
    const spy = jest.spyOn(globalThis, 'fetch');
    const prisma = makePrisma([payout('z')]);
    // provider key set, but no source account configured
    const d = new PayoutDisburser(prisma, ledgerMock(), zatcaMock(), heartbeatMock(), beneficiaryMock(null), cfg('real-key', ''), makeEmail(), makeNotif());
    expect(await d.disbursePending()).toEqual({ sent: 0, failed: 1 });
    expect(prisma.payout.update).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled(); // fails before the HTTP call
  });

  it('real mode with source + beneficiary → SENT, real Moyasar payout id in ledger, contract body (Sprint 5 / #4 #7)', async () => {
    mockFetchOk('py_live_77', 'queued');
    const prisma = makePrisma([payout('z')]);
    const ledger = ledgerMock();
    const bene = beneficiaryMock({ type: 'bank_account', iban: 'SA0380000000608010167519', name: 'X', mobile: '0555000000', country: 'SA' });
    const d = new PayoutDisburser(prisma, ledger, zatcaMock(), heartbeatMock(), bene, cfg('real-key', 'src_123'), makeEmail(), makeNotif());
    expect(await d.disbursePending()).toEqual({ sent: 1, failed: 0 });
    const [url, init] = (globalThis.fetch as unknown as jest.Mock).mock.calls[0];
    expect(String(url)).toContain('/payouts');
    const body = JSON.parse((init as { body: string }).body);
    expect(body.source_id).toBe('src_123');
    expect(body.destination.iban).toBe('SA0380000000608010167519');
    expect(String(body.sequence_number)).toMatch(/^\d{16}$/);
    expect((init as { headers: Record<string,string> }).headers['idempotency-key']).toBeUndefined();
    expect(ledger.record).toHaveBeenCalledWith(
      expect.objectContaining({ entryType: 'PAYOUT_SENT', pspRef: 'py_live_77' }),
    );
  });

  it('real mode with source but no creator beneficiary → stays PENDING (Sprint 5 / #4)', async () => {
    const spy = jest.spyOn(globalThis, 'fetch');
    const prisma = makePrisma([payout('z')]);
    // source configured, but the platform has no beneficiary for the creator yet
    const d = new PayoutDisburser(prisma, ledgerMock(), zatcaMock(), heartbeatMock(), beneficiaryMock(null), cfg('real-key', 'src_123'), makeEmail(), makeNotif());
    expect(await d.disbursePending()).toEqual({ sent: 0, failed: 1 });
    expect(prisma.payout.update).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled(); // beneficiary guard trips before HTTP
  });
});

describe('buildPayoutRequest — Moyasar POST /payouts contract (Sprint 5 / #4)', () => {
  const req = buildPayoutRequest({
    sourceId: 'src_abc',
    amountHalalas: 54_000n,
    purpose: 'expenses_services',
    payoutId: 'po-123',
    projectId: 'proj-1',
    milestoneId: 'm-1',
    destination: { type: 'bank_account', iban: 'SA0380000000608010167519', name: 'سارة', mobile: '0555000000', country: 'SA', city: 'الرياض' },
  });

  it('matches the documented field names + halalas amount', () => {
    expect(req.source_id).toBe('src_abc');
    expect(req.amount).toBe(54_000); // smallest unit
    expect(req.currency).toBe('SAR');
    expect(req.purpose).toBe('expenses_services');
    expect((req.destination as { iban: string }).iban).toBe('SA0380000000608010167519');
    expect((req.metadata as { payoutId: string }).payoutId).toBe('po-123');
  });

  it('sends a 16-digit sequence_number (no idempotency header exists)', () => {
    expect(String(req.sequence_number)).toMatch(/^\d{16}$/);
    // deterministic: same payout id → same reference (retry-safe reconciliation)
    expect(req.sequence_number).toBe(sequenceNumberFor('po-123'));
    expect(sequenceNumberFor('po-123')).toBe(sequenceNumberFor('po-123'));
    expect(sequenceNumberFor('po-123')).not.toBe(sequenceNumberFor('po-999'));
  });
});
