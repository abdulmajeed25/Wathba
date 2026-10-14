import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProjectsService } from './projects.service';

describe('Campaign edits cannot race publication', () => {
  const original = { id: 'project', createdById: 'creator', status: 'DRAFT', updatedAt: new Date(), fundingGoalHalalas: 100000n };
  function setup() {
    let current = { ...original };
    const db = { project: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...original })),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        if (Object.entries(where).some(([key, value]) => current[key as keyof typeof current] !== value)) {
          throw new Prisma.PrismaClientKnownRequestError('Record no longer matches', { code: 'P2025', clientVersion: 'test' });
        }
        current = { ...current, ...data }; return current;
      }),
    } };
    const settings = { get: jest.fn(async (key: string) => key.endsWith('MinHalalas') ? 1000 : null) };
    return { db, settings, service: new ProjectsService(db as never, {} as never, settings as never, {} as never),
      change: (patch: Partial<typeof original>) => { current = { ...current, ...patch }; }, read: () => current };
  }
  it('refuses an old draft save after the campaign goes live', async () => {
    const { service, settings, change, read } = setup();
    settings.get.mockImplementation(async key => { change({ status: 'LIVE' }); return key.endsWith('MinHalalas') ? 1000 : null; });
    await expect(service.update('creator', 'project', { fundingGoalHalalas: 50000 } as never)).rejects.toBeInstanceOf(ConflictException);
    expect(read().fundingGoalHalalas).toBe(100000n);
  });
  it('refuses a stale content save when another edit has committed', async () => {
    const { service, change } = setup(); change({ updatedAt: new Date(original.updatedAt.getTime() + 1) });
    await expect(service.update('creator', 'project', { titleAr: 'عنوان جديد' } as never)).rejects.toBeInstanceOf(ConflictException);
  });
  it('preserves presentation-only editing when status changes', async () => {
    const { service, change, db } = setup(); change({ status: 'LIVE' });
    await expect(service.update('creator', 'project', { cardMedia: 'IMAGE' } as never)).resolves.toMatchObject({ cardMedia: 'IMAGE' });
    expect(db.project.update.mock.calls[0]?.[0].where).toEqual({ id: 'project', createdById: 'creator' });
  });
});
