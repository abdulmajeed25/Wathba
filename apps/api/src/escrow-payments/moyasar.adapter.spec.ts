import { Logger } from '@nestjs/common';
import { MoyasarAdapter } from './moyasar.adapter';

describe('Moyasar payment read contract — mocked network', () => {
  const adapter = (key = 'test-key') => new MoyasarAdapter({ get: () => key } as never);
  afterEach(() => jest.restoreAllMocks());
  it('uses one bounded authenticated GET with encoded reference and no mutation body', async () => {
    const raw = { id: 'pay/one', status: 'refunded', amount: 1800, captured: 1800, refunded: 1800, currency: 'SAR' };
    const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 }));
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    expect(await adapter().fetchPayment('pay/one')).toMatchObject({ status: 'refunded', amountHalalas: 1800, raw });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]![0]).toBe('https://api.moyasar.com/v1/payments/pay%2Fone');
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ method: 'GET', headers: { authorization: `Basic ${Buffer.from('test-key:').toString('base64')}` } });
    expect(fetcher.mock.calls[0]![1]?.body).toBeUndefined(); expect(timeout).toHaveBeenCalledWith(15000);
  });
  it('does not expose a provider error body in errors or logs', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ private: 'secret-card-data' }), { status: 400 }));
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    await expect(adapter().fetchPayment('pay')).rejects.toThrow('moyasar request failed: 400');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-card-data');
  });
  it('missing credentials cannot fabricate refund proof or call the network', async () => {
    const fetcher = jest.spyOn(globalThis, 'fetch');
    expect(await adapter('').fetchPayment('pay')).toEqual({ status: null, amountHalalas: null });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([1800, 500, 0])('refund POST only confirms full matched evidence: %s', async refunded => {
    const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      id: 'pay', status: 'refunded', amount: 1800, captured: 1800, refunded, currency: 'SAR',
    }), { status: 200 }));
    expect(await adapter().refund('pay', 1800n)).toEqual({ ok: refunded === 1800 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('a refund label alone is not proof for the synchronous POST path', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: 'refunded' }), { status: 200 }));
    expect(await adapter().refund('pay', 1800n)).toEqual({ ok: false });
  });
  it.each([true, false])('uncounted void POST requires matched financial evidence: %s', async complete => {
    const response = complete ? { id: 'pay', status: 'voided', amount: 1800, captured: 0, refunded: 0, currency: 'SAR' } : { status: 'voided' };
    const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    expect(await adapter().void('pay', 1800n)).toEqual({ ok: complete }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['paid', 'captured'])('capture accepts documented %s only with full matching evidence', async status => {
    const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      id: 'pay', status, amount: 1800, captured: 1800, refunded: 0, currency: 'SAR',
    }), { status: 200 }));
    expect(await adapter().capture('pay', 1800n)).toEqual({ ok: true }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('capture label alone cannot confirm the held payment', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: 'paid' }), { status: 200 }));
    expect(await adapter().capture('pay', 1800n)).toEqual({ ok: false });
  });
  it('unsupported production renewal performs no HTTP request', async () => {
    const fetcher = jest.spyOn(globalThis, 'fetch');
    expect(() => adapter().assertReauthorizationAvailable()).toThrow('تكاملًا موثقًا');
    await expect(adapter().reauthorize('pay')).rejects.toThrow('تكاملًا موثقًا');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('creates token authorization with manual=true, preassigned id and a bounded single POST', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const raw = { id, status: 'authorized', amount: 1800, currency: 'SAR', captured: 0, refunded: 0 };
    const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 }));
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    expect(await adapter().hold({ givenId: id, amountHalalas: 1800, source: 'test-token', description: 'test', pledgeId: 'p' })).toMatchObject({ paymentRef: id, raw });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string)).toMatchObject({ given_id: id, source: { type: 'token', token: 'test-token', manual: true } });
    expect(timeout).toHaveBeenCalledWith(15000);
  });
  it('local stub preserves the preassigned reference and supplies complete authorization evidence', async () => {
    const fetcher = jest.spyOn(globalThis, 'fetch');
    expect(await adapter('').hold({ givenId: 'test-id', amountHalalas: 1800, source: 'test-token', description: 'test', pledgeId: 'p' })).toMatchObject({
      paymentRef: 'test-id', raw: { id: 'test-id', status: 'authorized', amount: 1800, captured: 0, refunded: 0, currency: 'SAR' },
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

});
