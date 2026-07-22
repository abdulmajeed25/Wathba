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

  // Batch OPS (Unit 6) — the expanded policy-knob catalog.
  describe('Unit 6 policy knobs', () => {
    it('exposes each new key at its behaviour-preserving default', async () => {
      const { svc } = build([]);
      await expect(svc.get('projects.fundingGoalMinHalalas')).resolves.toBe(10_000);
      await expect(svc.get('projects.durationSelfServeMaxDays')).resolves.toBe(60);
      await expect(svc.get('projects.durationHardMaxDays')).resolves.toBe(120);
      await expect(svc.get('moderation.blockedWords')).resolves.toEqual(
        expect.arrayContaining(['viagra', 'casino', 'porn', 'xxx']),
      );
      await expect(svc.get('identity.consentVersion')).resolves.toBe(
        process.env.CONSENT_VERSION ?? '2026-06-28',
      );
      await expect(svc.get('security.opsTotpRequired')).resolves.toBe(
        process.env.OPS_TOTP_REQUIRED === '1',
      );
    });

    it('returns a valid DB override and rejects schema-invalid rows', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const { svc } = build([
        { key: 'projects.fundingGoalMinHalalas', value: 5_000_000 },
        { key: 'projects.durationHardMaxDays', value: 90 },
        { key: 'moderation.blockedWords', value: ['spam', 'scam'] },
        { key: 'identity.consentVersion', value: '2027-01-01' },
        { key: 'security.opsTotpRequired', value: true },
      ]);
      await expect(svc.get('projects.fundingGoalMinHalalas')).resolves.toBe(5_000_000);
      await expect(svc.get('projects.durationHardMaxDays')).resolves.toBe(90);
      await expect(svc.get('moderation.blockedWords')).resolves.toEqual(['spam', 'scam']);
      await expect(svc.get('identity.consentVersion')).resolves.toBe('2027-01-01');
      await expect(svc.get('security.opsTotpRequired')).resolves.toBe(true);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('a poisoned row degrades to the default (loud log)', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const { svc } = build([
        { key: 'projects.durationHardMaxDays', value: -5 }, // fails .positive()
        { key: 'moderation.blockedWords', value: 'not-an-array' }, // fails z.array
        { key: 'security.opsTotpRequired', value: 'yes' }, // fails z.boolean
      ]);
      await expect(svc.get('projects.durationHardMaxDays')).resolves.toBe(120);
      await expect(svc.get('moderation.blockedWords')).resolves.toEqual(
        SETTINGS_CATALOG['moderation.blockedWords'].defaultValue,
      );
      await expect(svc.get('security.opsTotpRequired')).resolves.toBe(
        process.env.OPS_TOTP_REQUIRED === '1',
      );
      expect(errorSpy).toHaveBeenCalled();
    });
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
