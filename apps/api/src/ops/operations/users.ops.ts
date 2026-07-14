import { z } from 'zod';
import type { UserRole } from '@prisma/client';

import type { OperationDef } from '../operation.types';
import { MONEY_PERMISSIONS } from '../permissions';
import { UNMASKABLE_FIELDS, maskEmail, maskPhone } from '../pii';

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
 */

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

export function usersOps(): Array<OperationDef<never, unknown>> {
  return [
    roleGrant,
    roleRevoke,
    kycForceVerify,
    opsRoleGrant,
    opsRoleRevoke,
    piiUnmask,
  ] as unknown as Array<OperationDef<never, unknown>>;
}
