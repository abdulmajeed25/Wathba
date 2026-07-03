// Demo credential seed (Creator-CC / Part 1 live-browse). Idempotent.
// Sets a single KNOWN password on the canonical account per role and ensures
// roles + Nafath verification, so the owner can sign in as every role. These
// accounts already own the rich seeded data (drone campaign, funded project
// with payouts/RFQ, a supplier bid). Run against a migrated DB from apps/api:
//   node prisma/_seed/demo-users.mjs
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const PASSWORD = 'Wathba!2026';

/** email -> desired roles (only applied to accounts that already exist). */
const ACCOUNTS = [
  { email: 'admin@wathba.demo', roles: ['BACKER', 'ADMIN'], label: 'ADMIN' },
  { email: 'sirb@wathba.demo', roles: ['BACKER', 'CREATOR'], label: 'CREATOR (rich LIVE campaign)' },
  { email: 'smoke-s1@test.wathba.sa', roles: ['BACKER', 'ADMIN', 'CREATOR'], label: 'CREATOR+ADMIN (funded project + payouts)' },
  { email: 'supplier-s3@test.wathba.sa', roles: ['BACKER', 'SUPPLIER'], label: 'SUPPLIER (owns a bid)' },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const now = new Date();
  for (const a of ACCOUNTS) {
    const existing = await prisma.user.findUnique({ where: { email: a.email } });
    if (!existing) {
      console.log(`[demo-users] SKIP (absent): ${a.email}`);
      continue;
    }
    const merged = Array.from(new Set([...existing.roles, ...a.roles]));
    await prisma.user.update({
      where: { email: a.email },
      data: {
        passwordHash,
        roles: merged,
        nafathVerified: true,
        nafathVerifiedAt: existing.nafathVerifiedAt ?? now,
        consentVersion: existing.consentVersion ?? '2026-06-28',
        consentAt: existing.consentAt ?? now,
      },
    });
    console.log(`[demo-users] ${a.label.padEnd(38)} ${a.email}  roles=${merged.join('+')}`);
  }
  console.log(`[demo-users] password for all of the above: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
