import { ProjectVisibilityGuard } from './project-visibility.guard';
import { OptionalJwtAuthGuard } from '../identity/optional-jwt-auth.guard';

describe('private campaign read boundary', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const owner = 'owner';
  const context = (params: Record<string, string | undefined>, user?: string, method = 'GET') => ({
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ method, path: `/v1/projects/${id}/reward-tiers`, params, user: user ? { sub: user } : undefined }) }),
  }) as never;
  beforeEach(() => jest.spyOn(OptionalJwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true));
  afterEach(() => jest.restoreAllMocks());
  it.each(['DRAFT', 'UNDER_REVIEW'])('rejects anonymous and non-owner reads for %s using either route parameter', async (status) => {
    const guard = new ProjectVisibilityGuard({ project: { findUnique: async () => ({ status, hiddenAt: null, createdById: owner }) } } as never);
    for (const params of [{ id }, { projectId: id }]) {
      await expect(guard.canActivate(context(params))).rejects.toThrow('project not found');
      await expect(guard.canActivate(context(params, 'other'))).rejects.toThrow('project not found');
      await expect(guard.canActivate(context(params, owner))).resolves.toBe(true);
    }
  });
  it('allows a public launched campaign but conceals a moderated one', async () => {
    const findUnique = jest.fn().mockResolvedValue({ status: 'LIVE', hiddenAt: null, createdById: owner });
    const guard = new ProjectVisibilityGuard({ project: { findUnique } } as never);
    await expect(guard.canActivate(context({ projectId: id }))).resolves.toBe(true);
    findUnique.mockResolvedValue({ status: 'LIVE', hiddenAt: new Date(), createdById: owner });
    await expect(guard.canActivate(context({ projectId: id }))).rejects.toThrow('project not found');
  });
  it('opens management writes only after initial approval, including for the owner', async () => {
    const findUnique = jest.fn().mockResolvedValue({ status: 'DRAFT', createdById: owner, hiddenAt: null, applicationApprovedAt: null });
    const guard = new ProjectVisibilityGuard({ project: { findUnique } } as never);
    await expect(guard.canActivate(context({ projectId: id }, owner, 'POST'))).rejects.toThrow('بعد اعتماد');
    findUnique.mockResolvedValue({ status: 'DRAFT', createdById: owner, hiddenAt: null, applicationApprovedAt: new Date() });
    await expect(guard.canActivate(context({ projectId: id }, owner, 'POST'))).resolves.toBe(true);
    await expect(guard.canActivate(context({ projectId: id }, 'other', 'POST'))).rejects.toThrow('project not found');
  });
});
