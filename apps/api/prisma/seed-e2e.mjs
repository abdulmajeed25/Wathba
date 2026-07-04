// Minimal E2E seed (Sprint 4 / P1-007): the admin+creator the golden
// journeys depend on. Idempotent. Run against a migrated DB.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedCategories } from './seed-categories.mjs';

const prisma = new PrismaClient();
const EMAIL = 'smoke-s1@test.wathba.sa';

async function main() {
  // Batch CAT — the mega-menu / discover journeys need the full tree present.
  await seedCategories(prisma);

  const passwordHash = await bcrypt.hash('Str0ngPass!x', 12);
  await prisma.user.upsert({
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
  console.log('[seed-e2e] admin/creator ready:', EMAIL);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
