/* eslint-disable @typescript-eslint/no-explicit-any */
import { PayoutStatus } from '@prisma/client';
import { PayoutDisburser, buildPayoutRequest, sequenceNumberFor } from './payout.disburser';



afterEach(() => jest.restoreAllMocks());

/**
 * PayoutDisburser — Sprint 1 / P0-301 + OPS-0 corrections #2/#3.
 *   - stub mode: atomic PENDING→SENDING claim → SENT + net/withheld persisted
 *     + TWO ledger legs (PAYOUT_SENT net, COMMISSION withheld) summing to gross
 *   - a transient failure releases the claim back to PENDING; later ones send
 *   - a provider-terminal rejection writes FAILED + failureReason
 *   - a lost claim race (count=0) never reaches the provider
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
      // First findMany each tick is the stuck-SENDING sweep; the second is
      // the PENDING queue (OPS-0 #3).
      findMany: jest.fn((args: any) =>
        Promise.resolve(args?.where?.status === PayoutStatus.SENDING ? [] : pending),
      ),
      update: jest.fn().mockResolvedValue({}),
      // Atomic claim (PENDING→SENDING) + transient release both land here.
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    // STAKES follow-up — creator + project lookups for the payout-sent comms.
    user: { findUnique: jest.fn().mockResolvedValue({ email: 'creator@test.sa' }) },
    project: {
      findUnique: jest.fn().mockResolvedValue({ titleAr: 'مشروع' }),
      // Batch ACCOUNT — the disburser now stamps Project.settledAt when a
      // payout reaches SENT. Added to the double because the double must
      // mirror the client the code actually calls; without it the suite failed
      // on a missing method and said nothing about the behaviour.
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

// STAKES follow-up (F2/F4) — stubs for the payout-sent email + notification.
const makeEmail = (): any => ({ payoutSent: jest.fn().mockResolvedValue({ sent: false, stubbed: true }) });
const makeNotif = (): any => ({ create: jest.fn().mockResolvedValue({}) });
// MONEY-AUDIT — AuditService stub for the payout SENT/FAILED audit rows.
const makeAudit = (): any => ({ log: jest.fn().mockResolvedValue(undefined) });

describe('PayoutDisburser.disbursePending', () => {
  it('returns 0/0 on an empty queue', async () => {
    const prisma = makePrisma([]);
    const d = new PayoutDisburser(prisma, ledgerMock(), zatcaMock(), heartbeatMock(), beneficiaryMock(null), cfg(), makeEmail(), makeNotif(), makeAudit());
    expect(await d.disbursePending()).toEqual({ sent: 0, failed: 0 });
    expect(prisma.payout.update).not.toHaveBeenCalled();
  });

  it('stub mode: claims atomically, sends the NET, persists withheld/net, journals BOTH legs', async () => {
    const prisma = makePrisma([payout('a'), payout('b')]);
    const ledger = ledgerMock();
    const email = makeEmail();
    const notif = makeNotif();
    const d = new PayoutDisburser(prisma, ledger, zatcaMock(), heartbeatMock(), beneficiaryMock(null), cfg(), email, notif, makeAudit());
    expect(await d.disbursePending()).toEqual({ sent: 2, failed: 0 });
    // OPS-0 #3 — every send starts with the atomic PENDING→SENDING claim.
    expect(prisma.payout.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: PayoutStatus.PENDING }),
        data: expect.objectContaining({ status: PayoutStatus.SENDING }),
      }),
    );
    // STAKES follow-up — each sent payout emails + notifies the creator.
    expect(email.payoutSent).toHaveBeenCalledTimes(2);
    expect(notif.create).toHaveBeenCalledWith(expect.objectContaining({ kind: 'PAYOUT_SENT' }));
    // OPS-0 #2 — gross 5,000,000: commission 250,000 (5%) + VAT 37,500 (15%)
    // = 287,500 withheld → 4,712,500 net. The row persists both.
    expect(prisma.payout.update).toHaveBeenCalledTimes(2);
    expect(prisma.payout.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PayoutStatus.SENT,
          feeWithheldHalalas: 287_500n,
          netHalalas: 4_712_500n,
        }),
      }),
    );
    // Two ledger legs per payout: PAYOUT_SENT (net) + COMMISSION (withheld),
    // summing exactly to the gross release.
    expect(ledger.record).toHaveBeenCalledTimes(4);
    expect(ledger.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entryType: 'PAYOUT_SENT',
        amountHalalas: 4_712_500n,
        source: 'disburser',
      }),
    );
    expect(ledger.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entryType: 'COMMISSION',
        amountHalalas: 287_500n,
        source: 'disburser',
      }),
    );
    expect(4_712_500n + 287_500n).toBe(BigInt(5_000_000));
  });

  it('OPS-0 #3: a lost claim race (updateMany count=0) never reaches the provider', async () => {
    const spy = jest.spyOn(globalThis, 'fetch');
    const prisma = makePrisma([payout('raced')]);
    prisma.payout.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const d = new PayoutDisburser(prisma, ledgerMock(), zatcaMock(), heartbeatMock(), beneficiaryMock(null), cfg(), makeEmail(), makeNotif(), makeAudit());
    expect(await d.disbursePending()).toEqual({ sent: 0, failed: 1 });
    expect(prisma.payout.update).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });

  it('OPS-0 #3: a provider-terminal rejection writes FAILED + failureReason', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 201,
      json: async () => ({ id: 'py_x', status: 'failed', failure_reason: 'invalid IBAN' }),
    } as unknown as Response);
    const prisma = makePrisma([payout('t')]);
    const bene = beneficiaryMock({ type: 'bank_account', iban: 'SA03', name: 'X', mobile: '0555000000' });
    const d = new PayoutDisburser(prisma, ledgerMock(), zatcaMock(), heartbeatMock(), bene, cfg('real-key', 'src_123'), makeEmail(), makeNotif(), makeAudit());
    expect(await d.disbursePending()).toEqual({ sent: 0, failed: 1 });
    expect(prisma.payout.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PayoutStatus.FAILED,
          failureReason: expect.stringContaining('invalid IBAN'),
        }),
      }),
    );
  });

  it('OPS-0 #3: a transient provider error (5xx) releases the claim back to PENDING', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false, status: 503, json: async () => ({ message: 'down' }),
    } as unknown as Response);
    const prisma = makePrisma([payout('t')]);
    const bene = beneficiaryMock({ type: 'bank_account', iban: 'SA03', name: 'X', mobile: '0555000000' });
    const d = new PayoutDisburser(prisma, ledgerMock(), zatcaMock(), heartbeatMock(), bene, cfg('real-key', 'src_123'), makeEmail(), makeNotif(), makeAudit());
    expect(await d.disbursePending()).toEqual({ sent: 0, failed: 1 });
    // never FAILED — released back to PENDING for the next tick
    expect(prisma.payout.update).not.toHaveBeenCalled();
    expect(prisma.payout.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: PayoutStatus.SENDING }),
        data: expect.objectContaining({ status: PayoutStatus.PENDING }),
      }),
    );
  });

  it('a transiently-failing payout returns to PENDING and later ones still send', async () => {
    const prisma = makePrisma([payout('x'), payout('y')]);
    // First update throws (provider ok but DB write fails) → failed++,
    // second payout still processed.
    prisma.payout.update = jest
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce({});
    const d = new PayoutDisburser(prisma, ledgerMock(), zatcaMock(), heartbeatMock(), beneficiaryMock(null), cfg(), makeEmail(), makeNotif(), makeAudit());
    expect(await d.disbursePending()).toEqual({ sent: 1, failed: 1 });
  });

  it('real mode without MOYASAR_PAYOUT_SOURCE_ID → stays PENDING (never SENT)', async () => {
    const spy = jest.spyOn(globalThis, 'fetch');
    const prisma = makePrisma([payout('z')]);
    // provider key set, but no source account configured
    const d = new PayoutDisburser(prisma, ledgerMock(), zatcaMock(), heartbeatMock(), beneficiaryMock(null), cfg('real-key', ''), makeEmail(), makeNotif(), makeAudit());
    expect(await d.disbursePending()).toEqual({ sent: 0, failed: 1 });
    expect(prisma.payout.update).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled(); // fails before the HTTP call
  });

  it('real mode with source + beneficiary → SENT, real Moyasar payout id in ledger, contract body (Sprint 5 / #4 #7)', async () => {
    mockFetchOk('py_live_77', 'queued');
    const prisma = makePrisma([payout('z')]);
    const ledger = ledgerMock();
    const bene = beneficiaryMock({ type: 'bank_account', iban: 'SA0380000000608010167519', name: 'X', mobile: '0555000000', country: 'SA' });
    const d = new PayoutDisburser(prisma, ledger, zatcaMock(), heartbeatMock(), bene, cfg('real-key', 'src_123'), makeEmail(), makeNotif(), makeAudit());
    expect(await d.disbursePending()).toEqual({ sent: 1, failed: 0 });
    const [url, init] = (globalThis.fetch as unknown as jest.Mock).mock.calls[0];
    expect(String(url)).toContain('/payouts');
    const body = JSON.parse((init as { body: string }).body);
    expect(body.source_id).toBe('src_123');
    // OPS-0 #2 — the wire amount is the NET (gross 5,000,000 − 287,500 withheld).
    expect(body.amount).toBe(4_712_500);
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
    const d = new PayoutDisburser(prisma, ledgerMock(), zatcaMock(), heartbeatMock(), beneficiaryMock(null), cfg('real-key', 'src_123'), makeEmail(), makeNotif(), makeAudit());
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
