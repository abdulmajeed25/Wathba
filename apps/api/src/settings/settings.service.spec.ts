import { Logger } from '@nestjs/common';

import { SettingsService } from './settings.service';
import { SETTINGS_CATALOG } from './settings.catalog';

import type { PrismaService } from '../prisma/prisma.service';

/**
 * Batch OPS (registry completion) — SettingsService contract:
 *  · no row → catalog default
 *  · valid row → DB value wins
 *  · schema-invalid row → loud log + default (a poisoned setting must
 *    degrade to known-good behavior, never throw into the pledge path)
 *  · 60s memoisation + invalidate()
 */

function build(rows: Array<{ key: string; value: unknown }> = []) {
  const prisma = {
    platformSetting: {
      findMany: jest.fn().mockResolvedValue(rows),
    },
  };
  return { svc: new SettingsService(prisma as unknown as PrismaService), prisma };
}

describe('SettingsService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('falls back to the catalog default when no row exists', async () => {
    const { svc } = build([]);
    await expect(svc.get('pledges.minHalalas')).resolves.toBe(
      SETTINGS_CATALOG['pledges.minHalalas'].defaultValue,
    );
    await expect(svc.get('pledges.maxHalalas')).resolves.toBeNull();
    await expect(svc.get('payments.methodsEnabled')).resolves.toEqual({ card: true, bnpl: true });
    await expect(svc.get('support.inboxEmail')).resolves.toBe('support@wathba.sa');
  });

  it('returns the DB value when a valid row exists', async () => {
    const { svc } = build([
      { key: 'pledges.minHalalas', value: 2500 },
      { key: 'payments.methodsEnabled', value: { card: true, bnpl: false } },
    ]);
    await expect(svc.get('pledges.minHalalas')).resolves.toBe(2500);
    await expect(svc.get('payments.methodsEnabled')).resolves.toEqual({
      card: true,
      bnpl: false,
    });
  });

  it('a schema-invalid row falls back to the default and logs loudly', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { svc } = build([{ key: 'pledges.minHalalas', value: 'not-a-number' }]);
    await expect(svc.get('pledges.minHalalas')).resolves.toBe(
      SETTINGS_CATALOG['pledges.minHalalas'].defaultValue,
    );
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('pledges.minHalalas'));
  });

  it('memoises rows for the TTL and re-reads after invalidate()', async () => {
    const { svc, prisma } = build([{ key: 'pledges.minHalalas', value: 3000 }]);
    await svc.get('pledges.minHalalas');
    await svc.get('support.inboxEmail');
    expect(prisma.platformSetting.findMany).toHaveBeenCalledTimes(1);

    svc.invalidate();
    await svc.get('pledges.minHalalas');
    expect(prisma.platformSetting.findMany).toHaveBeenCalledTimes(2);
  });

  it('getAll() labels each key with its effective value + source', async () => {
    const { svc } = build([{ key: 'pledges.maxHalalas', value: 500_000 }]);
    const all = await svc.getAll();
    const byKey = new Map(all.map((s) => [s.key, s]));
    expect(byKey.get('pledges.maxHalalas')).toMatchObject({ value: 500_000, source: 'db' });
    expect(byKey.get('pledges.minHalalas')).toMatchObject({
      value: SETTINGS_CATALOG['pledges.minHalalas'].defaultValue,
      source: 'default',
    });
    expect(all).toHaveLength(Object.keys(SETTINGS_CATALOG).length);
  });
});
