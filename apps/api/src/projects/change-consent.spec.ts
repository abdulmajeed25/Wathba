import { ConflictException, NotFoundException } from '@nestjs/common';
import { ChangeConsentService, consentTermsCurrent, RespondToChangeDto } from './change-consent.service';
import { campaignTerms } from './project-changes.service';
import { validate } from 'class-validator';
import { projectChangesOps } from '../ops/operations/project-changes.ops';
import type { OperationDef } from '../ops/operation.types';
import { OpsReadService } from '../ops/read/ops-read.service';

const project = { id: 'project', status: 'LIVE', fundingGoalHalalas: 100000n, durationDays: 30, deadline: new Date('2099-11-01'), releaseThresholdPct: 80 };
const row = { id: 'change', projectId: 'project', requestedById: 'creator', status: 'CONSENT_OPEN', before: campaignTerms(project as never), proposed: { fundingGoalHalalas: '50000', durationDays: 90 }, responses: [], project };
const pledge = { id: 'pledge', backerId: 'backer', projectId: 'project', project, status: 'HELD', amountHalalas: 1000n, addOnsHalalas: 200n, tierId: null, contractType: 'DONATION' };
const dto = { clientRequestId: '08b71469-fbe1-49e3-8a7a-41684b330f70', decision: 'ACCEPT' as const };
function setup() {
  const db = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    pledge: { findFirst: jest.fn().mockResolvedValue(pledge) },
    projectChangeRequest: { findUnique: jest.fn().mockResolvedValue(row), findMany: jest.fn().mockResolvedValue([row]), update: jest.fn() },
    projectChangeResponse: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockImplementation(({ data }) => ({ id: 'response', ...data })) },
  };
  const tx = { ...db, $transaction: jest.fn(async (fn: (tx: typeof db) => unknown) => fn(db)) };
  return { db, service: new ChangeConsentService(tx as never) };
}

describe('Individual change consent', () => {
  it('enforces ownership for reading and answering, even for an administrator', async () => {
    const { db, service } = setup(); db.pledge.findFirst.mockResolvedValue(null);
    await expect(service.list('admin', 'pledge')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.respond('admin', 'pledge', 'change', dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(db.projectChangeResponse.create).not.toHaveBeenCalled();
  });
  it('never counts silence as consent', async () => {
    const { service } = setup();
    expect((await service.list('backer', 'pledge')).items[0]).toMatchObject({ response: null, canRespond: true });
  });
  it('stores a pledge-specific immutable snapshot without changing money or campaign terms', async () => {
    const { db, service } = setup();
    await service.respond('backer', 'pledge', 'change', dto);
    expect(db.projectChangeResponse.create).toHaveBeenCalledWith({ data: expect.objectContaining({ requestId: 'change', pledgeId: 'pledge', decision: 'ACCEPT',
      pledgeSnapshot: expect.objectContaining({ backerId: 'backer', amountHalalas: '1000', addOnsHalalas: '200', before: row.before, proposed: row.proposed }) }) });
    expect(db.projectChangeRequest.update).not.toHaveBeenCalled();
  });
  it.each(['WITHDRAWN', 'SUBMITTED', 'REJECTED', 'ACCEPTED_FOR_PREPARATION'])('rejects a response to %s', async status => {
    const { db, service } = setup(); db.projectChangeRequest.findUnique.mockResolvedValue({ ...row, status });
    await expect(service.respond('backer', 'pledge', 'change', dto)).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejects a request attached to a different campaign', async () => {
    const { db, service } = setup(); db.projectChangeRequest.findUnique.mockResolvedValue({ ...row, projectId: 'other' });
    await expect(service.respond('backer', 'pledge', 'change', dto)).rejects.toBeInstanceOf(NotFoundException);
  });
  it.each(['REFUNDED', 'FAILED', 'CAPTURE_GRACE', 'DISPUTED'])('does not accept a decision on a %s pledge', async status => {
    const { db, service } = setup(); db.pledge.findFirst.mockResolvedValue({ ...pledge, status });
    await expect(service.respond('backer', 'pledge', 'change', dto)).rejects.toBeInstanceOf(ConflictException);
  });
  it('replays an identical request but rejects reuse for another decision', async () => {
    const { db, service } = setup();
    db.projectChangeResponse.findUnique.mockResolvedValue({ id: 'saved', requestId: 'change', decision: 'ACCEPT', createdAt: new Date() });
    expect((await service.respond('backer', 'pledge', 'change', dto)).id).toBe('saved');
    await expect(service.respond('backer', 'pledge', 'change', { ...dto, decision: 'DECLINE' })).rejects.toBeInstanceOf(ConflictException);
    expect(db.projectChangeResponse.create).not.toHaveBeenCalled();
  });
  it('allows a changed decision while preserving the previous record and response order', async () => {
    const { db, service } = setup();
    const priorDate = new Date(Date.now() + 1000);
    db.projectChangeResponse.findFirst.mockResolvedValue({ createdAt: priorDate });
    const saved = await service.respond('backer', 'pledge', 'change', { ...dto, decision: 'DECLINE' });
    expect(saved.decision).toBe('DECLINE');
    expect(saved.createdAt.getTime()).toBe(priorDate.getTime() + 1);
  });
  it('rejects stale terms, an elapsed deadline and a settled campaign', () => {
    for (const patch of [{ fundingGoalHalalas: 200000n }, { durationDays: 31 }, { releaseThresholdPct: 90 }, { deadline: new Date(0) }, { status: 'FUNDED' }]) {
      expect(consentTermsCurrent(row as never, { ...project, ...patch } as never)).toBe(false);
    }
  });
  it('validates explicit decisions and request identity', async () => {
    expect(await validate(Object.assign(new RespondToChangeDto(), dto))).toHaveLength(0);
    expect((await validate(Object.assign(new RespondToChangeDto(), dto, { decision: 'silent' }))).length).toBeGreaterThan(0);
  });
});

describe('Opening consent', () => {
  const op = projectChangesOps()[1] as unknown as OperationDef<{ projectId: string; requestId: string }, unknown>;
  const input = { projectId: 'project', requestId: 'change' };
  const ctx = { actor: { id: 'reviewer', type: 'HUMAN' as const, roles: ['ADMIN'] } };
  it('requires sensitive review permission and checks state again under transaction locks', async () => {
    const { db } = setup();
    expect(op).toMatchObject({ permission: 'projects.review', riskTier: 'SENSITIVE', requiresReason: true });
    await expect(op.execute(db as never, input, ctx)).rejects.toBeInstanceOf(ConflictException);
    expect(db.projectChangeRequest.update).not.toHaveBeenCalled();
    db.projectChangeRequest.findUnique.mockResolvedValue({ ...row, status: 'ACCEPTED_FOR_PREPARATION' });
    await expect(op.execute(db as never, input, ctx)).resolves.toMatchObject({ status: 'CONSENT_OPEN' });
    expect(await op.preconditions[0]!.check(db as never, input, { actor: { ...ctx.actor, id: 'creator' } })).toBe(false);
  });
});

describe('Operator view of individual decisions', () => {
  it('keeps non-response separate and hides identity and agreement snapshots', async () => {
    const db = { projectChangeRequest: { findUnique: jest.fn().mockResolvedValue(row) }, pledge: { findMany: jest.fn().mockResolvedValue([
      { ...pledge, backerNo: 1, changeResponses: [], backer: { email: 'private@example.test' } },
    ]) } };
    const service = new OpsReadService(db as never, {} as never, {} as never);
    const page = await service.projectChangeResponses('change', { limit: 25 });
    expect(page.items[0]).toMatchObject({ decision: null, responseCurrent: false, amountHalalas: '1200', backerNo: 1 });
    expect(page.items[0]).not.toHaveProperty('backerId');
    expect(JSON.stringify(page)).not.toContain('private@example.test');
  });

  it('marks an answer historical when the pledge snapshot no longer matches', async () => {
    const snapshot = { amountHalalas: '1000', addOnsHalalas: '200', status: 'HELD', tierId: null, contractType: 'DONATION' };
    const item = { ...pledge, backerNo: 1, changeResponses: [{ decision: 'ACCEPT', createdAt: new Date(), pledgeSnapshot: snapshot }] };
    const db = { projectChangeRequest: { findUnique: jest.fn().mockResolvedValue(row) }, pledge: { findMany: jest.fn().mockResolvedValue([item]) } };
    const service = new OpsReadService(db as never, {} as never, {} as never);
    expect((await service.projectChangeResponses('change', {})).items[0]?.responseCurrent).toBe(true);
    db.pledge.findMany.mockResolvedValue([{ ...item, amountHalalas: 1500n }]);
    expect((await service.projectChangeResponses('change', {})).items[0]).toMatchObject({ decision: 'ACCEPT', responseCurrent: false });
  });
});
