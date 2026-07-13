import { z } from 'zod';
import type { UserRole } from '@prisma/client';

import type { OperationDef } from '../operation.types';

/**
 * OPS Part 0 — identity operations (SENSITIVE tier: written reason always,
 * step-up once Part 1 lands). ADMIN grant stays deliberately impossible
 * here — it arrives in Part 2 as an OWNER-only operation.
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
  // users.role.revoke lands with Part 2 (census gap: grant is additive-only).
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

export function usersOps(): Array<OperationDef<never, unknown>> {
  return [roleGrant, kycForceVerify] as unknown as Array<OperationDef<never, unknown>>;
}
