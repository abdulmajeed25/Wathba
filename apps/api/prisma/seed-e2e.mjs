// Minimal E2E seed (Sprint 4 / P1-007): the admin+creator the golden
// journeys depend on. Idempotent. Run against a migrated DB.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedCategories } from './seed-categories.mjs';
import { seedCollections } from './seed-collections.mjs';

const prisma = new PrismaClient();
const EMAIL = 'smoke-s1@test.wathba.sa';

async function main() {
  // Batch CAT — the mega-menu / discover journeys need the full tree present.
  await seedCategories(prisma);
  // Batch DISC — the 5 example collections (inactive placeholders).
  await seedCollections(prisma);

  const passwordHash = await bcrypt.hash('Str0ngPass!x', 12);
  const admin = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { roles: ['BACKER', 'ADMIN', 'CREATOR'], nafathVerified: true },
    create: {
      name: 'E2E Admin',
      email: EMAIL,
      passwordHash,
      roles: ['BACKER', 'ADMIN', 'CREATOR'],
      nafathVerified: true,
      nafathVerifiedAt: new Date(),
      consentVersion: '2026-06-28',
      consentAt: new Date(),
    },
  });
  // OPS Part 2 — the e2e admin is the OWNER (RBAC); mirrors migration 0045's
  // backfill for admins created after it ran.
  const ownerRole = await prisma.opsRole.findUnique({ where: { key: 'OWNER' } });
  if (ownerRole) {
    await prisma.opsRoleGrant.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: ownerRole.id } },
      update: {},
      create: { userId: admin.id, roleId: ownerRole.id },
    });
  }

  // OPS Part 2 — a second admin WITHOUT any money role: the four-eyes e2e
  // grants FINANCE to this account mid-test (flipping the switch ON), then
  // revokes it (restoring single-operator mode for the rest of the suite).
  const finance = await prisma.user.upsert({
    where: { email: 'smoke-finance@test.wathba.sa' },
    update: { roles: ['BACKER', 'ADMIN'], nafathVerified: true },
    create: {
      name: 'E2E Finance',
      email: 'smoke-finance@test.wathba.sa',
      passwordHash,
      roles: ['BACKER', 'ADMIN'],
      nafathVerified: true,
      nafathVerifiedAt: new Date(),
      consentVersion: '2026-06-28',
      consentAt: new Date(),
    },
  });
  // Defensive: migration 0045 backfilled OWNER onto every ADMIN that existed
  // when it ran — the finance fixture must start money-less for the
  // four-eyes e2e to mean anything.
  if (ownerRole) {
    await prisma.opsRoleGrant.deleteMany({ where: { userId: finance.id } });
  }

  console.log('[seed-e2e] admin/creator ready:', EMAIL, '+ finance fixture (no money role)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
