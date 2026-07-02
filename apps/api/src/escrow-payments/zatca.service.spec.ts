/* eslint-disable @typescript-eslint/no-explicit-any */
import { PayoutStatus } from '@prisma/client';
import { ZatcaService, buildTlvQr } from './zatca.service';

/**
 * ZatcaService — Sprint 2 / P0-701.
 *   TLV QR: decodes back to the 5 mandatory tags with exact values
 *   commission math: 5% of tranche, 15% VAT on commission, BigInt floor
 *   idempotency: second call returns the existing invoice, no new row
 *   payout linked via zatcaInvoiceId
 */

function payout(amount: bigint): any {
  return {
    id: 'po-1',
    projectId: 'proj-1',
    creatorId: 'creator-1',
    milestoneId: 'm-1',
    amountHalalas: amount,
    status: PayoutStatus.SENT,
    zatcaInvoiceId: null,
    sentAt: new Date(),
    createdAt: new Date(),
  };
}

function cfg(): any {
  return { get: jest.fn().mockReturnValue(undefined) };
}

function makePrisma(existing: any = null): any {
  return {
    zatcaInvoice: {
      findUnique: jest.fn().mockResolvedValue(existing),
      count: jest.fn().mockResolvedValue(41),
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'inv-row', reportedAt: null, issuedAt: new Date(), ...data }),
      ),
    },
    payout: { update: jest.fn().mockResolvedValue({}) },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'creator-1', name: 'سارة' }) },
  };
}

describe('buildTlvQr', () => {
  it('encodes the 5 mandatory tags, decodable byte-exact', () => {
    const b64 = buildTlvQr({
      sellerName: 'وثبة',
      vatNumber: '399999999900003',
      timestamp: '2026-07-02T12:00:00.000Z',
      totalWithVat: '31.05',
      vatAmount: '4.05',
    });
    const buf = Buffer.from(b64, 'base64');
    const decoded: Record<number, string> = {};
    let i = 0;
    while (i < buf.length) {
      const tag = buf[i]!;
      const len = buf[i + 1]!;
      decoded[tag] = buf.subarray(i + 2, i + 2 + len).toString('utf8');
      i += 2 + len;
    }
    expect(decoded[1]).toBe('وثبة');
    expect(decoded[2]).toBe('399999999900003');
    expect(decoded[3]).toBe('2026-07-02T12:00:00.000Z');
    expect(decoded[4]).toBe('31.05');
    expect(decoded[5]).toBe('4.05');
  });
});

describe('ZatcaService.generateForPayout', () => {
  it('computes 5% commission + 15% VAT in BigInt and links the payout', async () => {
    const prisma = makePrisma();
    const svc = new ZatcaService(prisma, cfg());
    // 54,000 halalas tranche → commission 2,700 → VAT 405 → total 3,105
    const inv = await svc.generateForPayout(payout(54_000n));
    expect(inv.commissionHalalas).toBe(2_700n);
    expect(inv.vatHalalas).toBe(405n);
    expect(inv.totalHalalas).toBe(3_105n);
    expect(inv.invoiceNumber).toMatch(/^WTB-\d{4}-000042$/); // count 41 → seq 42
    expect(prisma.payout.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { zatcaInvoiceId: inv.invoiceNumber },
      }),
    );
  });

  it('is idempotent — an existing invoice short-circuits', async () => {
    const existing = { id: 'inv-old', invoiceNumber: 'WTB-2026-000001' };
    const prisma = makePrisma(existing);
    const svc = new ZatcaService(prisma, cfg());
    const inv = await svc.generateForPayout(payout(54_000n));
    expect(inv).toBe(existing);
    expect(prisma.zatcaInvoice.create).not.toHaveBeenCalled();
    expect(prisma.payout.update).not.toHaveBeenCalled();
  });
});
