import { ConflictException } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';

import { ProjectsService } from './projects.service';

/**
 * Batch ACCOUNT / U2 — the cooldown reads a purpose-built clock per outcome.
 *
 * The point of these specs is the thing that went wrong in the first attempt:
 * the cooldown counted from `updatedAt`, which moves on ANY edit, so a creator
 * who fixed a typo on an old project silently restarted their own waiting
 * period. Each clock below is asserted to come from its own column:
 *
 *   SUCCESSFUL -> settledAt   FAILED -> deadline   rejected -> rejectedAt
 *
 * and a NULL clock is asserted to grandfather the row rather than block on a
 * date nobody recorded.
 */

/**
 * NOT `ProjectsService & {...}`: assertMaySubmitAnother is PRIVATE, and
 * intersecting a class type with an object that re-declares a private member
 * collapses the whole intersection to `never` — the suite still ran, but tsc
 * failed with "Property does not exist on type 'never'". A standalone shape
 * plus an explicit unknown-cast says what the test is doing: reaching past the
 * visibility modifier on purpose.
 */
interface Svc {
  assertMaySubmitAnother(creatorId: string, projectId: string): Promise<void>;
}

const NOW = new Date('2026-08-13T12:00:00Z');
const daysAgo = (n: number): Date => new Date(NOW.getTime() - n * 86_400_000);

interface PriorRow {
  id: string;
  status: ProjectStatus;
  settledAt: Date | null;
  rejectedAt: Date | null;
  deadline: Date;
}

function build(prior: PriorRow[] = [], waivedUntil: Date | null = null) {
  const prisma = {
    project: {
      findFirst: jest.fn().mockResolvedValue(null), // no active project blocking
      findMany: jest.fn().mockResolvedValue(prior),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ cooldownWaivedUntil: waivedUntil }) },
  };
  const settings = {
    get: jest.fn().mockResolvedValue({ successful: 30, failed: 14, rejected: 7 }),
  };
  const svc = new ProjectsService(
    prisma as never,
    { log: jest.fn() } as never,
    settings as never,
    {} as never,
  ) as unknown as Svc;
  return { svc, prisma, settings };
}

const row = (o: Partial<PriorRow> = {}): PriorRow => ({
  id: 'p-old',
  status: ProjectStatus.SUCCESSFUL,
  settledAt: null,
  rejectedAt: null,
  deadline: daysAgo(400),
  ...o,
});

describe('cooldown — SUCCESSFUL counts from settledAt', () => {
  beforeAll(() => { jest.useFakeTimers().setSystemTime(NOW); });
  afterAll(() => { jest.useRealTimers(); });

  it('blocks inside the 30-day window, measured from settlement', async () => {
    const { svc } = build([row({ settledAt: daysAgo(10) })]);
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'PROJECT_COOLDOWN_ACTIVE',
        remainingDays: 20,
        previousOutcome: 'SUCCESSFUL',
      }),
    });
  });

  it('allows once settlement is more than 30 days old', async () => {
    const { svc } = build([row({ settledAt: daysAgo(31) })]);
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).resolves.toBeUndefined();
  });

  it('GRANDFATHERS a successful project that was never settled (settledAt NULL)', async () => {
    // The whole grandfathering design: no backfill, so a project that finished
    // before the column existed carries no clock and charges no wait.
    const { svc } = build([row({ settledAt: null, deadline: daysAgo(1) })]);
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).resolves.toBeUndefined();
  });
});

describe('cooldown — FAILED counts from deadline, not settlement', () => {
  beforeAll(() => { jest.useFakeTimers().setSystemTime(NOW); });
  afterAll(() => { jest.useRealTimers(); });

  it('blocks inside the 14-day window', async () => {
    const { svc } = build([row({ status: ProjectStatus.FAILED, deadline: daysAgo(4) })]);
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).rejects.toMatchObject({
      response: expect.objectContaining({ remainingDays: 10, previousOutcome: 'FAILED' }),
    });
  });

  it('allows after 14 days — and does NOT borrow the 30-day successful window', async () => {
    const { svc } = build([row({ status: ProjectStatus.FAILED, deadline: daysAgo(20) })]);
    // 20 days: past FAILED's 14, still inside SUCCESSFUL's 30. Reading the
    // wrong key here is exactly the bug this asserts against.
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).resolves.toBeUndefined();
  });
});

describe('cooldown — rejection counts from rejectedAt', () => {
  beforeAll(() => { jest.useFakeTimers().setSystemTime(NOW); });
  afterAll(() => { jest.useRealTimers(); });

  it('blocks inside the 7-day window even though the row is DRAFT', async () => {
    // Rejection is not a status: the project sits in DRAFT carrying
    // reviewFeedback, so only rejectedAt can date it.
    const { svc } = build([row({ status: ProjectStatus.DRAFT, rejectedAt: daysAgo(2) })]);
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).rejects.toMatchObject({
      response: expect.objectContaining({ remainingDays: 5, previousOutcome: 'REJECTED' }),
    });
  });

  it('allows after 7 days', async () => {
    const { svc } = build([row({ status: ProjectStatus.DRAFT, rejectedAt: daysAgo(8) })]);
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).resolves.toBeUndefined();
  });
});

describe('cooldown — precedence, config and waivers', () => {
  beforeAll(() => { jest.useFakeTimers().setSystemTime(NOW); });
  afterAll(() => { jest.useRealTimers(); });

  it('reports the LONGEST outstanding wait when several apply', async () => {
    const { svc } = build([
      row({ id: 'p-fail', status: ProjectStatus.FAILED, deadline: daysAgo(13) }), // 1 day left
      row({ id: 'p-ok', status: ProjectStatus.SUCCESSFUL, settledAt: daysAgo(5) }), // 25 left
    ]);
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).rejects.toMatchObject({
      response: expect.objectContaining({ remainingDays: 25, previousProjectId: 'p-ok' }),
    });
  });

  it('reads the durations from settings, never from a literal', async () => {
    const { svc, settings } = build([row({ settledAt: daysAgo(1) })]);
    settings.get.mockResolvedValue({ successful: 0, failed: 0, rejected: 0 });
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).resolves.toBeUndefined();
    expect(settings.get).toHaveBeenCalledWith('projects.cooldownDays');
  });

  it('an unexpired ops waiver exempts entirely, before the settings read', async () => {
    const { svc, settings } = build([row({ settledAt: daysAgo(1) })], new Date(NOW.getTime() + 86_400_000));
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).resolves.toBeUndefined();
    // A waiver is an exemption, not a discount on the wait.
    expect(settings.get).not.toHaveBeenCalled();
  });

  it('an EXPIRED waiver does not exempt — it lapses instead of lingering', async () => {
    const { svc } = build([row({ settledAt: daysAgo(1) })], new Date(NOW.getTime() - 86_400_000));
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).rejects.toBeInstanceOf(ConflictException);
  });

  it('the message carries LATIN digits, per the numerals decision', async () => {
    const { svc } = build([row({ settledAt: daysAgo(10) })]);
    await expect(svc.assertMaySubmitAnother('c-1', 'p-new')).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'متاح بعد 20 يوماً' }),
    });
  });

  it('excludes fixtures, so the e2e suite keeps its concurrent campaigns', async () => {
    const { svc, prisma } = build([]);
    await svc.assertMaySubmitAnother('c-1', 'p-new');
    expect(prisma.project.findMany.mock.calls[0]![0].where.isTestFixture).toBe(false);
    expect(prisma.project.findFirst.mock.calls[0]![0].where.isTestFixture).toBe(false);
  });
});
