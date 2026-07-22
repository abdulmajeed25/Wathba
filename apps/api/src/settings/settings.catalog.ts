import { z } from 'zod';

/**
 * Batch OPS (registry completion) — the typed catalog of DB-backed platform
 * settings. One `PlatformSetting` row per key; the ONLY write path is the
 * governed `settings.update` operation (SENSITIVE — written reason, audited,
 * reversible by writing the previous value back).
 *
 * Deliberately small in v1:
 *  · Fees/commission stay CODE-owned in `config/fees.ts` — the fee structure
 *    is pinned to provider contracts (ZATCA invoicing, payout netting) and
 *    must not drift from an ops screen until those contracts settle.
 *  · Env-only kill-switches (AGENTS_ENABLED, FOUR_EYES_MONEY_OVERRIDE) and
 *    secrets are NOT representable here per the plan — a DB row must never
 *    be able to re-enable agents or weaken four-eyes.
 */

export interface SettingDef<T = unknown> {
  key: string;
  titleAr: string;
  descriptionAr: string;
  schema: z.ZodType<T>;
  defaultValue: T;
}

export const SETTINGS_CATALOG = {
  'pledges.minHalalas': {
    key: 'pledges.minHalalas',
    titleAr: 'الحد الأدنى للتعهد (هللة)',
    descriptionAr:
      'أقل مبلغ يُقبل لتعهد بدون مكافأة. الافتراضي ١٠٠٠ هللة (١٠ ريالات) — متغير البيئة MIN_PLEDGE_HALALAS يبقى بديلاً للافتراضي عند غياب صف قاعدة البيانات.',
    schema: z.number().int().positive(),
    // The pre-existing env override survives as the catalog default; a DB
    // row (written via settings.update) takes precedence over both.
    defaultValue: Number(process.env.MIN_PLEDGE_HALALAS ?? 1000),
  },
  'pledges.maxHalalas': {
    key: 'pledges.maxHalalas',
    titleAr: 'الحد الأقصى للتعهد (هللة)',
    descriptionAr: 'سقف مبلغ التعهد الواحد. null = بلا سقف (الافتراضي).',
    schema: z.number().int().positive().nullable(),
    defaultValue: null as number | null,
  },
  'payments.methodsEnabled': {
    key: 'payments.methodsEnabled',
    titleAr: 'وسائل الدفع المفعّلة',
    descriptionAr:
      'مفاتيح تشغيل وسائل الدفع عند إنشاء التعهد: البطاقة (card) والتقسيط (bnpl — تابي/تمارا). إيقاف وسيلة يرفض التعهدات الجديدة بها فوراً دون مساس بالتعهدات القائمة.',
    schema: z.object({ card: z.boolean(), bnpl: z.boolean() }),
    defaultValue: { card: true, bnpl: true },
  },
  'support.inboxEmail': {
    key: 'support.inboxEmail',
    titleAr: 'بريد صندوق الدعم',
    descriptionAr: 'العنوان الذي تُحوَّل إليه تذاكر «اتصل بنا» الواردة.',
    schema: z.string().email(),
    defaultValue: 'support@wathba.sa',
  },
} satisfies Record<string, SettingDef<unknown>>;

export type SettingKey = keyof typeof SETTINGS_CATALOG;

/** The effective value type of a catalog key (from its zod schema). */
export type SettingValue<K extends SettingKey> = z.infer<
  (typeof SETTINGS_CATALOG)[K]['schema']
>;

/** Non-empty tuple of keys — feeds z.enum in the settings.update input. */
export const SETTING_KEYS = Object.keys(SETTINGS_CATALOG) as [SettingKey, ...SettingKey[]];
