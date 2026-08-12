import { ConflictException } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';

import { ProjectsService } from './projects.service';

/**
 * Batch ACCOUNT §4.3 + §4.4 — the two rules that decide whether a creator may
 * put another project into review.
 *
 * These assert the API layer, which is the one that has to EXPLAIN itself. The
 * DB trigger from migration 0064 is the backstop and refuses in every path
 * including seeds and ops SQL, but a trigger can only raise — it cannot tell a
 * creator which project is blocking them or when to come back, and a guard
 * nobody can act on is a guard that generates support tickets.
 */

type Svc = ProjectsService & {
  assertMaySubmitAnother(creatorId: string, projectId: string): Promise<void>;
};

const NOW = new Date('2026-08-12T12:00:00Z');

function build(overrides: {
  blocking?: { id: string; titleAr: string; status: ProjectStatus } | null;
  last?: { id: string; status: ProjectStatus; updatedAt: Date } | null;
  waivedUntil?: Date | null;
  cooldown?: { successful: number; failed: number; refunded: number; rejected: number };
} = {}) {
  const findFirst = jest
    .fn()
    // first call = the active-project probe, second = the terminal-project probe
    .mockResolvedValueOnce(overrides.blocking ?? null)
    .mockResolvedValueOnce(overrides.last ?? null);

  const prisma = {
    project: { findFirst },
    user: {
      findUnique: jest.fn().mockResolvedValue({ cooldownWaivedUntil: overrides.waivedUntil ?? null }),
    },
  };
  const settings = {
    get: jest.fn().mockResolvedValue(
      overrides.cooldown ?? { successful: 30, failed: 14, refunded: 14, rejected: 7 },
    ),
  };

  const svc = new ProjectsService(
    prisma as never,
    { log: jest.fn() } as never,
    settings as never,
    {} as never,
  ) as Svc;
  return { svc, prisma, settings };
}

describe('submission gating — ONE-ACTIVE-PROJECT', () => {
  it('allows a creator holding nothing active', async () => {
    const { svc } = build();
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).resolves.toBeUndefined();
  });

  it('refuses with PROJECT_ACTIVE_EXISTS and NAMES the blocking project', async () => {
    const { svc } = build({
      blocking: { id: 'p-live', titleAr: 'مشروع نشط', status: ProjectStatus.LIVE },
    });
    // The id is the point: "you already have an active project" without saying
    // WHICH one leaves the creator hunting through their own dashboard.
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'PROJECT_ACTIVE_EXISTS',
        blockingProjectId: 'p-live',
        blockingProjectStatus: ProjectStatus.LIVE,
      }),
    });
  });

  it('excludes the project being submitted — it must not block itself', async () => {
    const { svc, prisma } = build();
    await svc.assertMaySubmitAnother('c-1', 'p-self');
    expect(prisma.project.findFirst.mock.calls[0]![0].where.id).toEqual({ not: 'p-self' });
  });

  it('ignores fixture projects, so the e2e suite keeps its concurrent campaigns', async () => {
    const { svc, prisma } = build();
    await svc.assertMaySubmitAnother('c-1', 'p-new');
    expect(prisma.project.findFirst.mock.calls[0]![0].where.isTestFixture).toBe(false);
  });
});

describe('submission gating — COOLDOWN', () => {
  beforeAll(() => { jest.useFakeTimers().setSystemTime(NOW); });
  afterAll(() => { jest.useRealTimers(); });

  it('refuses inside the window and says how many days are left, in Arabic', async () => {
    const { svc } = build({
      // Successful → 30 days. Ended 10 days ago, so 20 remain.
      last: { id: 'p-old', status: ProjectStatus.SUCCESSFUL, updatedAt: new Date(NOW.getTime() - 10 * 86_400_000) },
    });
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PROJECT_COOLDOWN_ACTIVE', remainingDays: 20 }),
    });
  });

  it('allows once the window has elapsed', async () => {
    const { svc } = build({
      last: { id: 'p-old', status: ProjectStatus.SUCCESSFUL, updatedAt: new Date(NOW.getTime() - 31 * 86_400_000) },
    });
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).resolves.toBeUndefined();
  });

  it('uses the FAILED window (14) for a failed project, not the successful one (30)', async () => {
    const { svc } = build({
      last: { id: 'p-old', status: ProjectStatus.FAILED, updatedAt: new Date(NOW.getTime() - 20 * 86_400_000) },
    });
    // 20 days elapsed: past 14, still inside 30. Reading the wrong key here is
    // exactly the bug this asserts against.
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).resolves.toBeUndefined();
  });

  it('reads the durations from settings, never from a literal', async () => {
    const { svc, settings } = build({
      last: { id: 'p-old', status: ProjectStatus.SUCCESSFUL, updatedAt: new Date(NOW.getTime() - 10 * 86_400_000) },
      cooldown: { successful: 0, failed: 0, refunded: 0, rejected: 0 },
    });
    // Ops set every window to zero → no wait, even 10 days after a success.
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).resolves.toBeUndefined();
    expect(settings.get).toHaveBeenCalledWith('projects.cooldownDays');
  });

  it('an unexpired ops waiver skips the wait entirely', async () => {
    const { svc, settings } = build({
      last: { id: 'p-old', status: ProjectStatus.SUCCESSFUL, updatedAt: new Date(NOW.getTime() - 1 * 86_400_000) },
      waivedUntil: new Date(NOW.getTime() + 86_400_000),
    });
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).resolves.toBeUndefined();
    // Short-circuits before the settings read — the waiver is not a discount on
    // the wait, it is an exemption from it.
    expect(settings.get).not.toHaveBeenCalled();
  });

  it('an EXPIRED waiver does not exempt — it lapses instead of lingering', async () => {
    const { svc } = build({
      last: { id: 'p-old', status: ProjectStatus.SUCCESSFUL, updatedAt: new Date(NOW.getTime() - 1 * 86_400_000) },
      waivedUntil: new Date(NOW.getTime() - 86_400_000),
    });
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).rejects.toBeInstanceOf(ConflictException);
  });
});
