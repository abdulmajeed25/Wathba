/* eslint-disable @typescript-eslint/no-explicit-any */
import { PayoutDisburser, buildPayoutRequest, sequenceNumberFor } from './payout.disburser';

afterEach(() => jest.restoreAllMocks());
function database(count = 1): any {
  const rows = Array.from({ length: count }, (_, i) => ({ id: `po-${i}`, projectId: 'project', creatorId: 'creator',
    milestoneId: `m-${i}`, amountHalalas: 5_000_000n, status: 'PENDING', providerRef: null }));
  const db: any = { rows, payout: {
    findMany: jest.fn(async ({ where }: any) => rows.filter(p => p.status === where.status).map(p => ({ ...p }))),
    findUniqueOrThrow: jest.fn(async ({ where }: any) => ({ ...rows.find(p => p.id === where.id) })),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const row = rows.find(p => p.id === where.id && p.status === where.status);
      if (!row) return { count: 0 };
      Object.assign(row, data); return { count: 1 };
    }),
  }, project: { updateMany: jest.fn(), findUnique: jest.fn(async () => ({ titleAr: 'مشروع' })) },
    user: { findUnique: jest.fn(async () => ({ email: 'local@test.sa' })) },
    ledgerEntry: { create: jest.fn(async () => ({})) }, $queryRaw: jest.fn() };
  db.project.findUniqueOrThrow = jest.fn(async () => ({ realizedHalalas: 10000000n }));
  db.milestone = { aggregate: jest.fn(async () => ({ _sum: { releasedHalalas: 0n } })) };
  db.payout.aggregate = jest.fn(async () => ({ _sum: { amountHalalas: 0n } }));
  db.pledge = { aggregate: jest.fn(async () => ({ _sum: { refundReservedHalalas: 0n } })) };
  db.$transaction = jest.fn(async (fn: any) => fn(db));
  return db;
}
function worker(db: any, key = 'test-key', source = 'source', destination: any = { type: 'wallet', mobile: '0500000000' }) {
  const notifications = { create: jest.fn() }, email = { payoutSent: jest.fn() };
  const invoice = { generateForPayout: jest.fn(async () => ({ invoiceNumber: 'local' })) };
  const audit = { log: jest.fn() };
  const disburser = new PayoutDisburser(db, {} as any, invoice as any, { beat: jest.fn() } as any,
    { resolveDestination: jest.fn(async () => destination) } as any,
    { get: (k: string) => k === 'PAYOUT_PROVIDER_KEY' ? key : k === 'MOYASAR_PAYOUT_SOURCE_ID' ? source : undefined } as any,
    email as any, notifications as any, audit as any);
  return { disburser, notifications, email, invoice, audit };
}
function provider(status: string, overrides = {}) {
  return jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => ({ ok: true,
    json: async () => ({ ...JSON.parse(String(init?.body)), id: 'provider-ref', status, ...overrides }),
  }) as Response);
}

describe('Payout confirmation and ambiguous outcomes', () => {
  it('returns an empty summary for an empty queue', async () => {
    expect(await worker(database(0)).disburser.disbursePending()).toEqual({ sent: 0, failed: 0, pending: 0 });
  });
  it('stub confirms exactly one net transfer and commission, then notifies and invoices', async () => {
    const db = database(), w = worker(db, '');
    expect(await w.disburser.disbursePending()).toEqual({ sent: 1, failed: 0, pending: 0 });
    const entries = db.ledgerEntry.create.mock.calls.map(([arg]: any) => arg.data);
    expect(entries.map((e: any) => e.entryType)).toEqual(['PAYOUT_SENT', 'COMMISSION']);
    expect(entries[0].amountHalalas + entries[1].amountHalalas).toBe(5_000_000n);
    expect(w.notifications.create).toHaveBeenCalledTimes(1);
    expect(w.email.payoutSent).toHaveBeenCalledTimes(1);
    expect(w.invoice.generateForPayout).toHaveBeenCalledTimes(1);
    await w.disburser.disbursePending();
    expect(db.ledgerEntry.create).toHaveBeenCalledTimes(2);
  });
  it('a lost queue claim never calls the provider', async () => {
    const db = database(), send = provider('paid');
    db.payout.updateMany.mockResolvedValueOnce({ count: 0 });
    await worker(db).disburser.disbursePending();
    expect(send).not.toHaveBeenCalled();
  });
  it.each(['queued', 'initiated', 'returned'])('%s is not sent or automatically resent', async status => {
    const db = database(), send = provider(status), w = worker(db);
    expect(await w.disburser.disbursePending()).toEqual({ sent: 0, failed: 0, pending: 1 });
    expect(db.rows[0]).toMatchObject({ status: 'SENDING', providerRef: 'provider-ref', providerStatus: status });
    await w.disburser.disbursePending();
    expect(send).toHaveBeenCalledTimes(1);
    expect(db.ledgerEntry.create).not.toHaveBeenCalled();
    expect(w.notifications.create).not.toHaveBeenCalled();
    expect(w.invoice.generateForPayout).not.toHaveBeenCalled();
  });
  it.each(['failed', 'canceled'])('verified %s retains its reference and cannot be auto retried', async status => {
    const db = database(), send = provider(status), w = worker(db);
    expect(await w.disburser.disbursePending()).toEqual({ sent: 0, failed: 1, pending: 0 });
    expect(db.rows[0]).toMatchObject({ status: 'FAILED', providerRef: 'provider-ref' });
    await w.disburser.disbursePending();
    expect(send).toHaveBeenCalledTimes(1);
    expect(w.audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'system.payout.failed' }));
    expect(db.ledgerEntry.create).not.toHaveBeenCalled();
  });
  it.each([400, 409, 503])('HTTP %s cannot prove that no money moved', async status => {
    const db = database(), w = worker(db);
    const send = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status } as Response);
    expect(await w.disburser.disbursePending()).toEqual({ sent: 0, failed: 0, pending: 1 });
    expect(db.rows[0].status).toBe('SENDING');
    await w.disburser.disbursePending();
    expect(send).toHaveBeenCalledTimes(1);
    expect(db.ledgerEntry.create).not.toHaveBeenCalled();
  });
  it('a connection timeout remains blocked for reconciliation', async () => {
    const db = database(), w = worker(db);
    const send = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    await w.disburser.disbursePending(); await w.disburser.disbursePending();
    expect(send).toHaveBeenCalledTimes(1);
    expect(db.rows[0]).toMatchObject({ status: 'SENDING', failureReason: 'provider-outcome-needs-reconciliation' });
  });
  it.each([{ amount: 1 }, { currency: 'USD' }, { sequence_number: 'other' }, { source_id: 'other' },
    { id: '' }, { status: '' }])('unmatched evidence %j cannot settle', async evidence => {
    const db = database(), w = worker(db); provider('paid', evidence);
    await w.disburser.disbursePending();
    expect(db.rows[0].status).toBe('SENDING'); expect(db.ledgerEntry.create).not.toHaveBeenCalled();
  });
  it('paid evidence uses Basic auth and bank destination with the frozen net amount', async () => {
    const db = database(), send = provider('paid');
    const w = worker(db, 'test-key', 'source', { type: 'bank_account', iban: 'test-iban', name: 'Test', mobile: '0500000000', city: 'Riyadh', country: 'SA' });
    expect((await w.disburser.disbursePending()).sent).toBe(1);
    const init = send.mock.calls[0]![1]!; const body = JSON.parse(String(init.body));
    expect(new Headers(init.headers).get('authorization')).toBe(`Basic ${Buffer.from('test-key:').toString('base64')}`);
    expect(body.destination.type).toBe('bank');
    expect(BigInt(body.amount)).toBe(db.rows[0].netHalalas);
  });
  it.each(['source', 'beneficiary'])('missing %s is stopped before HTTP and remains eligible after configuration', async missing => {
    const db = database(), send = provider('paid');
    await worker(db, 'test-key', missing === 'source' ? '' : 'source', missing === 'beneficiary' ? null : { type: 'wallet', mobile: '0500000000' }).disburser.disbursePending();
    expect(send).not.toHaveBeenCalled(); expect(db.rows[0].status).toBe('PENDING');
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
