import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { ChangeConsentService } from './change-consent.service';
import { campaignTerms } from './project-changes.service';
import { ProjectsService } from './projects.service';
import { moneyOps, type MoneyOpsDeps } from '../ops/operations/money.ops';
import type { OperationDef } from '../ops/operation.types';

// Opt-in real PostgreSQL proof. Never run this fixture writer against an
// arbitrary DATABASE_URL, and never delete financial/audit records afterwards.
const enabled = process.env.WATHBA_CONSENT_DB_TESTS === '1';
if (enabled) {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/wathba_audit') {
    throw new Error('Consent integration fixtures require the isolated local audit database');
  }
}
const suite = enabled ? describe : describe.skip;
suite('Individual consent — PostgreSQL concurrency', () => {
  const db = new PrismaClient();
  const service = new ChangeConsentService(db as never);
  let backerId: string, projectId: string, pledgeId: string, requestId: string;
  beforeAll(async () => { await db.$connect(); });
  afterAll(async () => { await db.$disconnect(); });
  beforeEach(async () => {
    const user = await db.user.create({ data: { name: 'اختبار موافقة محلي', email: `consent-race-${randomUUID()}@local.test` } });
    backerId = user.id;
    const project = await db.project.create({ data: {
      titleAr: `اختبار موافقة محلي ${Date.now()}`, shortDescAr: 'معزول', storyAr: 'اختبار التزامن دون مزود دفع',
      createdById: user.id, fundingGoalHalalas: 100000n, durationDays: 30, deadline: new Date(Date.now() + 86400000), status: 'LIVE',
    } });
    projectId = project.id;
    const pledge = await db.pledge.create({ data: { projectId, backerId, amountHalalas: 1000n, backerNo: 1, paymentRef: `consent-race-${randomUUID()}`, status: 'HELD' } });
    pledgeId = pledge.id;
    const request = await db.projectChangeRequest.create({ data: {
      projectId, requestedById: user.id, clientRequestId: randomUUID(), status: 'CONSENT_OPEN', consentOpenedAt: new Date(),
      reasonAr: 'اختبار محلي لحفظ القرار الفردي وتزامنه', before: campaignTerms(project), proposed: { fundingGoalHalalas: '50000', durationDays: 60 },
    } });
    requestId = request.id;
  });

  it('legacy deadline write rejects existing agreements even for a scheduled project', async () => {
    await db.project.update({ where: { id: projectId }, data: { status: 'SCHEDULED', publishedAt: null } });
    const before = await db.project.findUniqueOrThrow({ where: { id: projectId } });
    const op = moneyOps({} as MoneyOpsDeps).find(o => o.key === 'money.deadline.override') as unknown as OperationDef<{ projectId: string; deadline: Date }>;
    await expect(db.$transaction(tx => op.execute(tx, { projectId, deadline: new Date(Date.now() + 600000) },
      { actor: { id: backerId, type: 'HUMAN', roles: ['ADMIN'] } }))).rejects.toBeInstanceOf(ConflictException);
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).deadline).toEqual(before.deadline);
  });

  it('concurrent retries persist exactly one response', async () => {
    const dto = { clientRequestId: randomUUID(), decision: 'ACCEPT' as const };
    const responses = await Promise.all(Array.from({ length: 4 }, () => service.respond(backerId, pledgeId, requestId, dto)));
    expect(new Set(responses.map(r => r.id)).size).toBe(1);
    expect(await db.projectChangeResponse.count({ where: { requestId } })).toBe(1);
  });

  it('a draft edit cannot alter the goal when publication commits after the initial read', async () => {
    await db.project.update({ where: { id: projectId }, data: { status: 'DRAFT' } });
    const settings = { get: jest.fn(async (key: string) => {
      await db.project.update({ where: { id: projectId }, data: { status: 'LIVE' } });
      return key.endsWith('MinHalalas') ? 1000 : null;
    }) };
    const projects = new ProjectsService(db as never, {} as never, settings as never, {} as never);
    await expect(projects.update(backerId, projectId, { fundingGoalHalalas: 50000 } as never)).rejects.toBeInstanceOf(ConflictException);
    expect(await db.project.findUnique({ where: { id: projectId } })).toMatchObject({ status: 'LIVE', fundingGoalHalalas: 100000n });
  });

  it('a published story and its public disclosure are committed together', async () => {
    const projects = new ProjectsService(db as never, { log: jest.fn() } as never, {} as never, {} as never);
    await projects.updateStory(backerId, projectId, { storyAr: 'قصة محدثة للاختبار', changeNote: 'إضافة توضيح للتنفيذ' } as never);
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).storyAr).toBe('قصة محدثة للاختبار');
    expect(await db.projectChangeLog.count({ where: { projectId, field: 'story' } })).toBe(1);
  });

  it('rolls back the story if its disclosure cannot be saved', async () => {
    const before = await db.project.findUniqueOrThrow({ where: { id: projectId } });
    const client = {
      project: db.project,
      $transaction: (fn: (tx: unknown) => unknown) => db.$transaction(async tx => fn({
        ...tx, projectChangeLog: { create: async () => { throw new Error('disclosure unavailable'); } },
      })),
    };
    const projects = new ProjectsService(client as never, { log: jest.fn() } as never, {} as never, {} as never);
    await expect(projects.updateStory(backerId, projectId, { storyAr: 'لا يجب حفظ هذا النص دون سجل' } as never)).rejects.toThrow('disclosure unavailable');
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).storyAr).toBe(before.storyAr);
    expect(await db.projectChangeLog.count({ where: { projectId } })).toBe(0);
  });

  it('concurrent distinct decisions retain both records and a deterministic latest answer', async () => {
    await Promise.all((['ACCEPT', 'DECLINE'] as const).map(decision => service.respond(backerId, pledgeId, requestId, { clientRequestId: randomUUID(), decision })));
    const rows = await db.projectChangeResponse.findMany({ where: { requestId }, orderBy: { createdAt: 'desc' } });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.createdAt.getTime()).toBeGreaterThan(rows[1]!.createdAt.getTime());
    expect((await service.list(backerId, pledgeId)).items[0]!.response?.decision).toBe(rows[0]!.decision);
  });

  it('a withdrawal that holds the request lock prevents a racing answer', async () => {
    let attempt: Promise<unknown>;
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "ProjectChangeRequest" WHERE "id" = ${requestId}::uuid FOR UPDATE`;
      // Attach rejection handling immediately; the assertion runs after commit.
      attempt = service.respond(backerId, pledgeId, requestId, { clientRequestId: randomUUID(), decision: 'ACCEPT' }).catch(error => error);
      await tx.projectChangeRequest.update({ where: { id: requestId }, data: { status: 'WITHDRAWN' } });
    });
    expect(await attempt!).toBeInstanceOf(ConflictException);
    expect(await db.projectChangeResponse.count({ where: { requestId } })).toBe(0);
  });

  it('a concurrent terms update invalidates the old proposal before a response commits', async () => {
    let attempt: Promise<unknown>;
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId}::uuid FOR UPDATE`;
      attempt = service.respond(backerId, pledgeId, requestId, { clientRequestId: randomUUID(), decision: 'ACCEPT' }).catch(error => error);
      await tx.project.update({ where: { id: projectId }, data: { fundingGoalHalalas: 150000n } });
    });
    expect(await attempt!).toBeInstanceOf(ConflictException);
    expect(await db.projectChangeResponse.count({ where: { requestId } })).toBe(0);
  });
});
