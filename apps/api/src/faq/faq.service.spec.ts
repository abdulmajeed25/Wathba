/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FaqService } from './faq.service';

/**
 * FaqService — Tier 3.8.
 *   - createItem: creator-only, 403 for non-owner
 *   - ask: any auth'd user can submit a question against any project
 *   - answer: creator-only, default publish=true creates a new FaqItem +
 *     flips status ANSWERED + notifies asker
 *   - answer: publish=false skips item creation but still marks question
 */

const PROJ = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CREATOR = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const ASKER = 'aaaaaaaa-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const QID = 'qqqqqqqq-qqqq-qqqq-qqqq-qqqqqqqqqqqq';

function makePrisma(over: Record<string, any> = {}): any {
  const prisma: any = {
    project: { findUnique: jest.fn() },
    faqItem: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    faqQuestion: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    notification: { create: jest.fn() },
    ...over,
  };
  prisma.$transaction = jest.fn(
    async (fn: (tx: unknown) => unknown): Promise<unknown> => fn(prisma),
  );
  return prisma;
}

function makeNotifications(): { create: jest.Mock } {
  return { create: jest.fn() };
}

describe('FaqService.createItem', () => {
  it('rejects non-owner with 403', async () => {
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ createdById: CREATOR }) },
    });
    const svc = new FaqService(prisma, makeNotifications() as any);
    await expect(
      svc.createItem('not-creator', PROJ, { questionAr: 'q', answerAr: 'a' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets owner create + persists sortOrder default 0', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ createdById: CREATOR }) },
      faqItem: { create },
    });
    const svc = new FaqService(prisma, makeNotifications() as any);
    await svc.createItem(CREATOR, PROJ, { questionAr: 'q', answerAr: 'a' } as any);
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ projectId: PROJ, questionAr: 'q', answerAr: 'a', sortOrder: 0 }),
    );
  });
});

describe('FaqService.ask', () => {
  it('accepts any auth user + records PENDING status', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ id: PROJ }) },
      faqQuestion: { create },
    });
    const svc = new FaqService(prisma, makeNotifications() as any);
    await svc.ask(ASKER, PROJ, { bodyAr: 'متى التسليم؟' } as any);
    expect(create.mock.calls[0][0].data).toEqual({
      projectId: PROJ,
      askerId: ASKER,
      bodyAr: 'متى التسليم؟',
      status: 'PENDING',
    });
  });

  it('404s when project does not exist', async () => {
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const svc = new FaqService(prisma, makeNotifications() as any);
    await expect(svc.ask(ASKER, PROJ, { bodyAr: 'q' } as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('FaqService.answer', () => {
  const basePending = {
    id: QID,
    projectId: PROJ,
    askerId: ASKER,
    bodyAr: 'متى؟',
    status: 'PENDING' as const,
    answeredFaqItemId: null,
    createdAt: new Date(),
  };

  it('with publish=true creates a new FaqItem + flips status ANSWERED + notifies asker', async () => {
    const updateQ = jest.fn().mockResolvedValue({ ...basePending, status: 'ANSWERED' });
    const createItem = jest.fn().mockResolvedValue({ id: 'new-item' });
    const notifCreate = jest.fn();
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ createdById: CREATOR }) },
      faqQuestion: {
        findUnique: jest.fn().mockResolvedValue(basePending),
        update: updateQ,
      },
      faqItem: { findFirst: jest.fn().mockResolvedValue(null), create: createItem },
      notification: { create: notifCreate },
    });
    const svc = new FaqService(prisma, makeNotifications() as any);
    const out = await svc.answer(CREATOR, PROJ, QID, { answerAr: 'الإصدار في رمضان', publish: true } as any);
    expect(createItem).toHaveBeenCalled();
    expect(updateQ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ANSWERED' }),
      }),
    );
    // FAQ writes the notification row directly via tx.notification.create
    // (not via NotificationsService) so it's atomic with the answer tx.
    expect(notifCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: ASKER, kind: 'FAQ_ANSWERED' }),
      }),
    );
    expect(out.item).not.toBeNull();
  });

  it('with publish=false marks ANSWERED without creating a new item', async () => {
    const createItem = jest.fn();
    const updateQ = jest.fn().mockResolvedValue({ ...basePending, status: 'ANSWERED' });
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ createdById: CREATOR }) },
      faqQuestion: {
        findUnique: jest.fn().mockResolvedValue(basePending),
        update: updateQ,
      },
      faqItem: { create: createItem },
    });
    const svc = new FaqService(prisma, makeNotifications() as any);
    const out = await svc.answer(CREATOR, PROJ, QID, { answerAr: 'ok', publish: false } as any);
    expect(createItem).not.toHaveBeenCalled();
    expect(out.item).toBeNull();
  });

  it('400s when the question is HIDDEN', async () => {
    const prisma = makePrisma({
      project: { findUnique: jest.fn().mockResolvedValue({ createdById: CREATOR }) },
      faqQuestion: {
        findUnique: jest.fn().mockResolvedValue({ ...basePending, status: 'HIDDEN' }),
      },
    });
    const svc = new FaqService(prisma, makeNotifications() as any);
    await expect(
      svc.answer(CREATOR, PROJ, QID, { answerAr: 'ok' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
