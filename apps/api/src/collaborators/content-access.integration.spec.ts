import { randomUUID } from 'node:crypto';
import { ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { CollaboratorsService } from './collaborators.service';
import { CollaboratorsController } from './collaborators.controller';
import { ContentWorkspacesController } from './content-workspaces.controller';
import { UpdatesService } from '../updates/updates.service';
import { UpdatesController } from '../updates/updates.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtStrategy } from '../identity/jwt.strategy';
import { ProjectVisibilityGuard } from '../projects/project-visibility.guard';
import { ProjectsService } from '../projects/projects.service';
import { RewardsService } from '../rewards/rewards.service';
import { BackersService } from '../backers/backers.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { FundingService } from '../funding/funding.service';

const enabled = process.env.WATHBA_CONSENT_DB_TESTS === '1';
if (enabled) {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/wathba_audit') {
    throw new Error('Content fixtures require the isolated local audit database');
  }
}
const suite = enabled ? describe : describe.skip;
suite('Content collaborators — PostgreSQL grants, revocation and publication', () => {
  const db = new PrismaClient();
  const team = new CollaboratorsService(db as never);
  const notifications = { filterAllowed: jest.fn(async (ids: string[]) => ids) };
  const updates = new UpdatesService(db as never, notifications as never);
  let owner: string, editor: string, outsider: string, email: string, projectId: string, updateId: string;
  beforeAll(async () => { await db.$connect(); });
  afterAll(async () => { await db.$disconnect(); });
  beforeEach(async () => {
    owner = (await db.user.create({ data: { name: 'مالك اختبار المحتوى', email: `content-owner-${randomUUID()}@local.test` } })).id;
    email = `content-editor-${randomUUID()}@local.test`;
    editor = (await db.user.create({ data: { name: 'محرر اختبار', email } })).id;
    outsider = (await db.user.create({ data: { name: 'مستخدم آخر', email: `content-other-${randomUUID()}@local.test` } })).id;
    projectId = (await db.project.create({ data: { createdById: owner, titleAr: 'حملة اختبار المحتوى', shortDescAr: 'معزولة', storyAr: 'اختبار محلي',
      fundingGoalHalalas: 100000n, durationDays: 30, deadline: new Date(Date.now() + 86400000), status: 'DRAFT', applicationApprovedAt: new Date() } })).id;
    updateId = (await db.projectUpdate.create({ data: { projectId, titleAr: 'تحديث خاص مجدول', bodyAr: 'نص خاص للمحرر', orderNum: 1,
      visibility: 'BACKERS_ONLY', publishAt: new Date(Date.now() + 86400000) } })).id;
    notifications.filterAllowed.mockImplementation(async ids => ids);
  });
  const grant = () => team.invite(owner, projectId, email);
  const write = () => updates.update(editor, projectId, updateId, { titleAr: 'عنوان عدله المحرر' });

  it('grants existing EDITOR access and lists only minimal campaign summaries', async () => {
    await grant();
    expect(await team.workspaces(editor)).toEqual({ items: [{ id: projectId, titleAr: 'حملة اختبار المحتوى', status: 'DRAFT', role: 'EDITOR' }] });
    expect(await team.workspaces(outsider)).toEqual({ items: [] });
    expect(await team.workspace(editor, projectId)).toEqual({ id: projectId, titleAr: 'حملة اختبار المحتوى', status: 'DRAFT', role: 'EDITOR' });
  });
  it('editor reads scheduled restricted content and edits, pins and removes it', async () => {
    await grant();
    expect(await updates.getOne(projectId, updateId, editor)).toMatchObject({ bodyAr: 'نص خاص للمحرر', scheduled: true, locked: false });
    expect((await updates.list(projectId, {}, editor)).items).toHaveLength(1);
    expect(await write()).toMatchObject({ titleAr: 'عنوان عدله المحرر' });
    expect(await updates.togglePin(editor, projectId, updateId)).toMatchObject({ pinned: true });
    expect(await updates.remove(editor, projectId, updateId)).toEqual({ ok: true });
    expect(await db.projectUpdate.findUnique({ where: { id: updateId } })).toBeNull();
  });
  it('removal closes workspace and every later content mutation', async () => {
    await grant(); await team.remove(owner, projectId, editor);
    expect(await team.workspaces(editor)).toEqual({ items: [] });
    await expect(team.workspace(editor, projectId)).rejects.toBeInstanceOf(NotFoundException);
    for (const action of [write, () => updates.togglePin(editor, projectId, updateId), () => updates.remove(editor, projectId, updateId),
      () => updates.create(editor, projectId, { titleAr: 'رفض', bodyAr: 'رفض' })]) await expect(action()).rejects.toBeInstanceOf(ForbiddenException);
    expect((await db.projectUpdate.findUniqueOrThrow({ where: { id: updateId } })).titleAr).toBe('تحديث خاص مجدول');
  });
  it('unknown membership role does not grant content access', async () => {
    await grant(); await db.projectCollaborator.updateMany({ where: { projectId, userId: editor }, data: { role: 'FUTURE_ROLE' } });
    expect(await team.workspaces(editor)).toEqual({ items: [] });
    await expect(write()).rejects.toBeInstanceOf(ForbiddenException);
    await expect(updates.getOne(projectId, updateId, editor)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('membership in one campaign never grants another campaign', async () => {
    await grant(); const other = await db.project.create({ data: { createdById: outsider, titleAr: 'حملة أخرى', shortDescAr: 'معزولة', storyAr: 'اختبار',
      fundingGoalHalalas: 10000n, durationDays: 30, deadline: new Date(), status: 'LIVE' } });
    await expect(team.workspace(editor, other.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(updates.create(editor, other.id, { titleAr: 'مرفوض', bodyAr: 'مرفوض' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('editor cannot add or remove team members or read their emails', async () => {
    await grant();
    await expect(team.list(editor, projectId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(team.invite(editor, projectId, email)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(team.remove(editor, projectId, editor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(await db.projectCollaborator.count({ where: { projectId } })).toBe(1);
  });
  it('unapproved application blocks invitations and content mutations even for the owner', async () => {
    await db.project.update({ where: { id: projectId }, data: { applicationApprovedAt: null } });
    await expect(grant()).rejects.toBeInstanceOf(ForbiddenException);
    await expect(updates.create(owner, projectId, { titleAr: 'مرفوض', bodyAr: 'مرفوض' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('moderation hide suspends editor access while preserving membership for restoration', async () => {
    await grant(); await db.project.update({ where: { id: projectId }, data: { hiddenAt: new Date() } });
    expect(await team.workspaces(editor)).toEqual({ items: [] });
    await expect(write()).rejects.toBeInstanceOf(ForbiddenException);
    expect(await db.projectCollaborator.count({ where: { projectId, userId: editor } })).toBe(1);
    await db.project.update({ where: { id: projectId }, data: { hiddenAt: null } });
    expect(await write()).toMatchObject({ titleAr: 'عنوان عدله المحرر' });
  });
  it('an edit waiting behind a committed revocation is refused', async () => {
    await grant(); let release!: () => void; let ready!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const held = new Promise<void>(resolve => { ready = resolve; });
    const revoking = db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId}::uuid FOR UPDATE`;
      await tx.projectCollaborator.deleteMany({ where: { projectId, userId: editor } });
      ready(); await gate;
    });
    await held; const editing = write(); release(); await revoking;
    await expect(editing).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('concurrent owner/editor creation assigns different update sequence numbers', async () => {
    await grant(); const scheduled = new Date(Date.now() + 86400000).toISOString();
    const rows = await Promise.all([owner, editor].map(user => updates.create(user, projectId, { titleAr: 'تحديث جديد', bodyAr: 'محتوى', publishAt: scheduled })));
    expect(rows.map(row => row.orderNum).sort()).toEqual([2, 3]);
  });
  it('does not notify followers of a campaign being prepared; delivers once after launch', async () => {
    const profile = await db.creatorProfile.create({ data: { userId: owner } });
    await db.creatorFollow.create({ data: { creatorProfileId: profile.id, followerId: outsider } });
    await db.projectUpdate.update({ where: { id: updateId }, data: { visibility: 'PUBLIC', publishAt: new Date(0) } });
    const hint = { id: updateId, titleAr: 'تحديث خاص مجدول', visibility: 'PUBLIC' as const };
    expect(await updates.fanOutUpdatePosted(projectId, hint)).toEqual({ notified: 0, deferred: true });
    expect(await db.notification.count({ where: { userId: outsider } })).toBe(0);
    expect((await db.projectUpdate.findUniqueOrThrow({ where: { id: updateId } })).notifiedAt).toBeNull();
    await db.project.update({ where: { id: projectId }, data: { status: 'LIVE' } });
    expect(await updates.fanOutUpdatePosted(projectId, hint)).toEqual({ notified: 1 });
    expect(await updates.fanOutUpdatePosted(projectId, hint)).toEqual({ notified: 0 });
    expect(await db.notification.count({ where: { userId: outsider } })).toBe(1);
  });
  it('stale public notification hint does not bypass a newer backer-only audience', async () => {
    await db.project.update({ where: { id: projectId }, data: { status: 'LIVE' } });
    const profile = await db.creatorProfile.create({ data: { userId: owner } });
    await db.creatorFollow.create({ data: { creatorProfileId: profile.id, followerId: outsider } });
    await db.projectUpdate.update({ where: { id: updateId }, data: { publishAt: new Date(0), titleAr: 'عنوان حالي' } });
    await db.pledge.create({ data: { projectId, backerId: editor, backerNo: 1, amountHalalas: 1000n, status: 'CAPTURED', paymentRef: `local-${randomUUID()}` } });
    expect(await updates.fanOutUpdatePosted(projectId, { id: updateId, titleAr: 'عنوان قديم', visibility: 'PUBLIC' })).toEqual({ notified: 1 });
    expect(await db.notification.count({ where: { userId: outsider } })).toBe(0);
    const receipt = await db.notification.findFirstOrThrow({ where: { userId: editor } });
    expect(receipt.payload).toMatchObject({ updateTitleAr: 'عنوان حالي' });
  });
  it('failed notification preferences leave delivery pending and retryable', async () => {
    await db.project.update({ where: { id: projectId }, data: { status: 'LIVE' } });
    await db.projectUpdate.update({ where: { id: updateId }, data: { publishAt: new Date(0) } });
    notifications.filterAllowed.mockRejectedValueOnce(new Error('temporary failure'));
    const hint = { id: updateId, titleAr: 'عنوان', visibility: 'BACKERS_ONLY' as const };
    await expect(updates.fanOutUpdatePosted(projectId, hint)).rejects.toThrow('temporary failure');
    expect((await db.projectUpdate.findUniqueOrThrow({ where: { id: updateId } })).notifiedAt).toBeNull();
    expect(await updates.fanOutUpdatePosted(projectId, hint)).toEqual({ notified: 0 });
    expect((await db.projectUpdate.findUniqueOrThrow({ where: { id: updateId } })).notifiedAt).not.toBeNull();
  });

  async function httpFixture() {
    const secret = randomUUID() + randomUUID();
    const module = await Test.createTestingModule({ controllers: [CollaboratorsController, ContentWorkspacesController, UpdatesController],
      providers: [{ provide: PrismaService, useValue: db }, { provide: CollaboratorsService, useValue: team }, { provide: UpdatesService, useValue: updates },
        { provide: ConfigService, useValue: { get: () => secret } }, JwtStrategy, { provide: APP_GUARD, useClass: ProjectVisibilityGuard }],
    }).compile();
    const app = module.createNestApplication(); app.setGlobalPrefix('v1'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1'); const base = await app.getUrl(); const jwt = new JwtService({ secret });
    return { app, request: (path: string, user?: string, method = 'GET', body?: unknown) => fetch(`${base}/v1/${path}`, {
      method, headers: { ...(user ? { Authorization: `Bearer ${jwt.sign({ sub: user })}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }) };
  }
  // Use the real owner-only services as well as the visibility guard: making
  // a campaign public must not turn its content membership into money access.
  it.each(['DRAFT', 'LIVE'] as const)('%s editor cannot change financial terms, manage funds or export backers', async status => {
    await db.project.update({ where: { id: projectId }, data: { status } });
    await team.invite(owner, projectId, email);
    const dependency = new Proxy({}, { get() { throw new Error('Financial side effect reached before access was denied'); } }) as never;
    const projects = new ProjectsService(db as never, dependency, dependency, dependency);
    const rewards = new RewardsService(db as never, dependency);
    const backers = new BackersService(db as never, dependency);
    const analytics = new AnalyticsService(db as never);
    const funding = new FundingService(db as never, dependency, dependency, dependency, dependency, dependency,
      dependency, dependency, dependency, dependency, dependency);
    const before = await db.project.findUniqueOrThrow({ where: { id: projectId } });
    await expect(projects.update(editor, projectId, { fundingGoalHalalas: 500000, durationDays: 60 })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(rewards.update(editor, projectId, randomUUID(), { amountHalalas: 2500 })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(backers.list(editor, projectId, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(backers.exportCsv(editor, projectId, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(analytics.forProject(editor, projectId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(funding.pauseCampaign(editor, projectId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(funding.cancelCampaign(editor, projectId)).rejects.toBeInstanceOf(ForbiddenException);
    const after = await db.project.findUniqueOrThrow({ where: { id: projectId } });
    expect(after).toMatchObject({ status: before.status, fundingGoalHalalas: before.fundingGoalHalalas, durationDays: before.durationDays,
      raisedHalalas: before.raisedHalalas, realizedHalalas: before.realizedHalalas });
    expect(await db.projectCollaborator.count({ where: { projectId, userId: editor } })).toBe(1);
  });
  it('HTTP reaches only the invited editorial workspace, reads and saves, then enforces owner revocation', async () => {
    const http = await httpFixture();
    try {
      expect((await http.request('content-workspaces')).status).toBe(401);
      const invitation = await http.request(`projects/${projectId}/collaborators`, owner, 'POST', { email });
      expect(invitation.status).toBe(201);
      expect((await http.request(`content-workspaces/${projectId}`, editor)).status).toBe(200);
      expect((await http.request(`content-workspaces/${projectId}`, outsider)).status).toBe(404);
      const read = await http.request(`projects/${projectId}/updates/${updateId}`, editor);
      expect(read.status).toBe(200); expect(await read.json()).toMatchObject({ bodyAr: 'نص خاص للمحرر', locked: false });
      expect((await http.request(`projects/${projectId}/collaborators`, editor)).status).toBe(404);
      expect((await http.request(`projects/${projectId}/updates/${updateId}`, editor, 'PATCH', { titleAr: 'حفظ HTTP' })).status).toBe(200);
      expect((await http.request(`projects/${projectId}/collaborators/${editor}`, owner, 'DELETE')).status).toBe(200);
      expect((await http.request(`content-workspaces/${projectId}`, editor)).status).toBe(404);
      expect((await http.request(`projects/${projectId}/updates/${updateId}`, editor, 'PATCH', { titleAr: 'مرفوض' })).status).toBe(404);
      expect((await db.projectUpdate.findUniqueOrThrow({ where: { id: updateId } })).titleAr).toBe('حفظ HTTP');
    } finally { await http.app.close(); }
  }, 30000);
});
