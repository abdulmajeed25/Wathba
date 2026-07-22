import { createHash, randomBytes } from 'node:crypto';
import { NotificationKind, PledgeStatus, ProjectStatus } from '@prisma/client';
import { z } from 'zod';
import type { UserRole } from '@prisma/client';

import type { OperationDef } from '../operation.types';
import { MONEY_PERMISSIONS } from '../permissions';
import { UNMASKABLE_FIELDS, maskEmail, maskPhone } from '../pii';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { EmailService } from '../../email/email.service';
import type { PdplService } from '../../identity/pdpl.service';

/**
 * OPS Part 0 — identity operations (SENSITIVE tier: written reason always,
 * step-up enforced since Part 1).
 *
 * Part 2 adds: users.role.revoke (the census's additive-only gap),
 * users.ops-role.grant/revoke (RBAC grants — users.roles.assign, held by
 * OWNER only via the seeded matrix; granting a money role to a SECOND user
 * flips FOUR_EYES_MONEY on automatically and the dryRun preview says so),
 * and users.pii.unmask (PDPL: revealing a masked field is itself an audited
 * operation; the execution ledger stores a redacted result, never the value).
 *
 * Batch OPS (registry completion) adds the account lifecycle: suspend/
 * reactivate (session-killing, notified), force-password-reset (the raw
 * token goes ONLY to the user's email — the ops actor never sees it),
 * sessions.revoke, and the PDPL pair (export/erase) that fronts
 * PdplService so a data-subject request is an audited operation like
 * everything else. These need post-commit side effects, so the factory now
 * takes a deps object (type-only imports — governance RULE 2).
 */

export interface UsersOpsDeps {
  prisma: PrismaService;
  notifications: NotificationsService;
  email: EmailService;
  pdpl: PdplService;
}

/** ops.module.ts still calls usersOps() bare until the coordinator wires the
 *  deps; the original six ops never touch deps, and any lifecycle afterCommit
 *  reached before wiring fails loudly instead of silently no-oping. */
const UNWIRED_DEPS = new Proxy(
  {},
  {
    get(_t, prop) {
      throw new Error(`usersOps deps not wired yet (accessed .${String(prop)})`);
    },
  },
) as UsersOpsDeps;

const grantInput = z.object({
  userId: z.string().uuid(),
  role: z.enum(['CREATOR', 'BACKER', 'SUPPLIER']),
});

const roleGrant: OperationDef<z.infer<typeof grantInput>, { roles: string[] }> = {
  key: 'users.role.grant',
  titleAr: 'منح دور لمستخدم',
  descriptionAr:
    'منح إضافي (idempotent) لأدوار CREATOR/BACKER/SUPPLIER. منح ADMIN غير ممكن من هنا إطلاقاً. يسري على الرمز عند تجديده.',
  inputSchema: grantInput,
  permission: 'users.lifecycle',
  riskTier: 'SENSITIVE',
  reversible: true,
  compensatingKey: 'users.role.revoke',
  requiresReason: true,
  preconditions: [
    {
      code: 'user-missing',
      reasonAr: 'المستخدم غير موجود',
      check: async (db, input) =>
        !!(await db.user.findUnique({ where: { id: input.userId }, select: { id: true } })),
    },
  ],
  async dryRun(db, input) {
    const u = await db.user.findUnique({ where: { id: input.userId }, select: { roles: true } });
    const has = u?.roles.includes(input.role as UserRole) ?? false;
    return {
      summaryAr: has
        ? `المستخدم يحمل دور ${input.role} أصلاً — لا تغيير`
        : `سيُضاف دور ${input.role} إلى المستخدم`,
      before: { roles: u?.roles ?? null },
      after: { roles: has ? u?.roles : [...(u?.roles ?? []), input.role] },
    };
  },
  async execute(tx, input) {
    const user = await tx.user.findUniqueOrThrow({ where: { id: input.userId } });
    const roles = user.roles.includes(input.role as UserRole)
      ? user.roles
      : [...user.roles, input.role as UserRole];
    const updated = await tx.user.update({ where: { id: input.userId }, data: { roles } });
    return { roles: updated.roles as string[] };
  },
};

const forceVerifyInput = z.object({ userId: z.string().uuid() });

const kycForceVerify: OperationDef<z.infer<typeof forceVerifyInput>, { verified: true }> = {
  key: 'users.kyc.force-verify',
  titleAr: 'تفعيل تحقق نفاذ يدوياً',
  descriptionAr:
    'يضبط nafathVerified يدوياً لمن تعذّر عليه التحقق الآلي — يفتح النشر والدعم فوق الحد.',
  inputSchema: forceVerifyInput,
  permission: 'users.lifecycle',
  riskTier: 'SENSITIVE',
  reversible: false,
  requiresReason: true,
  preconditions: [
    {
      code: 'user-missing',
      reasonAr: 'المستخدم غير موجود',
      check: async (db, input) =>
        !!(await db.user.findUnique({ where: { id: input.userId }, select: { id: true } })),
    },
    {
      code: 'already-verified',
      reasonAr: 'المستخدم موثّق عبر نفاذ أصلاً',
      check: async (db, input) => {
        const u = await db.user.findUnique({
          where: { id: input.userId },
          select: { nafathVerified: true },
        });
        return u?.nafathVerified === false;
      },
    },
  ],
  async dryRun(db, input) {
    const u = await db.user.findUnique({
      where: { id: input.userId },
      select: { name: true, nafathVerified: true },
    });
    return {
      summaryAr: `سيُفعَّل توثيق نفاذ يدوياً للمستخدم «${u?.name ?? input.userId}»`,
      before: { nafathVerified: u?.nafathVerified ?? null },
      after: { nafathVerified: true },
    };
  },
  async execute(tx, input) {
    await tx.user.update({
      where: { id: input.userId },
      data: { nafathVerified: true, nafathVerifiedAt: new Date() },
    });
    return { verified: true as const };
  },
};

/* ── Part 2 ──────────────────────────────────────────────────────────────── */

const revokeInput = z.object({
  userId: z.string().uuid(),
  role: z.enum(['CREATOR', 'BACKER', 'SUPPLIER']),
});

const roleRevoke: OperationDef<z.infer<typeof revokeInput>, { roles: string[] }> = {
  key: 'users.role.revoke',
  titleAr: 'سحب دور من مستخدم',
  descriptionAr:
    'سحب دور CREATOR/BACKER/SUPPLIER (العكس التعويضي للمنح). سحب ADMIN غير ممكن من هنا. يسري على الرمز عند تجديده.',
  inputSchema: revokeInput,
  permission: 'users.lifecycle',
  riskTier: 'SENSITIVE',
  reversible: true,
  compensatingKey: 'users.role.grant',
  requiresReason: true,
  preconditions: [
    {
      code: 'user-missing',
      reasonAr: 'المستخدم غير موجود',
      check: async (db, input) =>
        !!(await db.user.findUnique({ where: { id: input.userId }, select: { id: true } })),
    },
    {
      code: 'role-not-held',
      reasonAr: 'المستخدم لا يحمل هذا الدور أصلاً',
      check: async (db, input) => {
        const u = await db.user.findUnique({
          where: { id: input.userId },
          select: { roles: true },
        });
        return u?.roles.includes(input.role as UserRole) ?? false;
      },
    },
  ],
  async dryRun(db, input) {
    const u = await db.user.findUnique({ where: { id: input.userId }, select: { roles: true } });
    return {
      summaryAr: `سيُسحب دور ${input.role} من المستخدم`,
      before: { roles: u?.roles ?? null },
      after: { roles: (u?.roles ?? []).filter((r) => r !== (input.role as UserRole)) },
    };
  },
  async execute(tx, input) {
    const user = await tx.user.findUniqueOrThrow({ where: { id: input.userId } });
    const roles = user.roles.filter((r) => r !== (input.role as UserRole));
    const updated = await tx.user.update({ where: { id: input.userId }, data: { roles } });
    return { roles: updated.roles as string[] };
  },
};

/** Distinct users holding any money permission — evaluated on the handed db
 *  client (works both for the read-only pass and inside the execute tx). */
async function moneyAdminIds(db: {
  opsRole: { findMany: (args: unknown) => Promise<Array<{ grants: Array<{ userId: string }> }>> };
}): Promise<Set<string>> {
  const roles = await db.opsRole.findMany({
    where: { permissions: { hasSome: [...MONEY_PERMISSIONS] } },
    select: { grants: { select: { userId: true } } },
  });
  return new Set(roles.flatMap((r) => r.grants.map((g) => g.userId)));
}

const opsRoleGrantInput = z.object({
  userId: z.string().uuid(),
  roleKey: z.string().min(2).max(40),
});

const opsRoleGrant: OperationDef<
  z.infer<typeof opsRoleGrantInput>,
  { roleKeys: string[]; fourEyesNowOn: boolean }
> = {
  key: 'users.ops-role.grant',
  titleAr: 'منح دور تشغيلي (RBAC)',
  descriptionAr:
    'منح دور من مصفوفة مركز العمليات (OWNER, FINANCE, REVIEWER, …). منح دورٍ ماليٍّ لمستخدمٍ ثانٍ يُفعّل مبدأ العيون الأربع تلقائياً ولا يُعطَّل من أي واجهة.',
  inputSchema: opsRoleGrantInput,
  permission: 'users.roles.assign',
  riskTier: 'SENSITIVE',
  reversible: true,
  compensatingKey: 'users.ops-role.revoke',
  requiresReason: true,
  preconditions: [
    {
      code: 'user-missing',
      reasonAr: 'المستخدم غير موجود',
      check: async (db, input) =>
        !!(await db.user.findUnique({ where: { id: input.userId }, select: { id: true } })),
    },
    {
      code: 'role-missing',
      reasonAr: 'الدور غير موجود في مصفوفة الأدوار',
      check: async (db, input) =>
        !!(await db.opsRole.findUnique({ where: { key: input.roleKey }, select: { id: true } })),
    },
    {
      code: 'user-not-admin',
      reasonAr: 'المستخدم لا يحمل دور ADMIN — امنحه القدرة على دخول مركز العمليات أولاً',
      check: async (db, input) => {
        const u = await db.user.findUnique({
          where: { id: input.userId },
          select: { roles: true },
        });
        return u?.roles.includes('ADMIN' as UserRole) ?? false;
      },
    },
  ],
  async dryRun(db, input) {
    const role = await db.opsRole.findUnique({ where: { key: input.roleKey } });
    const grants = await db.opsRoleGrant.findMany({
      where: { userId: input.userId },
      select: { role: { select: { key: true } } },
    });
    const beforeKeys = grants.map((g) => g.role.key).sort();
    const has = beforeKeys.includes(input.roleKey);
    const moneyBefore = await moneyAdminIds(db as never);
    const grantsMoney = MONEY_PERMISSIONS.some((p) => role?.permissions.includes(p));
    const moneyAfter = grantsMoney ? moneyBefore.size + (moneyBefore.has(input.userId) ? 0 : 1) : moneyBefore.size;
    const flips = moneyBefore.size < 2 && moneyAfter >= 2;
    return {
      summaryAr: has
        ? `المستخدم يحمل دور ${input.roleKey} أصلاً — لا تغيير`
        : `سيُمنح دور ${input.roleKey} (${role?.nameAr ?? ''})${
            flips ? ' — سيُفعَّل مبدأ العيون الأربع تلقائياً (ثاني مسؤول مالي)' : ''
          }`,
      before: { roleKeys: beforeKeys, moneyAdmins: moneyBefore.size },
      after: {
        roleKeys: has ? beforeKeys : [...beforeKeys, input.roleKey].sort(),
        moneyAdmins: moneyAfter,
        fourEyesAutoOn: flips || moneyAfter >= 2,
      },
    };
  },
  async execute(tx, input, ctx) {
    const role = await tx.opsRole.findUniqueOrThrow({ where: { key: input.roleKey } });
    await tx.opsRoleGrant.upsert({
      where: { userId_roleId: { userId: input.userId, roleId: role.id } },
      create: {
        userId: input.userId,
        roleId: role.id,
        grantedBy: /^[0-9a-f-]{36}$/i.test(ctx.actor.id) ? ctx.actor.id : null,
      },
      update: {},
    });
    const grants = await tx.opsRoleGrant.findMany({
      where: { userId: input.userId },
      select: { role: { select: { key: true } } },
    });
    const money = await moneyAdminIds(tx as never);
    return { roleKeys: grants.map((g) => g.role.key).sort(), fourEyesNowOn: money.size >= 2 };
  },
};

const opsRoleRevoke: OperationDef<
  z.infer<typeof opsRoleGrantInput>,
  { roleKeys: string[] }
> = {
  key: 'users.ops-role.revoke',
  titleAr: 'سحب دور تشغيلي (RBAC)',
  descriptionAr:
    'سحب دور من مصفوفة مركز العمليات. سحب آخر OWNER مرفوض — لا يجوز قفل المنصة بلا مالك.',
  inputSchema: opsRoleGrantInput,
  permission: 'users.roles.assign',
  riskTier: 'SENSITIVE',
  reversible: true,
  compensatingKey: 'users.ops-role.grant',
  requiresReason: true,
  preconditions: [
    {
      code: 'grant-missing',
      reasonAr: 'المستخدم لا يحمل هذا الدور',
      check: async (db, input) => {
        const role = await db.opsRole.findUnique({
          where: { key: input.roleKey },
          select: { id: true },
        });
        if (!role) return false;
        return !!(await db.opsRoleGrant.findUnique({
          where: { userId_roleId: { userId: input.userId, roleId: role.id } },
          select: { id: true },
        }));
      },
    },
    {
      code: 'last-owner',
      reasonAr: 'هذا آخر حساب OWNER — سحبه يقفل المنصة بلا مالك، مرفوض',
      check: async (db, input) => {
        if (input.roleKey !== 'OWNER') return true;
        const owner = await db.opsRole.findUnique({
          where: { key: 'OWNER' },
          select: { grants: { select: { userId: true } } },
        });
        return (owner?.grants.filter((g) => g.userId !== input.userId).length ?? 0) > 0;
      },
    },
  ],
  async dryRun(db, input) {
    const grants = await db.opsRoleGrant.findMany({
      where: { userId: input.userId },
      select: { role: { select: { key: true } } },
    });
    const beforeKeys = grants.map((g) => g.role.key).sort();
    return {
      summaryAr: `سيُسحب دور ${input.roleKey} من المستخدم`,
      before: { roleKeys: beforeKeys },
      after: { roleKeys: beforeKeys.filter((k) => k !== input.roleKey) },
    };
  },
  async execute(tx, input) {
    const role = await tx.opsRole.findUniqueOrThrow({ where: { key: input.roleKey } });
    await tx.opsRoleGrant.deleteMany({ where: { userId: input.userId, roleId: role.id } });
    const grants = await tx.opsRoleGrant.findMany({
      where: { userId: input.userId },
      select: { role: { select: { key: true } } },
    });
    return { roleKeys: grants.map((g) => g.role.key).sort() };
  },
};

const unmaskInput = z.object({
  userId: z.string().uuid(),
  fields: z.array(z.enum(UNMASKABLE_FIELDS)).min(1),
});

const piiUnmask: OperationDef<
  z.infer<typeof unmaskInput>,
  { values: Record<string, string | null> }
> = {
  key: 'users.pii.unmask',
  titleAr: 'كشف بيانات شخصية مقنّعة',
  descriptionAr:
    'كشف قيمة حقل مقنّع (بريد/هاتف) لمستخدم محدد — عملية حساسة بسبب مكتوب، تُدوَّن في سجل التدقيق بالحقل والشخص والفاعل. القيم لا تُخزَّن في سجل التنفيذ.',
  inputSchema: unmaskInput,
  permission: 'users.pii.unmask',
  riskTier: 'SENSITIVE',
  reversible: false,
  requiresReason: true,
  preconditions: [
    {
      code: 'user-missing',
      reasonAr: 'المستخدم غير موجود',
      check: async (db, input) =>
        !!(await db.user.findUnique({ where: { id: input.userId }, select: { id: true } })),
    },
  ],
  async dryRun(db, input) {
    const u = await db.user.findUnique({
      where: { id: input.userId },
      select: { email: true, phone: true },
    });
    return {
      summaryAr: `سيُكشف: ${input.fields.join('، ')} — يُسجَّل في التدقيق باسمك`,
      before: { email: maskEmail(u?.email), phone: maskPhone(u?.phone) },
      after: { revealedFields: input.fields },
    };
  },
  async execute(tx, input) {
    const u = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { email: true, phone: true },
    });
    const values: Record<string, string | null> = {};
    for (const f of input.fields) values[f] = u[f];
    return { values };
  },
  // The caller sees the values; the execution ledger never stores them.
  redactResult: (r) => ({
    values: Object.fromEntries(Object.keys(r.values).map((k) => [k, '［كُشفت — غير مخزّنة］'])),
  }),
};

/* ── Batch OPS (registry completion) — lifecycle + PDPL ─────────────────── */

const userRef = z.object({ userId: z.string().uuid() });

/** Same primitives as AuthService's forgot-password: sha256 of a random
 *  base64url token, 30-minute TTL, single-use via usedAt. */
const RESET_TTL_MS = 30 * 60 * 1000;
const sha256 = (raw: string): string => createHash('sha256').update(raw).digest('hex');

export function usersOps(deps: UsersOpsDeps = UNWIRED_DEPS): Array<OperationDef<never, unknown>> {
  const suspend: OperationDef<
    z.infer<typeof userRef>,
    { suspendedAt: string; sessionsRevoked: number }
  > = {
    key: 'users.suspend',
    titleAr: 'إيقاف حساب مستخدم',
    descriptionAr:
      'إيقاف إداري (قابل للعكس عبر users.reactivate): يمنع الدخول فوراً — كل الجلسات النشطة تُلغى في المعاملة نفسها، والرمز الحي يسقط عند أول تحقق. الحظر الدائم عمليةُ الإشراف المستقلة، لا هذه.',
    inputSchema: userRef,
    permission: 'users.lifecycle',
    riskTier: 'SENSITIVE',
    reversible: true,
    compensatingKey: 'users.reactivate',
    requiresReason: true,
    preconditions: [
      {
        code: 'user-missing',
        reasonAr: 'المستخدم غير موجود',
        check: async (db, input) =>
          !!(await db.user.findUnique({ where: { id: input.userId }, select: { id: true } })),
      },
      {
        code: 'already-suspended',
        reasonAr: 'الحساب موقوف أو محظور أصلاً',
        check: async (db, input) => {
          const u = await db.user.findUnique({
            where: { id: input.userId },
            select: { suspendedAt: true },
          });
          return u?.suspendedAt == null;
        },
      },
      {
        code: 'target-is-operator',
        reasonAr:
          'الحساب يحمل دوراً تشغيلياً في مركز العمليات — اسحب أدواره التشغيلية أولاً (users.ops-role.revoke) ثم أوقفه',
        check: async (db, input) =>
          (await db.opsRoleGrant.count({ where: { userId: input.userId } })) === 0,
      },
    ],
    async dryRun(db, input) {
      const u = await db.user.findUnique({
        where: { id: input.userId },
        select: { name: true, suspendedAt: true, suspendedKind: true },
      });
      const sessions = await db.refreshToken.count({
        where: { userId: input.userId, revokedAt: null },
      });
      return {
        summaryAr: `سيُوقف حساب «${u?.name ?? input.userId}» وتُلغى ${sessions} جلسة نشطة`,
        before: { suspendedAt: u?.suspendedAt?.toISOString() ?? null, suspendedKind: u?.suspendedKind ?? null },
        after: { suspendedKind: 'SUSPENDED' },
        counts: { sessionsToRevoke: sessions },
      };
    },
    async execute(tx, input, ctx) {
      const now = new Date();
      await tx.user.update({
        where: { id: input.userId },
        data: {
          suspendedAt: now,
          suspendedKind: 'SUSPENDED',
          suspendedReasonAr: ctx.reason ?? null,
        },
      });
      const { count } = await tx.refreshToken.updateMany({
        where: { userId: input.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return { suspendedAt: now.toISOString(), sessionsRevoked: count };
    },
    async afterCommit(_result, input, ctx) {
      await deps.notifications.create({
        userId: input.userId,
        kind: NotificationKind.ACCOUNT_SUSPENDED,
        payload: { reasonAr: ctx.reason ?? null },
      });
      const u = await deps.prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true },
      });
      if (u) await deps.email.accountSuspended(u.email, { banned: false, reasonAr: ctx.reason ?? null });
    },
  };

  const reactivate: OperationDef<z.infer<typeof userRef>, { reactivated: true }> = {
    key: 'users.reactivate',
    titleAr: 'إعادة تفعيل حساب موقوف',
    descriptionAr:
      'يرفع الإيقاف الإداري (SUSPENDED فقط) ويعيد الدخول. الحساب المحظور (BANNED) لا يُعاد من هنا — رفع الحظر قرار إشرافي عبر moderation.user.unban.',
    inputSchema: userRef,
    permission: 'users.lifecycle',
    riskTier: 'SENSITIVE',
    reversible: true,
    compensatingKey: 'users.suspend',
    requiresReason: true,
    preconditions: [
      {
        code: 'not-suspended',
        reasonAr: 'الحساب ليس موقوفاً — لا شيء يُرفع',
        check: async (db, input) => {
          const u = await db.user.findUnique({
            where: { id: input.userId },
            select: { suspendedAt: true },
          });
          return u?.suspendedAt != null;
        },
      },
      {
        code: 'banned-not-suspended',
        reasonAr:
          'الحساب محظور (BANNED) لا موقوف — رفع الحظر قرار إشرافي يمر عبر moderation.user.unban وليس إعادة التفعيل',
        check: async (db, input) => {
          const u = await db.user.findUnique({
            where: { id: input.userId },
            select: { suspendedKind: true },
          });
          return u?.suspendedKind !== 'BANNED';
        },
      },
    ],
    async dryRun(db, input) {
      const u = await db.user.findUnique({
        where: { id: input.userId },
        select: { name: true, suspendedAt: true, suspendedKind: true, suspendedReasonAr: true },
      });
      return {
        summaryAr: `سيُعاد تفعيل حساب «${u?.name ?? input.userId}» ويُمسح سبب الإيقاف`,
        before: {
          suspendedAt: u?.suspendedAt?.toISOString() ?? null,
          suspendedKind: u?.suspendedKind ?? null,
          suspendedReasonAr: u?.suspendedReasonAr ?? null,
        },
        after: { suspendedAt: null, suspendedKind: null, suspendedReasonAr: null },
      };
    },
    async execute(tx, input) {
      await tx.user.update({
        where: { id: input.userId },
        data: { suspendedAt: null, suspendedKind: null, suspendedReasonAr: null },
      });
      return { reactivated: true as const };
    },
    async afterCommit(_result, input) {
      await deps.notifications.create({
        userId: input.userId,
        kind: NotificationKind.ACCOUNT_REACTIVATED,
        payload: {},
      });
      const u = await deps.prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true, name: true },
      });
      if (u) await deps.email.accountReactivated(u.email, u.name);
    },
  };

  const forcePasswordReset: OperationDef<
    z.infer<typeof userRef>,
    { tokenIssued: true; rawToken: string; sessionsRevoked: number }
  > = {
    key: 'users.force-password-reset',
    titleAr: 'إجبار إعادة تعيين كلمة المرور',
    descriptionAr:
      'يصكّ رمز إعادة تعيين (كما في «نسيت كلمة المرور»: صلاحية ٣٠ دقيقة، استخدام واحد، الرموز السابقة تُبطل) ويلغي كل الجلسات. الرمز الخام يذهب إلى بريد المستخدم فقط — لا يظهر للمشغّل ولا يُخزَّن في سجل التنفيذ.',
    inputSchema: userRef,
    permission: 'users.lifecycle',
    riskTier: 'SENSITIVE',
    reversible: false,
    requiresReason: true,
    preconditions: [
      {
        code: 'user-missing',
        reasonAr: 'المستخدم غير موجود',
        check: async (db, input) =>
          !!(await db.user.findUnique({ where: { id: input.userId }, select: { id: true } })),
      },
      {
        code: 'suspended-user',
        reasonAr: 'الحساب موقوف — أعد تفعيله أولاً (users.reactivate) قبل إجبار إعادة التعيين',
        check: async (db, input) => {
          const u = await db.user.findUnique({
            where: { id: input.userId },
            select: { suspendedAt: true },
          });
          return u?.suspendedAt == null;
        },
      },
    ],
    async dryRun(db, input) {
      const u = await db.user.findUnique({
        where: { id: input.userId },
        select: { name: true, email: true },
      });
      const sessions = await db.refreshToken.count({
        where: { userId: input.userId, revokedAt: null },
      });
      return {
        summaryAr: `سيُرسل رابط إعادة تعيين إلى ${maskEmail(u?.email) ?? '—'} وتُلغى ${sessions} جلسة نشطة`,
        before: { email: maskEmail(u?.email) },
        after: { tokenIssued: true, sessionsRevoked: sessions },
        counts: { sessionsToRevoke: sessions },
      };
    },
    async execute(tx, input) {
      const raw = randomBytes(32).toString('base64url');
      // Invalidate prior tokens the way the service does: usedAt, not delete.
      await tx.passwordResetToken.updateMany({
        where: { userId: input.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.passwordResetToken.create({
        data: {
          userId: input.userId,
          tokenHash: sha256(raw),
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        },
      });
      const { count } = await tx.refreshToken.updateMany({
        where: { userId: input.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { tokenIssued: true as const, rawToken: raw, sessionsRevoked: count };
    },
    async afterCommit(result, input) {
      const u = await deps.prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true },
      });
      if (!u) return;
      // Same link shape as AuthService.forgotPassword.
      const link = `${process.env.WEB_BASE_URL ?? 'http://localhost:3000'}/reset-password?token=${result.rawToken}`;
      await deps.email.passwordReset(u.email, link);
    },
    // SECURITY: the raw token exists only in transit to afterCommit — the
    // ledger (and therefore every ops screen) sees only the fact.
    redactResult: () => ({ tokenIssued: true }),
  };

  const sessionsRevoke: OperationDef<z.infer<typeof userRef>, { revoked: number }> = {
    key: 'users.sessions.revoke',
    titleAr: 'إلغاء كل جلسات مستخدم',
    descriptionAr:
      'يلغي كل رموز التجديد النشطة (خروج من كل الأجهزة). رموز الدخول الحية تسقط عند أول تحقق أو عند انتهائها.',
    inputSchema: userRef,
    permission: 'users.lifecycle',
    riskTier: 'SENSITIVE',
    reversible: false,
    requiresReason: true,
    preconditions: [
      {
        code: 'user-missing',
        reasonAr: 'المستخدم غير موجود',
        check: async (db, input) =>
          !!(await db.user.findUnique({ where: { id: input.userId }, select: { id: true } })),
      },
    ],
    async dryRun(db, input) {
      const sessions = await db.refreshToken.count({
        where: { userId: input.userId, revokedAt: null },
      });
      return {
        summaryAr: `ستُلغى ${sessions} جلسة نشطة للمستخدم`,
        before: { activeSessions: sessions },
        after: { activeSessions: 0 },
        counts: { activeSessions: sessions },
      };
    },
    async execute(tx, input) {
      const { count } = await tx.refreshToken.updateMany({
        where: { userId: input.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { revoked: count };
    },
  };

  const pdplExport: OperationDef<z.infer<typeof userRef>, Record<string, unknown>> = {
    key: 'users.pdpl.export',
    titleAr: 'تصدير بيانات مستخدم (PDPL)',
    descriptionAr:
      'حق الوصول: نسخة كاملة من بيانات المستخدم (PdplService.exportData — قراءة فقط). الحزمة تعود للطالب ولا تُخزَّن في سجل التنفيذ — الكشف نفسه هو المدوَّن.',
    inputSchema: userRef,
    permission: 'users.pii.unmask',
    riskTier: 'SENSITIVE',
    reversible: false,
    requiresReason: true,
    orchestrated: true,
    preconditions: [
      {
        code: 'user-missing',
        reasonAr: 'المستخدم غير موجود',
        check: async (db, input) =>
          !!(await db.user.findUnique({ where: { id: input.userId }, select: { id: true } })),
      },
    ],
    async dryRun(db, input) {
      const [pledges, projects, comments] = await Promise.all([
        db.pledge.count({ where: { backerId: input.userId } }),
        db.project.count({ where: { createdById: input.userId } }),
        db.comment.count({ where: { userId: input.userId } }),
      ]);
      return {
        summaryAr: `ستُصدَّر حزمة PDPL كاملة (${pledges} تعهداً، ${projects} مشروعاً، ${comments} تعليقاً …) — تُسلَّم للطالب ولا تُخزَّن`,
        before: null,
        after: { exported: true },
        counts: { pledges, projects, comments },
      };
    },
    async execute(_db, input) {
      return deps.pdpl.exportData(input.userId);
    },
    // The PII bundle goes back to the caller; the ledger keeps only the fact.
    redactResult: () => ({ exported: true }),
  };

  const pdplErase: OperationDef<z.infer<typeof userRef>, { erased: true }> = {
    key: 'users.pdpl.erase',
    titleAr: 'محو حساب (PDPL)',
    descriptionAr:
      'حق المحو: يجهّل هوية المستخدم ويحذف التوابع الشخصية مع إبقاء السجلات المالية (احتفاظ تجاري/مكافحة غسل). يُرفض ومال المستخدم محجوز أو حملته نشطة — الشروط هنا تعكس رفض PdplService نفسه ليكون dryRun صادقاً. غير قابل للعكس.',
    inputSchema: userRef,
    permission: 'users.lifecycle',
    riskTier: 'SENSITIVE',
    reversible: false,
    requiresReason: true,
    // PdplService.eraseAccount opens its own $transaction.
    orchestrated: true,
    preconditions: [
      {
        code: 'user-missing',
        reasonAr: 'المستخدم غير موجود',
        check: async (db, input) =>
          !!(await db.user.findUnique({ where: { id: input.userId }, select: { id: true } })),
      },
      {
        code: 'already-erased',
        reasonAr: 'الحساب ممحو أصلاً',
        check: async (db, input) => {
          const u = await db.user.findUnique({
            where: { id: input.userId },
            select: { email: true },
          });
          return !u?.email.startsWith('erased-');
        },
      },
      {
        code: 'held-pledges',
        reasonAr: 'للمستخدم تعهدات محجوزة (HELD) — المحو متاح بعد تسوية الحملات',
        check: async (db, input) =>
          (await db.pledge.count({
            where: { backerId: input.userId, status: PledgeStatus.HELD },
          })) === 0,
      },
      {
        code: 'active-campaigns',
        reasonAr: 'للمستخدم حملات نشطة — تُسلَّم أو تُستكمل قبل المحو',
        check: async (db, input) =>
          (await db.project.count({
            where: {
              createdById: input.userId,
              status: {
                in: [
                  ProjectStatus.UNDER_REVIEW,
                  ProjectStatus.LIVE,
                  ProjectStatus.SUCCESSFUL,
                  ProjectStatus.FUNDED,
                  ProjectStatus.IN_PRODUCTION,
                ],
              },
            },
          })) === 0,
      },
    ],
    async dryRun(db, input) {
      const u = await db.user.findUnique({
        where: { id: input.userId },
        select: { email: true, name: true },
      });
      const [addresses, notifications, follows, beneficiary] = await Promise.all([
        db.address.count({ where: { userId: input.userId } }),
        db.notification.count({ where: { userId: input.userId } }),
        db.creatorFollow.count({ where: { followerId: input.userId } }),
        db.payoutBeneficiary.count({ where: { userId: input.userId } }),
      ]);
      return {
        summaryAr: `سيُجهَّل «${u?.name ?? input.userId}» (${maskEmail(u?.email) ?? '—'}) وتُحذف توابعه الشخصية — السجلات المالية تبقى`,
        before: { email: maskEmail(u?.email), name: u?.name ?? null },
        after: { name: 'مستخدم محذوف', anonymized: true },
        counts: { addresses, notifications, follows, payoutBeneficiary: beneficiary },
      };
    },
    async execute(_db, input) {
      return deps.pdpl.eraseAccount(input.userId);
    },
  };

  return [
    roleGrant,
    roleRevoke,
    kycForceVerify,
    opsRoleGrant,
    opsRoleRevoke,
    piiUnmask,
    suspend,
    reactivate,
    forcePasswordReset,
    sessionsRevoke,
    pdplExport,
    pdplErase,
  ] as unknown as Array<OperationDef<never, unknown>>;
}
