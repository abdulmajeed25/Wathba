// Live-browsing demo users — one per role, all with a single known password.
// Idempotent. Password: Wathba!2026
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const PASSWORD = 'Wathba!2026';

const USERS = [
  { email: 'backer@wathba.demo', name: 'داعم تجريبي', roles: ['BACKER'] },
  { email: 'creator@wathba.demo', name: 'مبدع تجريبي', roles: ['BACKER', 'CREATOR'] },
  { email: 'supplier@wathba.demo', name: 'مورّد تجريبي', roles: ['BACKER', 'SUPPLIER'] },
  { email: 'admin@wathba.demo', name: 'مدير تجريبي', roles: ['BACKER', 'CREATOR', 'ADMIN'] },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  for (const u of USERS) {
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: { roles: u.roles, nafathVerified: true, passwordHash },
      create: {
        name: u.name,
        email: u.email,
        passwordHash,
        roles: u.roles,
        nafathVerified: true,
        nafathVerifiedAt: new Date(),
        consentVersion: '2026-06-28',
        consentAt: new Date(),
      },
    });
    // OPS Part 2 — the demo admin holds OPS_MANAGER (full day-to-day ops,
    // NO money): the dev DB must carry exactly ONE money admin (the e2e
    // owner), or FOUR_EYES_MONEY auto-enables and every money flow queues.
    // That mirrors production truth — there is one OWNER, the real owner.
    if (u.roles.includes('ADMIN')) {
      const mgrRole = await prisma.opsRole.findUnique({ where: { key: 'OPS_MANAGER' } });
      if (mgrRole) {
        // Drop any money-bearing grant (incl. migration 0045's OWNER backfill).
        await prisma.opsRoleGrant.deleteMany({
          where: { userId: row.id, roleId: { not: mgrRole.id } },
        });
        await prisma.opsRoleGrant.upsert({
          where: { userId_roleId: { userId: row.id, roleId: mgrRole.id } },
          update: {},
          create: { userId: row.id, roleId: mgrRole.id },
        });
      }
    }
    console.log(`[seed-demo-users] ${u.email} (${u.roles.join('+')}) = ${PASSWORD}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
