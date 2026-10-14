import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

type IdentityDb = Pick<Prisma.TransactionClient, 'user' | 'opsRoleGrant'>;

export const ADMIN_IDENTITY_PROTECTED = 'حسابات إدارة المنصة لا تُدمج أو تُمحى من هذا المسار؛ يجب تسوية صلاحيات الإدارة أولًا عبر المالك';

export async function hasAdministrativeIdentity(db: IdentityDb, userIds: string[]): Promise<boolean> {
  const admin = await db.user.findFirst({
    where: { id: { in: userIds }, roles: { has: 'ADMIN' } }, select: { id: true },
  });
  if (admin) return true;
  return Boolean(await db.opsRoleGrant.findFirst({
    where: { userId: { in: userIds } }, select: { id: true },
  }));
}

/** Shares the lock used by operator-role grant/revoke; call inside a transaction. */
export async function protectAdministrativeIdentity(tx: Prisma.TransactionClient, userIds: string[]) {
  await tx.$queryRaw`SELECT "id" FROM "OpsRole" WHERE "key" = 'OWNER' FOR UPDATE`;
  if (await hasAdministrativeIdentity(tx, userIds)) throw new ConflictException(ADMIN_IDENTITY_PROTECTED);
}

/** Identity credentials never follow data to another account. */
export async function revokeIdentityCredentials(tx: Prisma.TransactionClient, userId: string) {
  const now = new Date();
  await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
  await tx.opsSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
  await tx.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
  await tx.emailVerifyToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
}
