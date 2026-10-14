import { verifyVoidEvidence } from './uncounted-void';

describe('Uncounted void proof', () => {
  const p = { paymentRef: 'p', amountHalalas: 1200n, addOnsHalalas: 600n };
  const raw = { id: 'p', amount: 1800, currency: 'SAR', status: 'voided', captured: 0, refunded: 0 };
  it('accepts matching void without leaking source or secret', () => {
    expect(verifyVoidEvidence({ ...raw, source: { secret: 'private' } }, p)).toEqual({
      outcome: 'confirmed', providerStatus: 'voided', paymentRef: 'p', amountHalalas: '1800',
    });
  });
  it('authorized remains unresolved even with an old provider date', () => {
    expect(verifyVoidEvidence({ ...raw, status: 'authorized', created_at: '2020-01-01' }, p).outcome).toBe('pending');
  });
  it.each([{ id: 'another' }, { amount: 1200 }, { amount: '1800' }, { currency: 'USD' },
    { captured: 1 }, { refunded: 1 }, { captured: undefined }, { refunded: undefined },
    { status: 'expired' }, { status: 'failed' }, { status: 'refunded' }, { status: 'paid' },
    { amount: Infinity }, { amount: 1.5 }])('rejects unsupported or contradictory evidence %j', change => {
    expect(() => verifyVoidEvidence({ ...raw, ...change }, p)).toThrow();
  });
  it.each([null, {}, undefined])('missing proof cannot confirm %j', raw => {
    expect(() => verifyVoidEvidence(raw, p)).toThrow();
  });
});
