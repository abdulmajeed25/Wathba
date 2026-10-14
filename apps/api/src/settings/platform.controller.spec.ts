import { PlatformController } from './platform.controller';

describe('public pledge policy', () => {
  it('returns only checkout limits and enabled methods, using current settings', async () => {
    const values: Record<string, unknown> = { 'pledges.minHalalas': 3550, 'pledges.maxHalalas': 9000, 'payments.methodsEnabled': { card: false, bnpl: true }, 'support.inboxEmail': 'private@example.test' };
    const get = jest.fn(async (key: string) => values[key]);
    const controller = new PlatformController({ get } as never);
    expect(await controller.pledgePolicy()).toEqual({ minHalalas: 3550, maxHalalas: 9000, methodsEnabled: { card: false, bnpl: true } });
    expect(get.mock.calls.map(([key]) => key)).toEqual(['pledges.minHalalas', 'pledges.maxHalalas', 'payments.methodsEnabled']);
    values['pledges.maxHalalas'] = null;
    expect((await controller.pledgePolicy()).maxHalalas).toBeNull();
  });
  it('does not fabricate permissive defaults when settings are unavailable', async () => {
    const controller = new PlatformController({ get: async () => { throw new Error('database unavailable'); } } as never);
    await expect(controller.pledgePolicy()).rejects.toThrow('database unavailable');
  });
});
