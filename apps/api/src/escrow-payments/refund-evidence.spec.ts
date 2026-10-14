import type { Pledge } from '@prisma/client';
import { verifyRefundEvidence } from './refund-evidence';

describe('Refund evidence boundary', () => {
  const pledge = { paymentRef: 'pay-1', amountHalalas: 1200n, addOnsHalalas: 600n } as Pledge;
  const full = { id: 'pay-1', status: 'refunded', amount: 1800, captured: 1800, refunded: 1800, currency: 'SAR' };
  it('returns only allowlisted evidence and includes addons exactly once', () => {
    expect(verifyRefundEvidence({ ...full, source: { token: 'secret', name: 'PII' }, metadata: { email: 'private' } }, pledge))
      .toEqual({ outcome: 'confirmed', providerStatus: 'refunded', paymentRef: 'pay-1', amountHalalas: '1800', refundedHalalas: '1800' });
  });
  it.each(['paid', 'captured'])('recognizes no refund yet for %s', status => {
    expect(verifyRefundEvidence({ ...full, status, refunded: 0 }, pledge).outcome).toBe('pending');
  });
  it.each(['paid', 'captured', 'refunded'])('never finalizes a partial refund (%s)', status => {
    expect(verifyRefundEvidence({ ...full, status, refunded: 500 }, pledge).outcome).toBe('partial');
  });
  it.each([
    { id: 'another-payment' }, { currency: 'USD' }, { amount: 1200 }, { captured: 1200 },
    { captured: undefined }, { refunded: undefined }, { refunded: -1 }, { refunded: 1801 },
    { refunded: 0 }, { refunded: 2.5 }, { refunded: '1800' }, { amount: Number.NaN },
    { amount: Number.MAX_SAFE_INTEGER + 1 }, { captured: Infinity }, { status: 'authorized' },
    { status: 'paid' }, { status: 'captured' },
  ])('rejects inconsistent financial evidence %j', change => {
    expect(() => verifyRefundEvidence({ ...full, ...change }, pledge)).toThrow();
  });
  it.each([null, undefined, {}, [], false, 'refunded'])('rejects missing evidence %j', raw => {
    expect(() => verifyRefundEvidence(raw, pledge)).toThrow();
  });
});
