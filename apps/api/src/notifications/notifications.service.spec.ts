import { NotificationsService } from './notifications.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmailService } from '../email/email.service';
import type { SettingsService } from '../settings/settings.service';

/**
 * STAKES/S-11 F-05 — publish fan-out: followers get the CREATOR_NEW_PROJECT
 * notification + email, pref-gated on projectUpdates, creator excluded,
 * dedupKey makes re-publish idempotent.
 */
describe('NotificationsService.fanOutProjectPublished', () => {
  const project = {
    titleAr: 'مشروع سِرب',
    slug: 'sirb',
    createdById: 'creator-1',
    createdBy: { name: 'فريق سِرب' },
  };

  function build(overrides: {
    followers?: Array<{ followerId: string }>;
    prefRows?: Array<{ id: string; notificationPrefs: unknown; emailVerified: boolean }>;
    emails?: Array<{ email: string }>;
  }) {
    const createMany = jest.fn().mockResolvedValue({ count: (overrides.followers ?? []).length });
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue(project) },
      creatorFollow: { findMany: jest.fn().mockResolvedValue(overrides.followers ?? []) },
      user: {
        findMany: jest
          .fn()
          // first call: filterAllowed pref lookup; second: email lookup
          .mockResolvedValueOnce(overrides.prefRows ?? [])
          .mockResolvedValueOnce(overrides.emails ?? []),
      },
      notification: { createMany },
    } as unknown as PrismaService;
    const email = { creatorNewProject: jest.fn().mockResolvedValue({ sent: false, stubbed: true }) };
    // OPS-GAPS Y2 — SettingsService stub: no kinds disabled by default.
    const settings = { get: jest.fn().mockResolvedValue([]) };
    const service = new NotificationsService(
      prisma,
      email as unknown as EmailService,
      settings as unknown as SettingsService,
    );
    return { service, prisma, email, createMany, settings };
  }

  it('notifies opted-in followers (not the creator) with kind + dedupKey + email', async () => {
    const { service, email, createMany } = build({
      followers: [{ followerId: 'f-1' }, { followerId: 'f-2' }, { followerId: 'creator-1' }],
      prefRows: [
        { id: 'f-1', notificationPrefs: null, emailVerified: true }, // defaults → ON
        { id: 'f-2', notificationPrefs: { projectUpdates: false }, emailVerified: true }, // opted out
      ],
      emails: [{ email: 'f1@x.sa' }],
    });

    await service.fanOutProjectPublished('p-1');

    const rows = createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1); // f-2 opted out, creator excluded
    expect(rows[0]).toMatchObject({
      userId: 'f-1',
      kind: 'CREATOR_NEW_PROJECT',
      dedupKey: 'new-project:p-1:f-1',
    });
    expect((rows[0]!.payload as Record<string, unknown>).deepLink).toBe('/p/sirb');
    expect((rows[0]!.payload as Record<string, unknown>).creatorName).toBe('فريق سِرب');
    expect(createMany.mock.calls[0][0].skipDuplicates).toBe(true);
    expect(email.creatorNewProject).toHaveBeenCalledWith('f1@x.sa', {
      creatorName: 'فريق سِرب',
      projectTitle: 'مشروع سِرب',
      link: '/p/sirb',
    });
  });

  it('is a no-op with zero followers', async () => {
    const { service, createMany, email } = build({ followers: [] });
    const res = await service.fanOutProjectPublished('p-1');
    expect(res).toEqual({ notified: 0 });
    expect(createMany).not.toHaveBeenCalled();
    expect(email.creatorNewProject).not.toHaveBeenCalled();
  });
});

/**
 * OPS-GAPS Y2 — per-notification-kind enablement in create(): a disabled kind
 * is skipped (returns null) UNLESS it is a locked transactional/account/
 * verification kind, which always delivers.
 */
describe('NotificationsService.create — per-kind enablement', () => {
  function build(disabled: string[]) {
    const create = jest.fn().mockResolvedValue({ id: 'n-1' });
    const prisma = { notification: { create } } as unknown as PrismaService;
    const email = {} as unknown as EmailService;
    const settings = { get: jest.fn().mockResolvedValue(disabled) };
    const service = new NotificationsService(
      prisma,
      email,
      settings as unknown as SettingsService,
    );
    return { service, create, settings };
  }

  it('skips (returns null) a disabled non-locked kind', async () => {
    const { service, create } = build(['RANK_UP']);
    const res = await service.create({
      userId: 'u-1',
      kind: 'RANK_UP' as never,
      payload: {},
    });
    expect(res).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('still delivers a LOCKED kind even if the disabled-list somehow contains it', async () => {
    // The catalog schema forbids saving this, but create() defends anyway.
    const { service, create } = build(['REFUND_COMPLETED']);
    const res = await service.create({
      userId: 'u-1',
      kind: 'REFUND_COMPLETED' as never,
      payload: {},
    });
    expect(res).not.toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('delivers a non-disabled kind normally', async () => {
    const { service, create } = build([]);
    const res = await service.create({
      userId: 'u-1',
      kind: 'RANK_UP' as never,
      payload: {},
    });
    expect(res).not.toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
  });
});
