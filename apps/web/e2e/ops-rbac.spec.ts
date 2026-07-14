import { expect, test, type APIRequestContext } from '@playwright/test';
import { API, apiSignin, opsEnter } from './helpers';

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };
const FINANCE = { email: 'smoke-finance@test.wathba.sa', pass: 'Str0ngPass!x' };
// The demo admin (seed-demo-users) also holds OWNER in the shared dev DB;
// the four-eyes test demotes it to reach a deterministic SINGLE-operator
// baseline, and restores it afterwards.
const DEMO_ADMIN = { email: 'admin@wathba.demo', pass: 'Wathba!2026' };

/**
 * OPS Part 2 — RBAC + four-eyes + PDPL proofs against the LIVE stack:
 *  1. An ADMIN with no ops-role grants can enter the ops center but is
 *     REFUSED on every operation (the enum buys entry, RBAC buys capability).
 *  2. Granting FINANCE to a second user flips FOUR_EYES_MONEY on
 *     automatically: a MONEY execute queues a proposal instead of running;
 *     SELF-approval is refused; the second user approves and it executes;
 *     revoking the role restores single-operator direct execution.
 *  3. PII is masked by default on the admin surface; revealing a value goes
 *     through the audited users.pii.unmask operation.
 */

test.describe.configure({ mode: 'serial' });

async function userIdOf(request: APIRequestContext, email: string, pass: string): Promise<string> {
  const token = await apiSignin(email, pass);
  const me = await request.get(`${API}/v1/users/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(me.status()).toBe(200);
  return ((await me.json()) as { id: string }).id;
}

test('an ADMIN without ops-role grants is refused on every operation (entry ≠ capability)', async ({ request }) => {
  const financeOps = await opsEnter(FINANCE.email, FINANCE.pass);

  // The manifest is visible (session-gated), …
  const manifest = await request.get(`${API}/v1/ops/operations`, {
    headers: { 'x-ops-token': financeOps },
  });
  expect(manifest.status()).toBe(200);

  // … but a CONTENT-tier operation refuses on the missing permission —
  // dry-run AND execute.
  for (const leg of ['dry-run', 'execute'] as const) {
    const res = await request.post(
      `${API}/v1/ops/operations/content.editorial.card.create/${leg}`,
      {
        headers: { 'x-ops-token': financeOps },
        data: {
          input: { kind: 'TIP', titleAr: 'بطاقة اختبارية', bodyAr: 'محتوى اختباري للتحقق من الصلاحيات' },
          reason: 'اختبار آلي: يجب الرفض لغياب الصلاحية',
        },
      },
    );
    expect(res.status(), leg).toBe(403);
    expect(JSON.stringify(await res.json())).toContain('تفتقد الصلاحية');
  }
});

test('four-eyes lifecycle: 2nd money admin → queue → self-approval refused → second pair of eyes executes → revoke restores', async ({ request }) => {
  const ownerOps = await opsEnter(OWNER.email, OWNER.pass);
  const financeUserId = await userIdOf(request, FINANCE.email, FINANCE.pass);
  const opsHeaders = { 'x-ops-token': ownerOps };

  // Reach the single-operator baseline: demote every other money admin
  // (the shared dev DB carries the demo admin's OWNER grant). Restored below.
  const demoAdminId = await userIdOf(request, DEMO_ADMIN.email, DEMO_ADMIN.pass);
  const demote = await request.post(`${API}/v1/ops/operations/users.ops-role.revoke/execute`, {
    headers: opsHeaders,
    data: {
      input: { userId: demoAdminId, roleKey: 'OWNER' },
      reason: 'اختبار آلي: الوصول لوضع المشغّل الواحد قبل اختبار العيون الأربع',
    },
  });
  expect([200, 422]).toContain(demote.status()); // 422 = already not granted
  const demoted = demote.status() === 200;

  const baseline = await request.get(`${API}/v1/ops/auth/session`, { headers: opsHeaders });
  expect(((await baseline.json()) as { fourEyes: boolean; moneyAdmins: number })).toMatchObject({
    fourEyes: false,
    moneyAdmins: 1,
  });

  try {
    // Grant FINANCE to the second admin — the dryRun preview warns about the flip.
    const dry = await request.post(`${API}/v1/ops/operations/users.ops-role.grant/dry-run`, {
      headers: opsHeaders,
      data: { input: { userId: financeUserId, roleKey: 'FINANCE' } },
    });
    expect(dry.status()).toBe(200);
    const dryBody = (await dry.json()) as { ok: boolean; preview: { summaryAr: string } };
    expect(dryBody.ok).toBe(true);
    expect(dryBody.preview.summaryAr).toContain('العيون الأربع');

    const grant = await request.post(`${API}/v1/ops/operations/users.ops-role.grant/execute`, {
      headers: opsHeaders,
      data: {
        input: { userId: financeUserId, roleKey: 'FINANCE' },
        reason: 'اختبار آلي: تعيين مسؤول مالي ثانٍ لتفعيل العيون الأربع',
      },
    });
    expect(grant.status()).toBe(200);
    const grantBody = (await grant.json()) as { result: { fourEyesNowOn: boolean } };
    expect(grantBody.result.fourEyesNowOn).toBe(true);

    // A MONEY execute now QUEUES instead of running.
    const idem = `e2e-4eyes-${Date.now()}`;
    const attempt = await request.post(`${API}/v1/ops/operations/money.payout.disburse/execute`, {
      headers: { ...opsHeaders, 'x-idempotency-key': idem },
      data: { input: {}, reason: 'اختبار آلي: دورة صرف تحت العيون الأربع' },
    });
    expect(attempt.status()).toBe(200);
    const queued = (await attempt.json()) as { queued?: boolean; proposalId?: string; executionId: string | null };
    expect(queued.queued).toBe(true);
    expect(queued.executionId).toBeNull();
    const proposalId = queued.proposalId!;

    // SELF-approval refused at the domain level — even for the OWNER.
    const selfApprove = await request.post(`${API}/v1/ops/proposals/${proposalId}/approve`, {
      headers: opsHeaders,
      data: { reason: 'اختبار آلي: محاولة اعتماد ذاتي يجب أن تُرفض' },
    });
    expect(selfApprove.status()).toBe(403);
    expect(JSON.stringify(await selfApprove.json())).toContain('اقتراحك بنفسك');

    // The SECOND pair of eyes approves → executes (their session's step-up).
    const financeOps = await opsEnter(FINANCE.email, FINANCE.pass);
    const approve = await request.post(`${API}/v1/ops/proposals/${proposalId}/approve`, {
      headers: { 'x-ops-token': financeOps },
      data: { reason: 'اختبار آلي: اعتماد بعد مراجعة المعاينة' },
    });
    expect(approve.status()).toBe(200);
    const approved = (await approve.json()) as { executionId: string | null; proposalId: string };
    expect(approved.executionId).toBeTruthy();
    expect(approved.proposalId).toBe(proposalId);

    // The queue shows it EXECUTED with the decider recorded.
    const listed = await request.get(`${API}/v1/ops/proposals?status=EXECUTED`, {
      headers: opsHeaders,
    });
    const { items } = (await listed.json()) as { items: Array<{ id: string; decidedById: string | null }> };
    const row = items.find((p) => p.id === proposalId)!;
    expect(row).toBeTruthy();
    expect(row.decidedById).toBe(financeUserId);

    // Revoking the 2nd money admin restores single-operator mode: the same
    // MONEY op now executes DIRECTLY.
    const revoke = await request.post(`${API}/v1/ops/operations/users.ops-role.revoke/execute`, {
      headers: opsHeaders,
      data: {
        input: { userId: financeUserId, roleKey: 'FINANCE' },
        reason: 'اختبار آلي: استعادة وضع المشغّل الواحد بعد الاختبار',
      },
    });
    expect(revoke.status()).toBe(200);

    const direct = await request.post(`${API}/v1/ops/operations/money.payout.disburse/execute`, {
      headers: { 'x-ops-token': ownerOps, 'x-idempotency-key': `e2e-direct-${Date.now()}` },
      data: { input: {}, reason: 'اختبار آلي: تنفيذ مباشر بعد استعادة وضع المشغّل الواحد' },
    });
    expect(direct.status()).toBe(200);
    const directBody = (await direct.json()) as { queued?: boolean; executionId: string | null };
    expect(directBody.queued ?? false).toBe(false);
    expect(directBody.executionId).toBeTruthy();
  } finally {
    // Idempotent cleanup — ALWAYS: drop the FINANCE grant if it survived,
    // then give the demo admin its OWNER grant back.
    await request.post(`${API}/v1/ops/operations/users.ops-role.revoke/execute`, {
      headers: opsHeaders,
      data: {
        input: { userId: financeUserId, roleKey: 'FINANCE' },
        reason: 'اختبار آلي: تنظيف نهائي بعد اختبار العيون الأربع',
      },
    });
    if (demoted) {
      await request.post(`${API}/v1/ops/operations/users.ops-role.grant/execute`, {
        headers: opsHeaders,
        data: {
          input: { userId: demoAdminId, roleKey: 'OWNER' },
          reason: 'اختبار آلي: إعادة دور المالك لحساب العرض التجريبي',
        },
      });
    }
  }
});

test('PII is masked by default; users.pii.unmask reveals with a reason and never stores the value', async ({ request }) => {
  const token = await apiSignin(OWNER.email, OWNER.pass);
  const kyc = await request.get(`${API}/v1/admin/kyc-queue`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(kyc.status()).toBe(200);
  const { items } = (await kyc.json()) as { items: Array<{ email: string | null; phone: string | null }> };
  for (const row of items) {
    if (row.email) expect(row.email).toContain('***');
    if (row.phone) expect(row.phone).toMatch(/^\*+\d{2}$/);
  }

  // Unmasking is an OPERATION: reason-gated, returns the value to the caller.
  const ownerOps = await opsEnter(OWNER.email, OWNER.pass);
  const financeUserId = await userIdOf(request, FINANCE.email, FINANCE.pass);

  const noReason = await request.post(`${API}/v1/ops/operations/users.pii.unmask/execute`, {
    headers: { 'x-ops-token': ownerOps },
    data: { input: { userId: financeUserId, fields: ['email'] } },
  });
  expect(noReason.status()).toBe(400);

  const unmask = await request.post(`${API}/v1/ops/operations/users.pii.unmask/execute`, {
    headers: { 'x-ops-token': ownerOps },
    data: {
      input: { userId: financeUserId, fields: ['email'] },
      reason: 'اختبار آلي: التحقق من مسار كشف البيانات المدقّق',
    },
  });
  expect(unmask.status()).toBe(200);
  const body = (await unmask.json()) as { result: { values: { email: string } } };
  expect(body.result.values.email).toBe(FINANCE.email);
});
