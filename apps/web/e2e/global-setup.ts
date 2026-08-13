import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { apiSignin } from './helpers';

const API = process.env.E2E_API_URL ?? 'http://localhost:4001';

/**
 * Seeds a deterministic LIVE project with a NO-shipping tier + an OPEN RFQ,
 * so the backer + supplier journeys have stable, self-contained targets.
 * Writes the ids to env for the specs.
 */
/**
 * Remove the previous runs' golden-journey rows before adding this one.
 *
 * These projects are public ON PURPOSE — in CI this is the only project that
 * exists, and category-discovery + stakes-s10 F-10 both need it listed. That
 * decision stands. What was wrong is that they ACCUMULATED: 531 had piled up
 * since 2026-07-26 and became 95% of the public catalogue, so one category held
 * 95.7% of all projects and most search results were coverless placeholders.
 *
 * Hiding them was tried and reverted (widening migration 0058's predicate broke
 * both specs). Keeping exactly one is the fix that serves both needs: the specs
 * get their listed project, the catalogue stays presentable.
 *
 * Best-effort: a runner without DATABASE_URL or without the api workspace on
 * disk simply skips it. A housekeeping step must never fail the suite — and the
 * purge script refuses on its own if any pledge belongs to a real account.
 */
function purgePreviousRuns(): void {
  const script = join(__dirname, '..', '..', 'api', 'prisma', 'purge-e2e-debris.mjs');
  if (!process.env.DATABASE_URL || !existsSync(script)) {
    console.log('[global-setup] debris purge skipped (no DATABASE_URL or api workspace)');
    return;
  }
  try {
    const out = execFileSync('node', [script, '--keep', '0'], { encoding: 'utf8' });
    console.log(out.trim().split('\n').map((l) => `[global-setup] ${l}`).join('\n'));
  } catch (e) {
    console.warn(`[global-setup] debris purge failed (continuing): ${(e as Error).message}`);
  }
}

export default async function globalSetup(): Promise<void> {
  purgePreviousRuns();
  /**
   * Batch ACCOUNT — the golden journey is authored by a creator who owns
   * NOTHING, and reviewed by the admin.
   *
   * Both roles used to be smoke-s1. That worked until one-active-project
   * landed: smoke-s1 permanently holds catalogue campaigns, so creating another
   * is refused — correctly — and the refusal used to be swallowed into a
   * partial ids file that made five specs fail two hours downstream. The debris
   * purge cannot help, because the blocker is a catalogue project, not
   * golden-journey debris.
   *
   * Splitting them is also more honest about what the journey tests: a project
   * that reaches LIVE has crossed a real authority boundary, rather than being
   * approved by its own author.
   */
  const creatorToken = await apiSignin('golden-journey@test.wathba.sa', 'Str0ngPass!x');
  const auth = { authorization: `Bearer ${creatorToken}`, 'content-type': 'application/json' };
  const adminToken = await apiSignin('smoke-s1@test.wathba.sa', 'Str0ngPass!x');
  const adminAuth = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };

  // Batch CAT — attach the seeded project to technology → apps (a subcategory)
  // so the category-discovery journey has a result on the subcategory page.
  const tech = (await fetch(`${API}/v1/categories/technology`).then((r) => r.json())) as {
    children: Array<{ id: string; slug: string }>;
  };
  const appsId = tech.children.find((c) => c.slug === 'apps')?.id;

  const proj = (await fetch(`${API}/v1/projects`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      // POLISH Unit 6 — PRESENTABLE, deliberately.
      //
      // This was `مشروع E2E ${Date.now()}`, which the fixture guard now hides
      // from every public listing. But this project's whole job is to guarantee
      // a card on the technology/apps subcategory page for category-discovery,
      // and in CI it is the only project that exists at all — so it has to BE
      // publicly listable.
      //
      // The guard needs a fixture token AND a timestamp. Dropping the token is
      // enough: the title still carries a timestamp so runs never collide on the
      // slug, and it reads like a real campaign rather than «مشروع E2E …».
      // The genuinely throwaway per-run projects (creator-journey, batch-pay)
      // keep their tokens and stay hidden.
      titleAr: `مشروع الرحلة الذهبية ${Date.now()}`,
      shortDescAr: 'هدف اختبار آلي للرحلة الذهبية للداعم',
      ...(appsId ? { categoryId: appsId } : { category: 'TECH' }),
      storyAr: 'قصة اختبار آلي طويلة بما يكفي لتجاوز حد المئتي حرف. '.repeat(6),
      fundingGoalHalalas: 100000,
      durationDays: 30,
    }),
  }).then((r) => r.json())) as { id: string; message?: string; code?: string };

  /**
   * Batch ACCOUNT — FAIL LOUDLY.
   *
   * This used to run on and, if creation had failed, write an ids file with a
   * `slug` and no `projectId`. Every spec reading seededIds().projectId then
   * PATCHed `/v1/projects/undefined` and got a 400 whose message said only
   * "Validation failed (uuid is expected)". One clear setup failure became five
   * misleading product failures two hours downstream — an artefact that looked
   * valid because nothing checked that it was.
   *
   * The batch's own one-active-project rule is what surfaced this: the golden
   * journey project is created through the API, where the seed's escape hatch
   * does not apply, so a creator who already holds an active project is refused
   * here and the refusal was swallowed.
   */
  if (!proj?.id) {
    throw new Error(
      `[global-setup] golden-journey project was NOT created — the suite would ` +
        `run against an undefined id. API said: ${JSON.stringify(proj)}`,
    );
  }

  await fetch(`${API}/v1/projects/${proj.id}/reward-tiers`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      titleAr: 'باقة رقمية بلا شحن',
      amountHalalas: 5000,
      descAr: 'مكافأة رقمية للاختبار الآلي لا تتطلب شحناً',
      includesPhysicalProduct: false,
      requiresShipping: false,
      estDeliveryDate: '2026-12-01',
    }),
  });
  // STAKES/S-10 F-10 — a human slug set at draft time (slug edits lock after
  // submission) so the sitemap/canonical specs have a slugged LIVE project.
  const slug = `rihla-thahabiya-${Date.now()}`;
  await fetch(`${API}/v1/projects/${proj.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ slug }),
  });
  await fetch(`${API}/v1/projects/${proj.id}/submit`, { method: 'POST', headers: auth });
  await fetch(`${API}/v1/admin/projects/${proj.id}/review`, {
    method: 'POST',
    headers: adminAuth,
    body: JSON.stringify({ decision: 'approve' }),
  });

  const rfq = (await fetch(`${API}/v1/rfqs`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      projectId: proj.id,
      specsAr: 'توريد مواد التغليف والشحن لمئة وحدة بمواصفات صديقة للبيئة ومطابقة لمعايير الجودة',
      dueDate: '2026-10-01T00:00:00.000Z',
    }),
  }).then((r) => r.json())) as { id: string };

  // Persist for worker processes via a temp file (portable across CI/local).
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  // Same rule for the RFQ: a partial file is worse than no file, because the
  // specs cannot tell one from the other.
  if (!rfq?.id) {
    throw new Error(`[global-setup] RFQ was NOT created. API said: ${JSON.stringify(rfq)}`);
  }
  fs.writeFileSync(
    path.join(os.tmpdir(), 'wathba-e2e-ids.json'),
    JSON.stringify({ projectId: proj.id, rfqId: rfq.id, slug }),
  );
}
