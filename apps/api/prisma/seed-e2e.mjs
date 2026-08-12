// The E2E seed: the accounts the golden journeys sign in as, PLUS the demo
// catalogue the rest of the suite quietly assumes. Idempotent. Run against a
// migrated DB.
//
// It was "minimal" for a long time — the admin and creator, nothing else — and
// that was survivable only because the suite was silently running against the
// DEMO database (#172). Pointed at a genuinely isolated database it produced 58
// failures across ~20 spec files: a hero rotator with nothing to rotate, cards
// with no covers or videos, a rules hub with no rules, /projects/sirb-drone
// resolving to a 404. None of them were product defects.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedCategories } from './seed-categories.mjs';
import { seedCollections } from './seed-collections.mjs';
import { seedTags } from './seed-tags.mjs';
import { seedSearchFixtures } from './seed-e2e-search.mjs';
import { seedCatalogue } from './seed-e2e-catalogue.mjs';

const prisma = new PrismaClient();
const EMAIL = 'smoke-s1@test.wathba.sa';

async function main() {
  // Batch CAT — the mega-menu / discover journeys need the full tree present.
  await seedCategories(prisma);
  // Batch DISC — the 5 example collections (inactive placeholders).
  await seedCollections(prisma);
  // DISCOVERY-ENGINE Unit 1 — the curated tag vocabulary, which the tag facet
  // and the search suggest dropdown both read.
  await seedTags(prisma);
  // The demo catalogue — the same tracked seeds the demo database is built
  // from, so there is one definition of what a populated Wathba looks like
  // rather than two that drift. ~45s.
  await seedCatalogue();

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

  // The Arabic reference content arabic-search.spec.ts searches for. Without
  // it that spec fails 6 and skips 2 — which nobody saw, because the suite was
  // silently running against the demo database (#172).
  await seedSearchFixtures(prisma);

  console.log('[seed-e2e] admin/creator ready:', EMAIL, '+ finance fixture (no money role)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
