import { ReauthScheduler } from './reauth.scheduler';

import type { PrismaService } from '../prisma/prisma.service';
import type { MoyasarAdapter } from '../escrow-payments/moyasar.adapter';
import type { NotificationsService } from '../notifications/notifications.service';
import type { SettingsService } from '../settings/settings.service';

/**
 * OPS-GAPS Y2 — the re-authorization age is governed by the
 * `funding.reauthAfterDays` setting: the daily sweep's cutoff = now − days.
 * Default (~6d) keeps behaviour; a non-default value moves the cutoff.
 */
describe('ReauthScheduler — funding.reauthAfterDays wiring', () => {
  const DAY = 24 * 60 * 60 * 1000;

  function build(reauthDays: number) {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { pledge: { findMany } } as unknown as PrismaService;
    const moyasar = {} as unknown as MoyasarAdapter;
    const notifications = { create: jest.fn() } as unknown as NotificationsService;
    const settings = {
      get: jest.fn(async (key: string) => (key === 'funding.reauthAfterDays' ? reauthDays : undefined)),
    } as unknown as SettingsService;
    const sched = new ReauthScheduler(prisma, moyasar, notifications, settings);
    return { sched, findMany };
  }

  it('uses the default ~6-day cutoff (behaviour preserved)', async () => {
    const now = new Date('2026-07-01T00:00:00.000Z');
    const { sched, findMany } = build(6);
    await sched.run(now);
    const where = findMany.mock.calls[0][0].where as {
      OR: Array<{ reauthorizedAt?: { lte?: Date }; createdAt?: { lte?: Date } }>;
    };
    const cutoff = where.OR[0]!.reauthorizedAt!.lte as Date;
    expect(cutoff.getTime()).toBe(now.getTime() - 6 * DAY);
  });

  it('a non-default value moves the cutoff', async () => {
    const now = new Date('2026-07-01T00:00:00.000Z');
    const { sched, findMany } = build(10);
    await sched.run(now);
    const where = findMany.mock.calls[0][0].where as {
      OR: Array<{ reauthorizedAt?: { lte?: Date }; createdAt?: { lte?: Date } }>;
    };
    const cutoff = where.OR[0]!.reauthorizedAt!.lte as Date;
    expect(cutoff.getTime()).toBe(now.getTime() - 10 * DAY);
  });
});
