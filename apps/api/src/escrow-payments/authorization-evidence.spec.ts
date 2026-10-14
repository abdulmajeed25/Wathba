import { safeChallengeUrl, verifyAuthorizationEvidence } from './authorization-evidence';

describe('First authorization evidence and payer redirect', () => {
  const p = { paymentRef: 'pay', amountHalalas: 1200n, addOnsHalalas: 600n };
  const raw = { id: 'pay', status: 'authorized', amount: 1800, currency: 'SAR', captured: 0, refunded: 0 };
  it('accepts a matched authorization, not a captured payment', () => {
    expect(verifyAuthorizationEvidence(raw, p)).toEqual({ outcome: 'authorized' });
    expect(() => verifyAuthorizationEvidence({ ...raw, status: 'paid', captured: 1800 }, p)).toThrow();
  });
  it.each([{ id: 'other' }, { amount: 1799 }, { currency: 'USD' }, { captured: 1 }, { refunded: 1 }, { captured: undefined }, { status: 'expired' }])('rejects mismatched proof %#', over => {
    expect(() => verifyAuthorizationEvidence({ ...raw, ...over }, p)).toThrow();
  });
  it.each(['failed', 'voided'])('requires complete zero-charge proof for %s', status => {
    expect(verifyAuthorizationEvidence({ ...raw, status }, p).outcome).toBe('uncharged');
  });
  it('retains initiated as a challenge and only exposes its verified destination', () => {
    const url = 'https://api.moyasar.com/v1/transaction_auths/local-challenge';
    expect(verifyAuthorizationEvidence({ ...raw, status: 'initiated', source: { transaction_url: url } }, p)).toEqual({ outcome: 'challenge', transactionUrl: url });
  });
  it.each(['https://api.moyasar.com.evil.test/v1/transaction_auths/a', 'javascript:alert(1)',
    'http://api.moyasar.com/v1/transaction_auths/a', 'https://user@api.moyasar.com/v1/transaction_auths/a',
    'https://api.moyasar.com:8443/v1/transaction_auths/a', 'https://api.moyasar.com/v1/payments/a',
    'https://api.moyasar.com/v1/transaction_auths/a#other', '//evil.test/a', null])('refuses an unsafe challenge destination %#', url => {
    expect(safeChallengeUrl(url)).toBeUndefined();
    expect(verifyAuthorizationEvidence({ ...raw, status: 'initiated', source: { transaction_url: url } }, p)).toEqual({ outcome: 'challenge', transactionUrl: undefined });
  });
});
