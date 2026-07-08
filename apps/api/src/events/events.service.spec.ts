/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventsService } from './events.service';

/** STAKES/O1 — whitelist enforcement + never-throw semantics. */
describe('EventsService.track', () => {
  const makePrisma = () => ({ analyticsEvent: { create: jest.fn().mockResolvedValue({}) } });

  it('stores a whitelisted event with no IP/UA fields at all', async () => {
    const prisma = makePrisma();
    const svc = new EventsService(prisma as any);
    await svc.track({ name: 'page_view', anonId: 'a1', path: '/projects', props: { ref: 'x' } });
    const data = prisma.analyticsEvent.create.mock.calls[0][0].data;
    expect(data).toEqual({
      name: 'page_view', anonId: 'a1', userId: null, path: '/projects', props: { ref: 'x' },
    });
    expect(Object.keys(data)).not.toEqual(expect.arrayContaining(['ip', 'userAgent']));
  });

  it('silently DROPS non-whitelisted names (no insert)', async () => {
    const prisma = makePrisma();
    const svc = new EventsService(prisma as any);
    expect(await svc.track({ name: 'evil_probe' })).toEqual({ ok: true });
    expect(prisma.analyticsEvent.create).not.toHaveBeenCalled();
  });

  it('never throws when the insert fails', async () => {
    const prisma = { analyticsEvent: { create: jest.fn().mockRejectedValue(new Error('db down')) } };
    const svc = new EventsService(prisma as any);
    expect(await svc.track({ name: 'signup' })).toEqual({ ok: true });
  });
});
