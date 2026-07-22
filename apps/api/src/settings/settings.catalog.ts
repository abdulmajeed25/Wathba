import { z } from 'zod';
import { NotificationKind } from '@prisma/client';

/**
 * OPS-GAPS Y2 — the transactional-critical / account-lifecycle / verification
 * notification kinds that can NEVER be silenced via `notifications.disabledKinds`.
 * These carry money-state (a charge, a refund, a payout, a campaign outcome) or
 * an account/verification decision the recipient must always receive. The lock
 * is enforced structurally: the zod schema of `notifications.disabledKinds`
 * rejects any list containing one of these, so `settings.update` (the sole write
 * path) cannot persist a disabled-set that includes a locked kind, and
 * NotificationsService.create() applies the same set as defence-in-depth.
 */
export const LOCKED_NOTIFICATION_KINDS: readonly NotificationKind[] = [
  NotificationKind.PLEDGE_RECEIVED,
  NotificationKind.REFUND_COMPLETED,
  NotificationKind.PAYOUT_SENT,
  NotificationKind.PROJECT_FUNDED,
  NotificationKind.PROJECT_FAILED,
  NotificationKind.ACCOUNT_SUSPENDED,
  NotificationKind.ACCOUNT_REACTIVATED,
  NotificationKind.APPEAL_DECIDED,
  NotificationKind.SUPPLIER_VERIFIED,
] as const;

const LOCKED_NOTIFICATION_KIND_SET = new Set<string>(LOCKED_NOTIFICATION_KINDS);

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
  'projects.fundingGoalMinHalalas': {
    key: 'projects.fundingGoalMinHalalas',
    titleAr: 'الحد الأدنى لهدف التمويل (هللة)',
    descriptionAr:
      'أقل هدف تمويل يُقبل عند إنشاء مشروع. الافتراضي ١٠٬٠٠٠ هللة (١٠٠ ريال) — نفس حدّ التحقق الحالي في مخطط الإدخال. رفع القيمة يرفض المشاريع الجديدة ذات الهدف الأصغر فوراً دون مساس بالمشاريع القائمة.',
    schema: z.number().int().positive(),
    defaultValue: 10_000,
  },
  'projects.durationSelfServeMaxDays': {
    key: 'projects.durationSelfServeMaxDays',
    titleAr: 'سقف المدة ذاتية الخدمة (أيام)',
    descriptionAr:
      'أطول مدة حملة تُعتمد ذاتياً دون منح صريح؛ ما يتجاوزها (حتى السقف الأقصى) يتطلب اعتماد approvedDurationDays عند المراجعة. الافتراضي ٦٠ يوماً. ملاحظة: يُنفَّذ هذا الفحص عند اعتماد المراجعة (خارج نطاق هذه الوحدة) — المفتاح معروض وقابل للتحرير هنا.',
    schema: z.number().int().positive(),
    defaultValue: 60,
  },
  'projects.durationHardMaxDays': {
    key: 'projects.durationHardMaxDays',
    titleAr: 'السقف الأقصى لمدة الحملة (أيام)',
    descriptionAr:
      'أقصى مدة حملة مسموح بها إطلاقاً؛ ما يتجاوزها محظور (سجل LONG_DURATION). الافتراضي ١٢٠ يوماً — نفس حدّ التحقق الحالي في مخطط الإدخال. خفض القيمة يرفض إنشاء مشاريع بمدة أطول فوراً.',
    schema: z.number().int().positive(),
    defaultValue: 120,
  },
  'moderation.blockedWords': {
    key: 'moderation.blockedWords',
    titleAr: 'قائمة الكلمات المحظورة (الإشراف)',
    descriptionAr:
      'كلمات تُرفض التعليقات المحتوية عليها. الافتراضي هو قائمة البذرة الحالية مدموجة مع متغير البيئة BLOCKED_WORDS. القيمة المخزّنة تُدمج مع قائمة البيئة (تبقى مجموعة فائقة) فلا تُضعف الحجب القائم.',
    schema: z.array(z.string()),
    defaultValue: ['viagra', 'casino', 'porn', 'xxx']
      .concat((process.env.BLOCKED_WORDS ?? '').split(',').map((w) => w.trim().toLowerCase()))
      .filter(Boolean),
  },
  'identity.consentVersion': {
    key: 'identity.consentVersion',
    titleAr: 'إصدار الموافقة (PDPL)',
    descriptionAr:
      'وسم إصدار الموافقة الذي يُختم على حساب المستخدم عند التسجيل. الافتراضي من متغير البيئة CONSENT_VERSION أو «2026-06-28». تغييره يبدأ ختم الإصدار الجديد على التسجيلات اللاحقة فقط.',
    schema: z.string().min(1),
    defaultValue: process.env.CONSENT_VERSION ?? '2026-06-28',
  },
  'appeals.slaHours': {
    key: 'appeals.slaHours',
    titleAr: 'مهلة الرد على التظلّمات (ساعات)',
    descriptionAr:
      'المهلة (بالساعات) للبتّ في تظلّم مفتوح (SUBMITTED/UNDER_REVIEW) قبل اعتباره متأخراً. الافتراضي ٤٨ ساعة. تجاوزها يرفع علامة «متأخر» في قائمة التظلّمات وينشئ تنبيهاً في مركز الأنومالي (تحذيري، ويصبح حرجاً عند تجاوز ضعف المهلة).',
    schema: z.number().int().positive(),
    defaultValue: 48,
  },
  'security.opsTotpRequired': {
    key: 'security.opsTotpRequired',
    titleAr: 'إلزام التحقق الثنائي لمركز العمليات',
    descriptionAr:
      'عند التفعيل يُلزَم كل مشرف بالتحقق الثنائي (TOTP) للدخول إلى مركز العمليات. متغير البيئة OPS_TOTP_REQUIRED يبقى تجاوزاً: «1» يُلزم دائماً، «0» يعطّل دائماً (مخرج التطوير/الاختبار)، وعند غياب التجاوز يُفعِّل هذا المفتاح الإلزام. الافتراضي مشتق من OPS_TOTP_REQUIRED=1.',
    schema: z.boolean(),
    defaultValue: process.env.OPS_TOTP_REQUIRED === '1',
  },
  // OPS-GAPS Y2 — per-notification-kind enablement. An operator may silence
  // engagement/low-stakes kinds by listing their enum names here; the schema
  // itself rejects any locked (transactional/account/verification) kind, so a
  // critical notice can never be turned off from the ops surface.
  'notifications.disabledKinds': {
    key: 'notifications.disabledKinds',
    titleAr: 'أنواع الإشعارات المُعطَّلة',
    descriptionAr:
      'قائمة بأسماء أنواع الإشعارات (NotificationKind) التي يُمنع إنشاؤها. الافتراضي فارغ (كل الأنواع مفعّلة). لا يمكن إدراج نوع حرج (معاملات/حساب/تحقّق) — يرفض المخطط الحفظ. تعطيل نوع يوقف إنشاء إشعاراته الجديدة فوراً دون مساس بالقائمة.',
    schema: z
      .array(z.string())
      .refine((kinds) => kinds.every((k) => !LOCKED_NOTIFICATION_KIND_SET.has(k)), {
        message:
          'لا يمكن تعطيل نوع إشعار حرج (معاملات/حساب/تحقّق) — أزِل الأنواع المحمية من القائمة',
      }),
    defaultValue: [] as string[],
  },
  // OPS-GAPS Y2 — funding grace window (hours). Default 72 == current code
  // (EscrowService.GRACE_MS + the BNPL deferred-initiation window). Read as a
  // number of hours and converted to ms at the consumption sites.
  'funding.graceWindowHours': {
    key: 'funding.graceWindowHours',
    titleAr: 'نافذة المهلة للسحب المتعثّر (ساعات)',
    descriptionAr:
      'المدة (بالساعات) التي يُمنحها الداعم لتحديث وسيلة الدفع بعد تعثّر السحب أو لإكمال التقسيط المؤجّل قبل اعتبار التعهد فاشلاً (FAILED_CAPTURE). الافتراضي ٧٢ ساعة — نفس السلوك الحالي.',
    schema: z.number().int().positive(),
    defaultValue: 72,
  },
  // OPS-GAPS Y2 — card re-authorization age (days). Default from
  // REAUTH_AFTER_DAYS env (~6), matching ReauthScheduler.
  'funding.reauthAfterDays': {
    key: 'funding.reauthAfterDays',
    titleAr: 'عمر إعادة التفويض للبطاقة (أيام)',
    descriptionAr:
      'عمر تفويض البطاقة (بالأيام) الذي يُعاد بعده التفويض للحملات الطويلة. الافتراضي من متغير البيئة REAUTH_AFTER_DAYS (≈٦ أيام). خفض القيمة يعيد التفويض أبكر.',
    schema: z.number().int().positive(),
    defaultValue: Number(process.env.REAUTH_AFTER_DAYS ?? 6),
  },
  // OPS-GAPS Y2 — cumulative pause cap per campaign (days). Default 7 ==
  // current FundingService.PAUSE_CAP_MS.
  'funding.pauseCapDays': {
    key: 'funding.pauseCapDays',
    titleAr: 'سقف الإيقاف المؤقت للحملة (أيام)',
    descriptionAr:
      'إجمالي المدة (بالأيام) المسموح بإيقاف الحملة خلالها تراكمياً. الافتراضي ٧ أيام — نفس السلوك الحالي. تجاوزه يمنع إيقافاً جديداً.',
    schema: z.number().int().positive(),
    defaultValue: 7,
  },
  // OPS-GAPS Y2 — DB-backed maintenance mode. Was env-only (MAINTENANCE_MODE);
  // now an operator can flip it without a deploy. The public GET
  // /v1/platform/status exposes it, and the web middleware rewrites every
  // request to /maintenance while it is on (the env var stays a hard override
  // for infra-level lockdowns).
  'platform.maintenanceMode': {
    key: 'platform.maintenanceMode',
    titleAr: 'وضع الصيانة',
    descriptionAr:
      'عند التفعيل تُحوَّل كل زيارة للموقع العام إلى صفحة الصيانة (يبقى مركز العمليات وواجهة الـAPI عاملَين). الافتراضي مُطفأ. متغير البيئة MAINTENANCE_MODE=1 يبقى تجاوزاً صارماً للإغلاق على مستوى البنية.',
    schema: z.boolean(),
    defaultValue: process.env.MAINTENANCE_MODE === '1',
  },
} satisfies Record<string, SettingDef<unknown>>;

export type SettingKey = keyof typeof SETTINGS_CATALOG;

/** The effective value type of a catalog key (from its zod schema). */
export type SettingValue<K extends SettingKey> = z.infer<
  (typeof SETTINGS_CATALOG)[K]['schema']
>;

/** Non-empty tuple of keys — feeds z.enum in the settings.update input. */
export const SETTING_KEYS = Object.keys(SETTINGS_CATALOG) as [SettingKey, ...SettingKey[]];
