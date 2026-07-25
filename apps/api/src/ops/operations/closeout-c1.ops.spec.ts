import { OperationsRegistry } from '../operations.registry';
import { moderationOps } from './moderation.ops';
import { projectsOps } from './projects.ops';
import type { OperationContext } from '../operation.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { EmailService } from '../../email/email.service';
import type { SettingsService } from '../../settings/settings.service';

/**
 * Batch CLOSEOUT C1 — the two Unit-5 wiring gaps the census left open:
 *
 *  1. moderation.comment.moderate 'dismiss' must RESOLVE comment reports
 *     (resolvedAt) rather than hard-DELETE them, so moderation throughput is
 *     computable (census A4). Deleting was the reason the analytics surface
 *     had to return an honest `commentReportsResolved: null`.
 *  2. projects.review.approve must read the duration limits from SETTINGS
 *     (projects.durationSelfServeMaxDays / durationHardMaxDays) instead of the
 *     hardcoded 60 / 120 — the census flagged the self-serve key as
 *     catalog-only, i.e. tunable in the UI but ignored by the reviewer.
 */

type Mock = jest.Mock;
function model() {
  return {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
  };
}

function buildPrisma() {
  const prisma = {
    comment: model(),
    commentReport: model(),
    projectReport: model(),
    project: model(),
    user: model(),
    auditLog: model(),
    operationExecution: model(),
    operationProposal: model(),
    $transaction: jest.fn() as Mock,
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

const notifications = { create: jest.fn().mockResolvedValue(null) };
const email = {
  projectReviewed: jest.fn().mockResolvedValue(undefined),
  commentModerated: jest.fn().mockResolvedValue(undefined),
};

/** A settings stub whose values the test controls per-case. */
function settingsStub(values: Record<string, unknown>): SettingsService {
  return {
    get: jest.fn((key: string) => Promise.resolve(values[key])),
  } as unknown as SettingsService;
}

const ACTOR: OperationContext['actor'] = { id: 'admin-1', type: 'HUMAN', roles: ['ADMIN'] };
const ctx = (over: Partial<OperationContext> = {}): OperationContext => ({
  actor: ACTOR,
  stepUpVerifiedAt: new Date(),
  reason: 'مراجعة إدارية موثقة في السجل',
  ...over,
});

const COMMENT_ID = '55555555-5555-4555-8555-555555555555';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  notifications.create.mockClear();
  email.projectReviewed.mockClear();
});

/* ── C1.1 — comment-report dismissal keeps history ──────────────────────── */
describe('moderation.comment.moderate (dismiss) — resolves, never deletes', () => {
  function reg(prisma: ReturnType<typeof buildPrisma>): OperationsRegistry {
    const r = new OperationsRegistry(prisma as unknown as PrismaService);
    r.permissionPort = { has: () => true };
    for (const op of moderationOps({
      prisma: prisma as unknown as PrismaService,
      notifications: notifications as unknown as NotificationsService,
      email: email as unknown as EmailService,
    }))
      r.register(op);
    return r;
  }

  it('marks open reports resolved (resolvedAt set) and does NOT delete them', async () => {
    const prisma = buildPrisma();
    prisma.comment.findUnique.mockResolvedValue({ id: COMMENT_ID, hidden: false, reportCount: 3, bodyAr: 'نص' });
    prisma.commentReport.updateMany.mockResolvedValue({ count: 3 });

    await reg(prisma).execute(
      'moderation.comment.moderate',
      { commentId: COMMENT_ID, action: 'dismiss' },
      ctx(),
    );

    // The append-only-history invariant: no destructive call on the reports.
    expect(prisma.commentReport.deleteMany).not.toHaveBeenCalled();
    expect(prisma.commentReport.updateMany).toHaveBeenCalledWith({
      where: { commentId: COMMENT_ID, resolvedAt: null },
      data: { resolvedAt: expect.any(Date) },
    });
    // The denormalised badge still clears so the queue empties.
    expect(prisma.comment.update).toHaveBeenCalledWith({
      where: { id: COMMENT_ID },
      data: { reportCount: 0 },
    });
  });

  it('re-dismissal only touches STILL-OPEN reports (resolvedAt: null guard)', async () => {
    const prisma = buildPrisma();
    prisma.comment.findUnique.mockResolvedValue({ id: COMMENT_ID, hidden: false, reportCount: 0, bodyAr: 'نص' });
    prisma.commentReport.updateMany.mockResolvedValue({ count: 0 });

    await reg(prisma).execute(
      'moderation.comment.moderate',
      { commentId: COMMENT_ID, action: 'dismiss' },
      ctx(),
    );

    const arg = prisma.commentReport.updateMany.mock.calls[0][0] as {
      where: { resolvedAt: null };
    };
    // Already-resolved rows keep their ORIGINAL resolvedAt — throughput stats
    // must not be re-stamped by a second dismissal.
    expect(arg.where.resolvedAt).toBeNull();
  });
});

/* ── C1.2 — review duration limits come from settings ───────────────────── */
describe('projects.review.approve — duration limits are settings-driven', () => {
  function reg(
    prisma: ReturnType<typeof buildPrisma>,
    settings: SettingsService,
  ): OperationsRegistry {
    const r = new OperationsRegistry(prisma as unknown as PrismaService);
    r.permissionPort = { has: () => true };
    for (const op of projectsOps({
      prisma: prisma as unknown as PrismaService,
      notifications: notifications as unknown as NotificationsService,
      email: email as unknown as EmailService,
      settings,
    }))
      r.register(op);
    return r;
  }

  const underReview = (durationDays: number, approvedDurationDays: number | null = null) => ({
    id: PROJECT_ID,
    titleAr: 'حملة',
    status: 'UNDER_REVIEW',
    durationDays,
    approvedDurationDays,
    reviewFeedback: null,
    scheduledLaunchAt: null,
    creatorId: 'creator-1',
  });

  it('refuses a duration over the CONFIGURED hard max (setting, not the old 120)', async () => {
    const prisma = buildPrisma();
    // 100 days would have PASSED the hardcoded 120 limit; the tightened
    // setting must now refuse it — proving the value is actually read.
    prisma.project.findUnique.mockResolvedValue(underReview(100));
    const settings = settingsStub({
      'projects.durationHardMaxDays': 90,
      'projects.durationSelfServeMaxDays': 60,
    });

    await expect(
      reg(prisma, settings).execute('projects.review.approve', { projectId: PROJECT_ID }, ctx()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'long-duration-blocked' }),
    });
  });

  it('requires an explicit grant past the CONFIGURED self-serve max', async () => {
    const prisma = buildPrisma();
    // 40 days is under the default 60 — but over a self-serve max of 30.
    prisma.project.findUnique.mockResolvedValue(underReview(40));
    const settings = settingsStub({
      'projects.durationHardMaxDays': 120,
      'projects.durationSelfServeMaxDays': 30,
    });

    await expect(
      reg(prisma, settings).execute('projects.review.approve', { projectId: PROJECT_ID }, ctx()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'duration-grant-required' }),
    });
  });

  it('approves within the configured self-serve window without a grant', async () => {
    const prisma = buildPrisma();
    const p = underReview(45);
    prisma.project.findUnique.mockResolvedValue(p);
    prisma.project.findUniqueOrThrow.mockResolvedValue(p);
    prisma.project.update.mockResolvedValue({ ...p, status: 'LIVE' });
    // A RAISED self-serve max (90) admits a 45-day campaign with no grant.
    const settings = settingsStub({
      'projects.durationHardMaxDays': 120,
      'projects.durationSelfServeMaxDays': 90,
    });

    const out = await reg(prisma, settings).execute(
      'projects.review.approve',
      { projectId: PROJECT_ID },
      ctx(),
    );
    expect(out.result).toBeDefined();
    expect(prisma.project.update).toHaveBeenCalled();
  });
});
