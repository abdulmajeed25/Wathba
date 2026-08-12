// The demo catalogue, seeded into the e2e database.
//
// WHY. Most of this suite was authored against the demo dataset and quietly
// depends on it: the hero rotator needs hero-eligible projects with covers and
// videos, the section-order specs need HomepageSection rows, the rules and
// story specs need content pages, `orphan-routes O6` asks for /projects/sirb-drone
// by slug. Run against the minimal e2e fixture those specs do not fail
// meaningfully — they fail because there is nothing to look at. Measured: 58
// failures across ~20 spec files, all content-shaped.
//
// Rather than author a second catalogue that would drift from the first, this
// runs THE SAME tracked demo seeds the demo database is built from. One
// definition of what a populated Wathba looks like, used by both.
//
// They are standalone CLI scripts with no exports, so they run as child
// processes rather than being refactored into modules — nine rewrites to save
// nine spawns would be the worse trade, and each one already knows how to run
// itself.
//
// ORDER MATTERS and is not alphabetical:
//   · categories-l3 needs the top-level tree (seed-e2e seeds that first)
//   · covers / videos / stories / regions all decorate EXISTING projects, so
//     they must follow the generators
//   · regions only fills NULLs, so it must not run before the rows exist or it
//     silently does nothing
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/** [script, args, why it is here] */
const STEPS = [
  ['seed-demo-users.mjs', [], 'one browsable user per role'],
  ['seed-demo-projects.mjs', [], 'the base catalogue; sirb-drone and p1 are referenced by slug'],
  ['seed-hero-projects.mjs', [], 'hero-eligible projects — the rotator has nothing to rotate without these'],
  // AFTER the generators, not before. This one does not merely create nodes —
  // it MOVES existing projects down into the new leaves so the third level has
  // non-zero counts, and the facet prunes any depth>0 node whose count is 0.
  // Run first it finds nothing to move, reports "moved 0", and the third level
  // is invisible: facet-depth FD4 then picks a node that says hasChildren and
  // finds no child beneath it. Same hazard as seed-regions below, and I made it
  // here first.
  ['seed-categories-l3.mjs', [], 'depth-3 taxonomy WITH projects on the leaves — facet-depth FD4'],
  ['seed-project-covers.mjs', [], 'covers — home-trending-real asserts every card carries its real one'],
  ['seed-card-videos.mjs', [], 'campaign videos — home-card-video and home-hero-video'],
  ['seed-project-stories.mjs', [], 'structured stories — story-heading-levels'],
  ['seed-regions.mjs', [], 'region facet — facet-richness FR5 asserts it has real data'],
  ['seed-home-order.mjs', [], 'HomepageSection — home-section-order T3 asserts order comes from the table'],
  ['seed-rules-content.mjs', [], 'the rules hub and its pages — rules-hub, content-tree'],
  ['seed-tags.mjs', ['--attach'], 'attach tags to projects so the tag facet has counts'],
];

export async function seedCatalogue() {
  const failed = [];
  for (const [script, args, why] of STEPS) {
    const started = process.hrtime.bigint();
    try {
      execFileSync('node', [join(HERE, script), ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });
      const ms = Number((process.hrtime.bigint() - started) / 1_000_000n);
      console.log(`[catalogue] ok   ${String(ms).padStart(6)}ms  ${script}`);
    } catch (e) {
      const ms = Number((process.hrtime.bigint() - started) / 1_000_000n);
      failed.push(script);
      // LOUD, and with the child's own stderr. A seed that fails silently here
      // becomes a test failure twenty minutes later that looks like a product
      // bug, which is the exact trade this file exists to stop making.
      console.error(`[catalogue] FAIL ${String(ms).padStart(6)}ms  ${script}  (${why})`);
      const err = (e.stderr?.toString() || e.stdout?.toString() || String(e)).trim();
      console.error(err.split('\n').slice(0, 12).map((l) => `           | ${l}`).join('\n'));
    }
  }
  if (failed.length) {
    console.error(`[catalogue] ${failed.length} of ${STEPS.length} seed(s) FAILED: ${failed.join(', ')}`);
    console.error('[catalogue] the suite will report these as product failures — fix the seed first.');
  } else {
    console.log(`[catalogue] all ${STEPS.length} seeds applied`);
  }
  return { failed };
}

// Run standalone: `node prisma/seed-e2e-catalogue.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  const { failed } = await seedCatalogue();
  process.exit(failed.length ? 1 : 0);
}
