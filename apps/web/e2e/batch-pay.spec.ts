import { expect, test } from '@playwright/test';
import { API, apiSignin, opsEnter, signUpAndVerify, uniqueEmail } from './helpers';

const E2E_PASS = 'E2eStrongPass!7';
const SMOKE = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * Batch PAY — end-to-end over the REAL money loop (stub PSP):
 *  1. cancel before the lock succeeds + counters drop; inside the lock → 403
 *  2. a BNPL pledge counts toward the total but creates NO contract
 *  3. deadline settle: ≥80% captures (card → CAPTURED w/ realized, BNPL →
 *     checkout due → webhook completes it); <80% voids (never captures)
 * Deadline manipulation uses the audited admin deadline-override ops tool.
 */

// OPS Part 1 — MONEY seams (deadline-override, settle) now demand a fresh
// step-up proven via x-ops-token; one ops session is minted per worker.
let opsTokenPromise: Promise<string> | null = null;
async function smokeAuth() {
  const tok = await apiSignin(SMOKE.email, SMOKE.pass);
  opsTokenPromise ??= opsEnter(SMOKE.email, SMOKE.pass);
  const ops = await opsTokenPromise;
  return {
    authorization: `Bearer ${tok}`,
    'x-ops-token': ops,
    'content-type': 'application/json',
  } as Record<string, string>;
}

async function createLiveProject(auth: Record<string, string>, goalHalalas: number): Promise<{ id: string; tierId: string }> {
  const proj = (await fetch(`${API}/v1/projects`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      titleAr: `حملة PAY ${Date.now()}`,
      shortDescAr: 'اختبار قواعد السحب والإلغاء',
      category: 'TECH',
      storyAr: 'قصة اختبار آلي طويلة بما يكفي لتجاوز حد المئتي حرف. '.repeat(6),
      fundingGoalHalalas: goalHalalas,
      durationDays: 30,
    }),
  }).then((r) => r.json())) as { id: string };
  const tier = (await fetch(`${API}/v1/projects/${proj.id}/reward-tiers`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      titleAr: 'باقة اختبار',
      amountHalalas: 5000,
      descAr: 'باقة اختبار آلي بلا شحن للمعايرة',
      includesPhysicalProduct: false,
      requiresShipping: false,
      estDeliveryDate: '2026-12-01',
    }),
  }).then((r) => r.json())) as { id: string };
  await fetch(`${API}/v1/projects/${proj.id}/submit`, { method: 'POST', headers: auth });
  await fetch(`${API}/v1/admin/projects/${proj.id}/review`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ decision: 'approve' }),
  });
  return { id: proj.id, tierId: tier.id };
}

async function backer(page: import('@playwright/test').Page, prefix: string) {
  const email = uniqueEmail(prefix);
  await signUpAndVerify(page, `داعم ${prefix}`, email, String(1000000000 + Math.floor(Math.random() * 8e8)));
  const tok = await apiSignin(email, E2E_PASS);
  return { authorization: `Bearer ${tok}`, 'content-type': 'application/json' } as Record<string, string>;
}

async function pledge(auth: Record<string, string>, projectId: string, opts: { tierId?: string; amount: number; method?: string }) {
  const res = await fetch(`${API}/v1/pledges`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      projectId,
      ...(opts.tierId ? { tierId: opts.tierId } : {}),
      amountHalalas: opts.amount,
      source: 'tok_sandbox_pay',
      ...(opts.method ? { paymentMethod: opts.method } : {}),
    }),
  });
  expect(res.ok).toBe(true);
  return (await res.json()) as { id: string; status: string };
}

async function projectState(id: string): Promise<{ raisedHalalas: number; realizedHalalas: number; backersCount: number; status: string }> {
  return (await fetch(`${API}/v1/projects/${id}`).then((r) => r.json())) as never;
}

test('Part 1: cancel before the lock works + counters drop; inside the lock → 403 Arabic', async ({ page }) => {
  const admin = await smokeAuth();
  const { id: projectId, tierId } = await createLiveProject(admin, 10_000_000);
  const b = await backer(page, 'canc');

  const p = await pledge(b, projectId, { tierId, amount: 5000 });
  const before = await projectState(projectId);
  expect(before.raisedHalalas).toBe(5000);

  // Cancel well before the lock (deadline is 30 days out).
  const cancel = await fetch(`${API}/v1/pledges/${p.id}/cancel`, { method: 'POST', headers: b });
  expect(cancel.ok).toBe(true);
  const after = await projectState(projectId);
  expect(after.raisedHalalas).toBe(0);
  expect(after.backersCount).toBe(before.backersCount - 1);

  // New pledge, then shrink the runway under 48h → locked.
  const p2 = await pledge(b, projectId, { tierId, amount: 5000 });
  await fetch(`${API}/v1/admin/projects/${projectId}/deadline-override`, {
    method: 'POST',
    headers: admin,
    body: JSON.stringify({ deadline: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), reason: 'اختبار آلي: تقليص المدة لإغلاق نافذة الإلغاء' }),
  });
  const lockedRes = await fetch(`${API}/v1/pledges/${p2.id}/cancel`, { method: 'POST', headers: b });
  expect(lockedRes.status).toBe(403);
  expect(JSON.stringify(await lockedRes.json())).toContain('قُفلت التعهدات');

  // UI: «تعهداتي» shows the locked chip for this pledge.
  await page.goto('/projects/me/pledges');
  await expect(page.getByTestId('cancel-locked').first()).toBeVisible();
});

test('Part 4: a BNPL pledge counts toward the total but creates no contract', async ({ page }) => {
  const admin = await smokeAuth();
  const { id: projectId, tierId } = await createLiveProject(admin, 10_000_000);
  const b = await backer(page, 'bnpl');

  const p = await pledge(b, projectId, { tierId, amount: 8000, method: 'TABBY' });
  expect(p.status).toBe('PENDING_BNPL');

  const state = await projectState(projectId);
  expect(state.raisedHalalas).toBe(8000); // counts like a HELD pledge
  expect(state.realizedHalalas).toBe(0); // no money moved

  // No checkout session exists while the campaign is live.
  const premature = await fetch(`${API}/v1/pledges/${p.id}/bnpl/checkout`, { method: 'POST', headers: b });
  expect(premature.status).toBe(400);
});

test('Part 0/2/4: deadline with ≥80% captures; BNPL completes via webhook; realized tracks captures', async ({ page }) => {
  const admin = await smokeAuth();
  // goal 10_000: a 5000 card + 8000 BNPL = 13_000 ≥ 80%.
  const { id: projectId, tierId } = await createLiveProject(admin, 10_000);
  const cardBacker = await backer(page, 'cap1');
  await pledge(cardBacker, projectId, { tierId, amount: 5000 });
  await page.context().clearCookies();
  const bnplBacker = await backer(page, 'cap2');
  const bnplPledge = await pledge(bnplBacker, projectId, { amount: 8000, method: 'TAMARA' });

  // Force the deadline into the past + settle (audited admin tools).
  await fetch(`${API}/v1/admin/projects/${projectId}/deadline-override`, {
    method: 'POST',
    headers: admin,
    body: JSON.stringify({ deadline: new Date(Date.now() - 60_000).toISOString(), reason: 'اختبار آلي: مقعد تسوية — تقديم الموعد للماضي' }),
  });
  const settle = await fetch(`${API}/v1/admin/projects/${projectId}/settle`, { method: 'POST', headers: { ...admin, 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'اختبار آلي: تشغيل التسوية بعد الموعد' }) });
  expect(settle.ok).toBe(true);

  const settled = await projectState(projectId);
  expect(settled.status).toBe('FUNDED');
  expect(settled.realizedHalalas).toBe(5000); // card captured; BNPL still due

  // The BNPL intent became a due checkout (72h grace) with a hosted URL…
  const checkout = (await fetch(`${API}/v1/pledges/${bnplPledge.id}/bnpl/checkout`, {
    method: 'POST',
    headers: bnplBacker,
  }).then((r) => r.json())) as { url: string };
  expect(checkout.url).toContain('tamara');

  // …and the provider webhook completes it (idempotent: replay ignored).
  const hook = () =>
    fetch(`${API}/v1/webhooks/tamara`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pledgeId: bnplPledge.id, status: 'captured', eventId: 'evt-1' }),
    });
  expect(((await (await hook()).json()) as { outcome: string }).outcome).toBe('applied');
  expect(((await (await hook()).json()) as { outcome: string }).outcome).toBe('ignored');

  const final = await projectState(projectId);
  expect(final.realizedHalalas).toBe(13_000);
});

test('Part 0 failure path: below 80% at deadline → authorizations VOIDED, never captured', async ({ page }) => {
  const admin = await smokeAuth();
  const { id: projectId, tierId } = await createLiveProject(admin, 10_000_000); // unreachable goal
  const b = await backer(page, 'void');
  const p = await pledge(b, projectId, { tierId, amount: 5000 });
  const bnpl = await pledge(b, projectId, { amount: 5000, method: 'TABBY' });

  await fetch(`${API}/v1/admin/projects/${projectId}/deadline-override`, {
    method: 'POST',
    headers: admin,
    body: JSON.stringify({ deadline: new Date(Date.now() - 60_000).toISOString(), reason: 'اختبار آلي: مقعد تسوية — تقديم الموعد للماضي' }),
  });
  await fetch(`${API}/v1/admin/projects/${projectId}/settle`, { method: 'POST', headers: { ...admin, 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'اختبار آلي: تشغيل التسوية بعد الموعد' }) });

  const state = await projectState(projectId);
  expect(state.status).toBe('REFUNDED');
  expect(state.realizedHalalas).toBe(0); // nothing was ever captured

  const mine = (await fetch(`${API}/v1/pledges/me`, { headers: b }).then((r) => r.json())) as {
    items: Array<{ id: string; status: string }>;
  };
  expect(mine.items.find((x) => x.id === p.id)?.status).toBe('REFUNDED'); // voided hold
  expect(mine.items.find((x) => x.id === bnpl.id)?.status).toBe('REFUNDED'); // discarded intent
});

test('Part 3: a tierless pledge under 10 SAR is rejected; 10 SAR passes and counts the backer', async ({ page }) => {
  const admin = await smokeAuth();
  const { id: projectId } = await createLiveProject(admin, 10_000_000);
  const b = await backer(page, 'small');

  const tooSmall = await fetch(`${API}/v1/pledges`, {
    method: 'POST',
    headers: b,
    body: JSON.stringify({ projectId, amountHalalas: 999, source: 'tok_sandbox_pay' }),
  });
  expect(tooSmall.status).toBe(400);
  expect(JSON.stringify(await tooSmall.json())).toContain('١٠ ريالات');

  const ok = await pledge(b, projectId, { amount: 1000 });
  expect(ok.status).toBe('HELD');
  const state = await projectState(projectId);
  expect(state.backersCount).toBe(1); // every backer counts, whatever the amount
});
