// Flip the ops four-eyes money gate by moving GRANTS, never by setting the
// kill switch. Mirrors OpsRbacService.fourEyesEffective() exactly.
//
//   node --env-file=.env prisma/ops-four-eyes.mjs status
//   node --env-file=.env prisma/ops-four-eyes.mjs off
//   node --env-file=.env prisma/ops-four-eyes.mjs on
//
// Why grants and not FOUR_EYES_MONEY_OVERRIDE=off: .env labels that one
// "Emergency-only … Never set", and it error-logs on every single evaluation.
//
// Why smoke-s1 is the one that keeps OWNER: prisma/seed-e2e.mjs re-grants it on
// every e2e run. Make any other account the sole money admin and the next suite
// run silently re-arms four-eyes.
//
// Four-eyes gates EXECUTE only — a MONEY execute files a proposal instead of
// running. dry-run never consults the flag, so a clean dry-run proves nothing.
// The live read is GET /api/ops/auth/session → { fourEyes, moneyAdmins }.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MONEY_PERMISSIONS = ['*', 'money.execute', 'money.approve'];
const KEEP = 'smoke-s1@test.wathba.sa';

/** ON restores the full demo role set; OFF parks them on non-money roles. */
const PLAN = {
  on: [['owner@wathba.demo', 'OWNER'], ['finance@wathba.demo', 'FINANCE']],
  off: [['owner@wathba.demo', 'OPS_MANAGER'], ['finance@wathba.demo', null]],
};

async function moneyAdmins() {
  const roles = await prisma.opsRole.findMany({
    where: { permissions: { hasSome: MONEY_PERMISSIONS } },
    select: { grants: { select: { userId: true } } },
  });
  const ids = [...new Set(roles.flatMap((r) => r.grants.map((g) => g.userId)))];
  return prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } });
}

async function status() {
  const admins = await moneyAdmins();
  const override = process.env.FOUR_EYES_MONEY_OVERRIDE;
  const configOn = process.env.FOUR_EYES_MONEY === '1';
  let effective, why;
  if (admins.length >= 2) {
    if (override === 'off') { effective = false; why = 'FORCED OFF by FOUR_EYES_MONEY_OVERRIDE — this should never be set'; }
    else { effective = true; why = `${admins.length} money admins — automatic, no UI can turn this off`; }
  } else {
    effective = configOn;
    why = `${admins.length} money admin — follows FOUR_EYES_MONEY (${configOn ? '=1' : 'unset'})`;
  }
  console.log(`money admins (${admins.length}): ${admins.map((a) => a.email).join(', ') || '(none)'}`);
  console.log(`four-eyes:  ${effective ? 'ON' : 'OFF'}  — ${why}`);
  console.log(`money ops execute directly as: ${effective ? '(nobody — every MONEY execute queues a proposal)' : admins.map((a) => a.email).join(', ') || '(nobody holds money perms)'}`);
  return effective;
}

async function apply(mode) {
  for (const [email, roleKey] of PLAN[mode]) {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!u) { console.log(`  skip ${email} — no such user`); continue; }
    await prisma.opsRoleGrant.deleteMany({ where: { userId: u.id } });
    if (roleKey) {
      const r = await prisma.opsRole.findUnique({ where: { key: roleKey } });
      if (!r) { console.log(`  skip ${email} — ops role ${roleKey} missing`); continue; }
      await prisma.opsRoleGrant.create({ data: { userId: u.id, roleId: r.id } });
    }
    console.log(`  ${email} -> ${roleKey ?? '(no grant)'}`);
  }
  // Guard the invariant rather than trusting it: OFF is only meaningful while
  // the keeper still holds a money role.
  const keeper = await prisma.user.findUnique({ where: { email: KEEP }, select: { id: true } });
  const admins = await moneyAdmins();
  if (mode === 'off' && keeper && !admins.some((a) => a.id === keeper.id)) {
    console.log(`\n⚠ ${KEEP} no longer holds a money role — re-run prisma/seed-e2e.mjs to restore OWNER.`);
  }
}

const mode = (process.argv[2] ?? 'status').toLowerCase();
if (!['on', 'off', 'status'].includes(mode)) {
  console.error('usage: ops-four-eyes.mjs [status|on|off]');
  process.exit(2);
}
if (mode !== 'status') {
  console.log(`applying: four-eyes ${mode.toUpperCase()}`);
  await apply(mode);
  console.log('');
}
await status();
await prisma.$disconnect();
