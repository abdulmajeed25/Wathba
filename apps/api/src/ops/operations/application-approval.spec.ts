import { projectsOps } from './projects.ops';
import type { OperationDef } from '../operation.types';

describe('application approval is separate from campaign publication', () => {
  const projectId = '11111111-1111-4111-8111-111111111111';
  const row = { id: projectId, createdById: 'creator', titleAr: 'حملة', status: 'UNDER_REVIEW', applicationApprovedAt: null as Date | null, durationDays: 30, scheduledLaunchAt: null as Date | null };
  const tx = { project: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() } };
  const deps = { prisma: { user: { findUnique: async () => null }, project: { findUnique: async () => row } }, notifications: { create: jest.fn(), fanOutProjectPublished: jest.fn() }, email: {}, settings: {} };
  const op = projectsOps(deps as never).find(x => x.key === 'projects.review.approve')! as unknown as OperationDef<{ projectId: string }, { id: string; status: string }>;
  beforeEach(() => {
    jest.clearAllMocks();
    row.applicationApprovedAt = null; row.scheduledLaunchAt = null;
    tx.project.findUnique.mockResolvedValue(row);
    tx.project.findUniqueOrThrow.mockResolvedValue(row);
    tx.project.update.mockImplementation(async ({ data }) => ({ ...row, ...data }));
  });
  it('first approval opens preparation, without a publication date or follower announcement', async () => {
    const result = await op.execute(tx as never, { projectId }, {} as never);
    expect(result.status).toBe('DRAFT');
    const write = tx.project.update.mock.calls[0][0];
    expect(write.where).toMatchObject({ status: 'UNDER_REVIEW', applicationApprovedAt: null });
    expect(write.data.applicationApprovedAt).toBeInstanceOf(Date);
    expect(write.data.publishedAt).toBeUndefined();
    await op.afterCommit!(result, { projectId }, {} as never);
    expect(deps.notifications.fanOutProjectPublished).not.toHaveBeenCalled();
    expect(deps.notifications.create).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ preparationOnly: true }) }));
  });
  it('second approval publishes only an already accepted application and announces it', async () => {
    row.applicationApprovedAt = new Date();
    const result = await op.execute(tx as never, { projectId }, {} as never);
    expect(result.status).toBe('LIVE');
    expect(tx.project.update.mock.calls[0][0].where).toMatchObject({ status: 'UNDER_REVIEW', applicationApprovedAt: { not: null } });
    await op.afterCommit!(result, { projectId }, {} as never);
    expect(deps.notifications.fanOutProjectPublished).toHaveBeenCalledWith(projectId);
  });
  it('keeps a future launch scheduled after publication approval', async () => {
    row.applicationApprovedAt = new Date(); row.scheduledLaunchAt = new Date(Date.now() + 86_400_000);
    const result = await op.execute(tx as never, { projectId }, {} as never);
    expect(result.status).toBe('SCHEDULED');
    await op.afterCommit!(result, { projectId }, {} as never);
    expect(deps.notifications.fanOutProjectPublished).not.toHaveBeenCalled();
  });
});
