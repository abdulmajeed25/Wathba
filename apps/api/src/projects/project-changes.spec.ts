import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { CreateProjectChangeDto, ProjectChangesService } from './project-changes.service';
import { projectChangesOps } from '../ops/operations/project-changes.ops';
import type { OperationDef } from '../ops/operation.types';

const project = { id: 'project', createdById: 'creator', status: 'LIVE', fundingGoalHalalas: 10000000n, durationDays: 30, deadline: new Date('2026-11-01'), releaseThresholdPct: 80 };
const dto = { clientRequestId: 'request-key', fundingGoalHalalas: 5000000, durationDays: 730, reasonAr: 'خفض النطاق وإعادة جدولة التنفيذ بعد عرض المورد الجديد' };
function setup() {
  const db = { project: { findFirst: jest.fn().mockResolvedValue(project) }, projectChangeRequest: {
    findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation(({ data }) => ({ id: 'change', ...data, status: 'SUBMITTED' })), updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  } };
  return { db, service: new ProjectChangesService(db as never) };
}
describe('Campaign change proposals preserve existing agreements', () => {
  it('records long-duration proposals without changing campaign terms', async () => {
    const { db, service } = setup();
    const row = await service.create('creator', 'project', dto);
    expect(row.proposed).toEqual({ fundingGoalHalalas: '5000000', durationDays: 730 });
    expect(row.before).toMatchObject({ fundingGoalHalalas: '10000000', durationDays: 30 });
    expect(db.projectChangeRequest.create).toHaveBeenCalledTimes(1);
    expect(project.durationDays).toBe(30);
  });
  it('does not expose or accept requests from a non-owner', async () => {
    const { db, service } = setup(); db.project.findFirst.mockResolvedValue(null);
    await expect(service.list('stranger', 'project')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.create('stranger', 'project', dto)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.withdraw('stranger', 'project', 'change')).rejects.toBeInstanceOf(NotFoundException);
    expect(db.projectChangeRequest.create).not.toHaveBeenCalled();
  });
  it('replays the same submission without duplication, including after review', async () => {
    const { db, service } = setup();
    const row = await service.create('creator', 'project', dto);
    db.projectChangeRequest.findUnique.mockResolvedValue({ ...row, status: 'ACCEPTED_FOR_PREPARATION' });
    expect((await service.create('creator', 'project', dto)).id).toBe(row.id);
    expect(db.projectChangeRequest.create).toHaveBeenCalledTimes(1);
    await expect(service.create('creator', 'project', { ...dto, durationDays: 365 })).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejects unchanged terms and meaningless reasons', async () => {
    const { service } = setup();
    await expect(service.create('creator', 'project', { ...dto, fundingGoalHalalas: 10000000, durationDays: 30 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('creator', 'project', { ...dto, reasonAr: ' '.repeat(25) })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('refuses a new proposal for a closed campaign', async () => {
    const { db, service } = setup(); db.project.findFirst.mockResolvedValue({ ...project, status: 'REFUNDED' });
    await expect(service.create('creator', 'project', dto)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('withdraws only a request belonging to this project and owner', async () => {
    const { db, service } = setup();
    await service.withdraw('creator', 'project', 'change');
    expect(db.projectChangeRequest.updateMany.mock.calls[0]?.[0].where).toMatchObject({ id: 'change', projectId: 'project', requestedById: 'creator' });
    db.projectChangeRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.withdraw('creator', 'project', 'change')).rejects.toBeInstanceOf(ConflictException);
  });
  it('paginates history without silently truncating older requests', async () => {
    const { db, service } = setup();
    db.projectChangeRequest.findMany.mockResolvedValue(Array.from({ length: 21 }, (_, i) => ({ id: `r${i}` })));
    const page = await service.list('creator', 'project');
    expect(page.items).toHaveLength(20);
    expect(page.nextCursor).toBe('r19');
    await service.list('creator', 'project', 'r19');
    expect(db.projectChangeRequest.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { projectId: 'project' }, cursor: { id: 'r19' }, skip: 1 }));
  });
  it('validates safe integer amounts and finite positive planning horizons', async () => {
    const valid = Object.assign(new CreateProjectChangeDto(), dto, { clientRequestId: '874a3e75-564f-4edb-b92e-0d6c44425c19' });
    expect(await validate(valid)).toHaveLength(0);
    for (const patch of [{ durationDays: 0 }, { durationDays: 1.5 }, { fundingGoalHalalas: Number.MAX_SAFE_INTEGER + 1 }, { fundingGoalHalalas: -1 }]) {
      expect((await validate(Object.assign(new CreateProjectChangeDto(), valid, patch))).length).toBeGreaterThan(0);
    }
  });
});

describe('Governed review of proposals', () => {
  type Input = { projectId: string; requestId: string; decision: 'accept' | 'reject'; noteAr: string };
  const op = projectChangesOps()[0] as unknown as OperationDef<Input, unknown>;
  const input: Input = { projectId: 'project', requestId: 'change', decision: 'accept', noteAr: 'مقبول لتجهيز تفاصيل الأثر والموافقات' };
  const ctx = { actor: { id: 'reviewer', type: 'HUMAN' as const, roles: ['ADMIN'] } };
  const row = { projectId: 'project', requestedById: 'creator', status: 'SUBMITTED', before: { fundingGoalHalalas: '10000000', durationDays: 30, deadline: project.deadline.toISOString(), releaseThresholdPct: 80 }, project };
  it('requires governed permission, a reason and sensitive authentication', () => {
    expect(op).toMatchObject({ permission: 'projects.review', riskTier: 'SENSITIVE', requiresReason: true });
  });
  it('blocks self approval and already resolved requests', async () => {
    const db = { projectChangeRequest: { findUnique: jest.fn().mockResolvedValue(row) } };
    expect(await op.preconditions[0]!.check(db as never, input, ctx)).toBe(true);
    expect(await op.preconditions[0]!.check(db as never, { ...input, projectId: 'different-project' }, ctx)).toBe(false);
    expect(await op.preconditions[0]!.check(db as never, input, { actor: { ...ctx.actor, id: 'creator' } })).toBe(false);
    db.projectChangeRequest.findUnique.mockResolvedValue({ ...row, status: 'WITHDRAWN' });
    expect(await op.preconditions[0]!.check(db as never, input, ctx)).toBe(false);
  });
  it('refuses acceptance against changed terms but permits rejection with an explanation', async () => {
    const db = { projectChangeRequest: { findUnique: jest.fn().mockResolvedValue({ ...row, project: { ...project, fundingGoalHalalas: 20000000n } }) } };
    expect(await op.preconditions[1]!.check(db as never, input, ctx)).toBe(false);
    expect(await op.preconditions[1]!.check(db as never, { ...input, decision: 'reject' }, ctx)).toBe(true);
  });
  it('cannot overwrite a concurrent withdrawal or review', async () => {
    const db = { projectChangeRequest: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    await expect(op.execute(db as never, input, ctx)).rejects.toBeInstanceOf(ConflictException);
  });
});
