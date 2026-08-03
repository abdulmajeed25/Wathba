// Make `.next/standalone` actually runnable.
//
// `next build` with output:'standalone' emits a server bundle that does NOT
// contain the static assets it serves: .next/static and public/ are left beside
// the standalone tree, and every consumer is expected to copy them in. Nobody
// remembers, and the failure is quiet in the worst way — the server boots, the
// HTML renders, a health check on /projects returns 200, and every script tag
// 404s. Nothing hydrates. Buttons do nothing. In a test suite that reads as a
// pile of product bugs; on a deploy it reads as "the page loads but is dead".
//
// It cost an hour here before being recognised, and CI has been booting exactly
// this broken server (.github/workflows/ci.yml runs server.js with no copy
// step). Fixing it in the BUILD fixes it for CI, for the deploy, and for anyone
// who runs the standalone locally — a copy step in one workflow file would have
// fixed one of the three.
//
// Idempotent, and a no-op when there is no standalone output, so a build with
// output:'standalone' removed does not start failing here.
import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const standalone = join(root, '.next', 'standalone', 'apps', 'web');

if (!existsSync(standalone)) {
  console.log('[standalone-assets] no standalone output — nothing to copy');
  process.exit(0);
}

const pairs = [
  [join(root, '.next', 'static'), join(standalone, '.next', 'static')],
  [join(root, 'public'), join(standalone, 'public')],
];

for (const [from, to] of pairs) {
  if (!existsSync(from)) {
    console.log(`[standalone-assets] skipped ${from} (absent)`);
    continue;
  }
  cpSync(from, to, { recursive: true });
  console.log(`[standalone-assets] copied ${from.replace(root + '/', '')} → ${to.replace(root + '/', '')}`);
}
