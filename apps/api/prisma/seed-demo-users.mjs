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
    await prisma.user.upsert({
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
    console.log(`[seed-demo-users] ${u.email} (${u.roles.join('+')}) = ${PASSWORD}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
