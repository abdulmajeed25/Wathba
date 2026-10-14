import { randomUUID } from 'node:crypto';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaClient, PledgeStatus } from '@prisma/client';
import { UpdatesService } from './updates.service';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UpdatesController } from './updates.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtStrategy } from '../identity/jwt.strategy';
import { ProjectVisibilityGuard } from '../projects/project-visibility.guard';

const enabled = process.env.WATHBA_CONSENT_DB_TESTS === '1';
if (enabled) {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/wathba_audit') {
    throw new Error('Update reaction fixtures require the isolated local audit database');
  }
}
const suite = enabled ? describe : describe.skip;
suite('Update reactions — real PostgreSQL content boundary and concurrency', () => {
  const db = new PrismaClient();
  const service = new UpdatesService(db as never, {} as never);
  let owner: string, reader: string, projectId: string, updateId: string;
  beforeAll(async () => { await db.$connect(); });
  afterAll(async () => { await db.$disconnect(); });
  beforeEach(async () => {
    owner = (await db.user.create({ data: { name: 'مالك اختبار', email: `update-owner-${randomUUID()}@local.test` } })).id;
    reader = (await db.user.create({ data: { name: 'قارئ اختبار', email: `update-reader-${randomUUID()}@local.test` } })).id;
    projectId = (await db.project.create({ data: {
      createdById: owner, titleAr: 'اختبار خصوصية التحديث', shortDescAr: 'معزول', storyAr: 'بيانات اختبار محلية',
      fundingGoalHalalas: 100000n, durationDays: 30, deadline: new Date(Date.now() + 86400000), status: 'LIVE', applicationApprovedAt: new Date(),
    } })).id;
    updateId = (await db.projectUpdate.create({ data: {
      projectId, titleAr: 'عنوان تحديث', bodyAr: 'محتوى خاص يجب ألا يتسرب', orderNum: 1,
      visibility: 'BACKERS_ONLY', publishAt: new Date(Date.now() - 1000),
    } })).id;
  });
  const pledge = (status: PledgeStatus) => db.pledge.create({ data: {
    projectId, backerId: reader, backerNo: 1, amountHalalas: 1000n, status, paymentMethod: 'CARD', paymentRef: `local-fixture-${randomUUID()}`,
  } });
  const unchanged = async () => {
    expect(await db.updateLike.count({ where: { updateId } })).toBe(0);
    expect((await db.projectUpdate.findUniqueOrThrow({ where: { id: updateId } })).likeCount).toBe(0);
  };

  it('rejects a non-backer reaction instead of returning a restricted body', async () => {
    expect(await service.getOne(projectId, updateId, reader)).toMatchObject({ locked: true, bodyAr: null });
    await expect(service.like(reader, projectId, updateId)).rejects.toBeInstanceOf(ForbiddenException);
    await unchanged();
  });
  it.each(['HELD', 'PENDING_AUTH', 'REFUNDED', 'FAILED'] as PledgeStatus[])('does not treat %s as captured audience', async status => {
    await pledge(status);
    await expect(service.like(reader, projectId, updateId)).rejects.toBeInstanceOf(ForbiddenException);
    await unchanged();
  });
  it('allows a captured backer and preserves toggle semantics', async () => {
    await pledge('CAPTURED');
    expect(await service.like(reader, projectId, updateId)).toMatchObject({ liked: true, locked: false, bodyAr: 'محتوى خاص يجب ألا يتسرب', likeCount: 1 });
    expect(await service.like(reader, projectId, updateId)).toMatchObject({ liked: false, likeCount: 0 });
    await unchanged();
  });
  it('allows a signed-in reader on a published public update', async () => {
    await db.projectUpdate.update({ where: { id: updateId }, data: { visibility: 'PUBLIC' } });
    expect(await service.like(reader, projectId, updateId)).toMatchObject({ liked: true, locked: false, likeCount: 1 });
  });
  it.each(['PUBLIC', 'BACKERS_ONLY'] as const)('hides future %s updates even from a captured backer', async visibility => {
    await pledge('CAPTURED');
    await db.projectUpdate.update({ where: { id: updateId }, data: { visibility, publishAt: new Date(Date.now() + 86400000) } });
    await expect(service.like(reader, projectId, updateId)).rejects.toBeInstanceOf(NotFoundException);
    await unchanged();
  });
  it('retains owner access to their scheduled restricted update', async () => {
    await db.projectUpdate.update({ where: { id: updateId }, data: { publishAt: new Date(Date.now() + 86400000) } });
    expect(await service.like(owner, projectId, updateId)).toMatchObject({ liked: true, locked: false, scheduled: true });
  });
  it.each(['DRAFT', 'UNDER_REVIEW', 'hidden'] as const)('does not expose a %s campaign through reactions', async state => {
    await pledge('CAPTURED');
    await db.project.update({ where: { id: projectId }, data: state === 'hidden' ? { hiddenAt: new Date() } : { status: state } });
    await expect(service.like(reader, projectId, updateId)).rejects.toBeInstanceOf(NotFoundException);
    await unchanged();
  });
  it('rejects update IDs outside the requested project', async () => {
    await expect(service.like(reader, randomUUID(), updateId)).rejects.toBeInstanceOf(NotFoundException);
    await unchanged();
  });
  it('serializes two simultaneous toggles by the same reader without duplicate errors or drift', async () => {
    await pledge('CAPTURED');
    const result = await Promise.all([service.like(reader, projectId, updateId), service.like(reader, projectId, updateId)]);
    expect(result.map(r => r.liked).sort()).toEqual([false, true]);
    await unchanged();
  });
  it('reads visibility after a concurrent owner edit commits', async () => {
    await db.projectUpdate.update({ where: { id: updateId }, data: { visibility: 'PUBLIC' } });
    let release!: () => void;
    let signal!: () => void;
    const held = new Promise<void>(resolve => { signal = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const editing = db.$transaction(async tx => {
      await tx.projectUpdate.update({ where: { id: updateId }, data: { visibility: 'BACKERS_ONLY' } });
      signal(); await gate;
    });
    await held;
    const reacting = service.like(reader, projectId, updateId);
    // Start the reaction while the edit owns the row; no timing assertion is needed.
    release(); await editing;
    await expect(reacting).rejects.toBeInstanceOf(ForbiddenException);
    await unchanged();
  });

  async function httpFixture() {
    const secret = randomUUID() + randomUUID();
    const module = await Test.createTestingModule({
      controllers: [UpdatesController],
      providers: [{ provide: UpdatesService, useValue: service }, { provide: PrismaService, useValue: db },
        { provide: ConfigService, useValue: { get: () => secret } }, JwtStrategy,
        { provide: APP_GUARD, useClass: ProjectVisibilityGuard }],
    }).compile();
    const app = module.createNestApplication(); app.setGlobalPrefix('v1');
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/v1/projects/${projectId}/updates`;
    return { app, jwt: new JwtService({ secret }), request: (method: string, token?: string, id = updateId) => fetch(
      `${base}/${id}${method === 'POST' ? '/like' : ''}`, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} },
    ) };
  }
  it('HTTP refuses anonymous, invalid, expired and forged-role access without leaking the body', async () => {
    const http = await httpFixture();
    try {
      for (const token of [undefined, 'invalid', http.jwt.sign({ sub: reader }, { expiresIn: -1 })]) {
        expect((await http.request('POST', token)).status).toBe(401);
      }
      const token = http.jwt.sign({ sub: reader, roles: ['ADMIN'] });
      const read = await http.request('GET', token);
      expect(read.status).toBe(200); expect(await read.json()).toMatchObject({ locked: true, bodyAr: null });
      const reaction = await http.request('POST', token);
      expect(reaction.status).toBe(403); expect(await reaction.text()).not.toContain('محتوى خاص يجب ألا يتسرب');
      expect((await http.request('POST', token, 'not-a-uuid')).status).toBe(400);
      await unchanged();
    } finally { await http.app.close(); }
  });
  it('HTTP returns allowed content only to captured audience, and rejects a live suspension', async () => {
    await pledge('CAPTURED'); const http = await httpFixture();
    try {
      const token = http.jwt.sign({ sub: reader });
      const response = await http.request('POST', token);
      expect(response.status).toBe(201); expect(await response.json()).toMatchObject({ liked: true, locked: false });
      await db.user.update({ where: { id: reader }, data: { suspendedAt: new Date() } });
      expect((await http.request('POST', token)).status).toBe(401);
      expect((await db.projectUpdate.findUniqueOrThrow({ where: { id: updateId } })).likeCount).toBe(1);
    } finally { await http.app.close(); }
  });
  it('HTTP scheduled update is absent to the backer for reads and reactions', async () => {
    await pledge('CAPTURED');
    await db.projectUpdate.update({ where: { id: updateId }, data: { publishAt: new Date(Date.now() + 86400000) } });
    const http = await httpFixture();
    try {
      const token = http.jwt.sign({ sub: reader });
      for (const method of ['GET', 'POST']) expect((await http.request(method, token)).status).toBe(404);
      await unchanged();
    } finally { await http.app.close(); }
  });
  it('HTTP global boundary hides a private project from readers even with captured support', async () => {
    await pledge('CAPTURED'); await db.project.update({ where: { id: projectId }, data: { hiddenAt: new Date() } });
    const http = await httpFixture();
    try {
      for (const method of ['GET', 'POST']) expect((await http.request(method, http.jwt.sign({ sub: reader }))).status).toBe(404);
      expect((await http.request('GET', http.jwt.sign({ sub: owner }))).status).toBe(200);
      await unchanged();
    } finally { await http.app.close(); }
  });
});
