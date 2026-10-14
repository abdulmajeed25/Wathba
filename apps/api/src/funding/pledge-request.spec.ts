import { validate } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { CreatePledgeDto } from './dto/pledge.dto';
import { pledgeRequestHash } from './pledge-request';

describe('Pledge request identity', () => {
  const base = { projectId: randomUUID(), amountHalalas: 2000, source: 'token' };
  it('requires a valid key at the HTTP validation boundary', async () => {
    for (const requestKey of [undefined, null, '', 'invalid']) {
      const errors = await validate(Object.assign(new CreatePledgeDto(), base, { requestKey }));
      expect(errors.some(e => e.property === 'requestKey')).toBe(true);
    }
    expect(await validate(Object.assign(new CreatePledgeDto(), base, { requestKey: randomUUID() }))).toHaveLength(0);
  });
  it('normalizes ordering and defaults while ignoring transient tokens', () => {
    const a = { ...base, addOns: [{ addOnId: 'b' }, { addOnId: 'a', qty: 2 }] };
    expect(pledgeRequestHash(a)).toBe(pledgeRequestHash({ ...a, source: 'new-token', captchaToken: 'new',
      paymentMethod: 'CARD', addOns: [{ addOnId: 'a', qty: 2 }, { addOnId: 'b', qty: 1 }] }));
  });
  it('binds the request to quantities, shipping and contract choice', () => {
    for (const change of [{ addOns: [{ addOnId: 'a', qty: 2 }] }, { contractType: 'DONATION' as const },
      { shipping: { name: 'سارة', address: 'عنوان اختبار', city: 'الرياض', country: 'SA', postal: '12345' } }]) {
      expect(pledgeRequestHash({ ...base, ...change })).not.toBe(pledgeRequestHash(base));
    }
  });
});
