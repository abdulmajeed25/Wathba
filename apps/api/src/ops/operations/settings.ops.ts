import { Prisma } from '@prisma/client';
import { z } from 'zod';

import {
  SETTINGS_CATALOG,
  SETTING_KEYS,
  type SettingKey,
} from '../../settings/settings.catalog';

import type { OperationDef, ReadOnlyDb } from '../operation.types';
import type { SettingsService } from '../../settings/settings.service';

/**
 * Batch OPS (registry completion) — the ONE write path into PlatformSetting.
 * SENSITIVE tier: written reason, step-up, audited. Reversible by running the
 * same operation with the previous value (compensates itself) — the dryRun
 * preview shows the effective current value (and whether it comes from the
 * DB or the catalog default) precisely so the operator can capture it before
 * changing it.
 */

export interface SettingsOpsDeps {
  settings: SettingsService;
}

/** Effective current value on the handed (read-only or tx) db client:
 *  validated DB row wins, otherwise the catalog default. */
async function effectiveValue(
  db: ReadOnlyDb,
  key: SettingKey,
): Promise<{ value: unknown; source: 'db' | 'default' }> {
  const def = SETTINGS_CATALOG[key];
  const row = await db.platformSetting.findUnique({ where: { key } });
  if (!row) return { value: def.defaultValue, source: 'default' };
  const parsed = def.schema.safeParse(row.value);
  // An invalid stored value reads as the default (mirror of SettingsService).
  return parsed.success
    ? { value: parsed.data, source: 'db' }
    : { value: def.defaultValue, source: 'default' };
}

export function settingsOps(deps: SettingsOpsDeps): Array<OperationDef<never, unknown>> {
  const updateInput = z.object({
    key: z.enum(SETTING_KEYS),
    value: z.unknown(),
  });
  type UpdateInput = z.infer<typeof updateInput>;

  // The zod issues from the LAST failed invalid-value check — surfaced in the
  // refusal reason via a getter (the registry reads reasonAr after check()).
  let lastIssuesAr = '';

  const settingsUpdate: OperationDef<UpdateInput, { key: string; value: unknown }> = {
    key: 'settings.update',
    titleAr: 'تعديل إعداد منصّة',
    descriptionAr:
      'يكتب قيمة إعداد من كتالوج الإعدادات المُنمّط (SETTINGS_CATALOG) بعد التحقق من مخططه. عكسها = تنفيذ العملية نفسها بالقيمة السابقة الظاهرة في المعاينة. مفاتيح البيئة الحرجة (تعطيل الوكلاء، تجاوز العيون الأربع، الأسرار) غير قابلة للتمثيل هنا عمداً.',
    inputSchema: updateInput,
    permission: 'settings.write',
    riskTier: 'SENSITIVE',
    reversible: true,
    compensatingKey: 'settings.update',
    requiresReason: true,
    preconditions: [
      {
        // z.enum already refuses unknown keys at the input gate; this guard
        // keeps the op safe even if the catalog and enum ever drift.
        code: 'unknown-key',
        reasonAr: 'المفتاح غير موجود في كتالوج الإعدادات',
        check: async (_db, input) => input.key in SETTINGS_CATALOG,
      },
      {
        code: 'invalid-value',
        get reasonAr(): string {
          return `القيمة المقترحة لا تطابق مخطط الإعداد${lastIssuesAr ? ` — ${lastIssuesAr}` : ''}`;
        },
        check: async (_db, input) => {
          const def = SETTINGS_CATALOG[input.key];
          if (!def) return false;
          const parsed = def.schema.safeParse(input.value);
          if (!parsed.success) {
            lastIssuesAr = parsed.error.issues
              .map((i) => `${i.path.join('.') || input.key}: ${i.message}`)
              .join('؛ ');
            return false;
          }
          return true;
        },
      },
      {
        code: 'no-change',
        reasonAr: 'القيمة المقترحة تطابق القيمة السارية — لا تغيير',
        check: async (db, input) => {
          if (!(input.key in SETTINGS_CATALOG)) return true; // unknown-key refuses first
          const current = await effectiveValue(db, input.key);
          return JSON.stringify(current.value) !== JSON.stringify(input.value);
        },
      },
    ],
    async dryRun(db, input) {
      const def = SETTINGS_CATALOG[input.key];
      const current = await effectiveValue(db, input.key);
      const sourceAr = current.source === 'db' ? 'المخزّنة في قاعدة البيانات' : 'الافتراضية (الكتالوج)';
      return {
        summaryAr: `سيتغيّر إعداد «${def.titleAr}» — القيمة السارية حالياً هي ${sourceAr}`,
        before: { key: input.key, value: current.value, source: current.source },
        after: { key: input.key, value: input.value ?? null, source: 'db' },
      };
    },
    async execute(tx, input, ctx) {
      // JSON null must be written as the Prisma.JsonNull sentinel
      // (pledges.maxHalalas: null = uncapped).
      const jsonValue =
        input.value === null ? Prisma.JsonNull : (input.value as Prisma.InputJsonValue);
      const updatedById = /^[0-9a-f-]{36}$/i.test(ctx.actor.id) ? ctx.actor.id : null;
      await tx.platformSetting.upsert({
        where: { key: input.key },
        create: { key: input.key, value: jsonValue, updatedById },
        update: { value: jsonValue, updatedById },
      });
      return { key: input.key, value: input.value ?? null };
    },
    async afterCommit() {
      // The 60s read cache must not outlive the committed change.
      deps.settings.invalidate();
    },
  };

  return [settingsUpdate] as unknown as Array<OperationDef<never, unknown>>;
}
