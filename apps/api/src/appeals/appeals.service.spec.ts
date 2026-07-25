import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { AppealsService } from './appeals.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { EmailService } from '../email/email.service';
import type { CreateAppealDto } from './dto/create-appeal.dto';

/**
 * Batch OPS-GAPS R1 — the submission surface guards: ownership refusals, the
 * one-appeal-per-decision matrix, and the create + notify path.
 */

function model() {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'appeal-1', status: 'SUBMITTED', ...data })),
  };
}

function build() {
  const prisma = { appeal: model(), user: model(), project: model(), comment: model() };
  const notifications = { create: jest.fn().mockResolvedValue(null) };
  const email = { appealReceived: jest.fn().mockResolvedValue(undefined) };
  const service = new AppealsService(
    prisma as unknown as PrismaService,
    notifications as unknown as NotificationsService,
    email as unknown as EmailService,
  );
  return { service, prisma, notifications, email };
}

const APPELLANT = '44444444-4444-4444-8444-444444444444';
const OTHER = '55555555-5555-4555-8555-555555555555';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';

const banDto = (subjectId = APPELLANT): CreateAppealDto => ({
  kind: 'ACCOUNT_BAN',
  subjectId,
  reasonAr: 'أعتقد أن الحظر جاء نتيجة سوء فهم لنشاطي على المنصة',
});
const projectDto = (): CreateAppealDto => ({
  kind: 'PROJECT_REJECTION',
  subjectId: PROJECT_ID,
  reasonAr: 'عالجتُ كل الملاحظات وأرى أن المشروع مستوفٍ للشروط الآن',
});

describe('AppealsService — ownership', () => {
  it('ACCOUNT_BAN: refuses appealing an account that is not yours', async () => {
    const { service } = build();
    await expect(service.submit(APPELLANT, banDto(OTHER))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ACCOUNT_BAN: refuses when the account is not actually BANNED', async () => {
    const { service, prisma } = build();
    prisma.user.findUnique.mockResolvedValue({ suspendedKind: 'SUSPENDED' });
    await expect(service.submit(APPELLANT, banDto())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PROJECT_REJECTION: refuses a missing project', async () => {
    const { service, prisma } = build();
    prisma.project.findUnique.mockResolvedValue(null);
    await expect(service.submit(APPELLANT, projectDto())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('PROJECT_REJECTION: refuses when you are not the creator', async () => {
    const { service, prisma } = build();
    prisma.project.findUnique.mockResolvedValue({
      createdById: OTHER,
      status: 'DRAFT',
      reviewFeedback: 'يرجى تحسين الوصف',
    });
    await expect(service.submit(APPELLANT, projectDto())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PROJECT_REJECTION: refuses when there is no live rejection (not DRAFT / no feedback)', async () => {
    const { service, prisma } = build();
    prisma.project.findUnique.mockResolvedValue({
      createdById: APPELLANT,
      status: 'LIVE',
      reviewFeedback: null,
    });
    await expect(service.submit(APPELLANT, projectDto())).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('AppealsService — one appeal per decision', () => {
  const ownedBan = (prisma: ReturnType<typeof build>['prisma']) =>
    prisma.user.findUnique.mockResolvedValue({ suspendedKind: 'BANNED', email: 'x@example.sa' });

  it.each(['SUBMITTED', 'UNDER_REVIEW', 'UPHELD'])(
    'refuses a new appeal when a prior one is %s',
    async (status) => {
      const { service, prisma } = build();
      ownedBan(prisma);
      prisma.appeal.findFirst.mockResolvedValue({ status });
      await expect(service.submit(APPELLANT, banDto())).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.appeal.create).not.toHaveBeenCalled();
    },
  );

  it('allows a fresh appeal when the prior one was OVERTURNED (re-actioned)', async () => {
    const { service, prisma } = build();
    ownedBan(prisma);
    // Only OVERTURNED/none is non-blocking → findFirst over the blocking set
    // returns null, so a new appeal proceeds.
    prisma.appeal.findFirst.mockResolvedValue(null);
    const appeal = await service.submit(APPELLANT, banDto());
    expect(appeal.status).toBe('SUBMITTED');
    expect(prisma.appeal.create).toHaveBeenCalled();
  });
});

describe('AppealsService — create + notify', () => {
  it('records the appeal (SUBMITTED) and notifies + emails the appellant', async () => {
    const { service, prisma, notifications, email } = build();
    prisma.user.findUnique.mockResolvedValue({ suspendedKind: 'BANNED', email: 'banned@example.sa' });
    prisma.appeal.findFirst.mockResolvedValue(null);

    const appeal = await service.submit(APPELLANT, banDto());

    expect(prisma.appeal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'ACCOUNT_BAN',
          subjectId: APPELLANT,
          submittedById: APPELLANT,
          status: 'SUBMITTED',
        }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: APPELLANT, kind: 'APPEAL_RECEIVED' }),
    );
    expect(email.appealReceived).toHaveBeenCalledWith(
      'banned@example.sa',
      expect.objectContaining({ kindAr: expect.any(String) }),
    );
    expect(appeal.id).toBe('appeal-1');
  });
});

/* ── CLOSEOUT C4 — CONTENT_TAKEDOWN + the DB race backstop ───────────────── */

const COMMENT_ID = '66666666-6666-4666-8666-666666666666';
const takedownDto = (subjectId = COMMENT_ID): CreateAppealDto =>
  ({ kind: 'CONTENT_TAKEDOWN', subjectId, reasonAr: 'تعليقي لا يخالف السياسة وأطلب إعادته' }) as CreateAppealDto;

describe('CLOSEOUT C4 — CONTENT_TAKEDOWN submission', () => {
  it('accepts the AUTHOR of a currently-hidden comment', async () => {
    const { service, prisma, notifications } = build();
    prisma.comment.findUnique.mockResolvedValue({ userId: APPELLANT, hidden: true });

    const appeal = await service.submit(APPELLANT, takedownDto());

    expect(appeal).toMatchObject({ kind: 'CONTENT_TAKEDOWN', status: 'SUBMITTED' });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'APPEAL_RECEIVED' }),
    );
  });

  it('refuses somebody else\'s comment', async () => {
    const { service, prisma } = build();
    prisma.comment.findUnique.mockResolvedValue({ userId: OTHER, hidden: true });

    await expect(service.submit(APPELLANT, takedownDto())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses when the comment is VISIBLE — no takedown to contest', async () => {
    const { service, prisma } = build();
    prisma.comment.findUnique.mockResolvedValue({ userId: APPELLANT, hidden: false });

    await expect(service.submit(APPELLANT, takedownDto())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses a missing comment', async () => {
    const { service, prisma } = build();
    prisma.comment.findUnique.mockResolvedValue(null);

    await expect(service.submit(APPELLANT, takedownDto())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('CLOSEOUT C4 — the unique-index race backstop', () => {
  it('translates a P2002 unique violation into the Arabic conflict', async () => {
    const { service, prisma } = build();
    prisma.comment.findUnique.mockResolvedValue({ userId: APPELLANT, hidden: true });
    // The pre-check finds nothing (the race window), then the DB refuses: this
    // is exactly what two concurrent submissions produce.
    prisma.appeal.findFirst.mockResolvedValue(null);
    const { Prisma } = await import('@prisma/client');
    prisma.appeal.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.submit(APPELLANT, takedownDto())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('does NOT swallow an unrelated database error', async () => {
    const { service, prisma } = build();
    prisma.comment.findUnique.mockResolvedValue({ userId: APPELLANT, hidden: true });
    prisma.appeal.findFirst.mockResolvedValue(null);
    prisma.appeal.create.mockRejectedValue(new Error('connection reset'));

    await expect(service.submit(APPELLANT, takedownDto())).rejects.toThrow(/connection reset/);
  });
});
